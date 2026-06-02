import { Router, Request, Response } from 'express';
import type { OrderStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getIo } from '../sockets/orderSocket';
import { sendSms, smsTemplates } from '../lib/sms';
import { authenticateToken, requireRole } from '../middleware/auth';
import { isConfigured as paystackConfigured, initializeTransaction } from '../lib/paystack';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateOrderId(): Promise<string> {
  // Retry until we find an ID not already in the DB (collision is extremely rare).
  for (;;) {
    const digits = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    const id = `CC-${digits}`;
    const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return id;
  }
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// Buyer places a new order.

router.post(
  '/orders',
  authenticateToken,
  requireRole('BUYER'),
  async (req: Request, res: Response) => {
    const {
      vendorId,
      items,
      deliverTo,
      roomNumber,
      paymentMethod,
    } = req.body as {
      vendorId?: string;
      items?: { menuItemId: string; quantity: number }[];
      deliverTo?: string;
      roomNumber?: string;
      paymentMethod?: PaymentMethod;
    };

    // ── Validation ──────────────────────────────────────────────────────────
    if (!vendorId || !items?.length || !deliverTo || !paymentMethod) {
      res.status(400).json({ message: 'vendorId, items, deliverTo and paymentMethod are required.' });
      return;
    }

    for (const item of items) {
      if (!item.menuItemId || !item.quantity || item.quantity < 1) {
        res.status(400).json({ message: 'Each item needs a menuItemId and a quantity ≥ 1.' });
        return;
      }
    }

    // ── Vendor exists ────────────────────────────────────────────────────────
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: { select: { phone: true } } },
    });
    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found.' });
      return;
    }
    if (!vendor.isOpen) {
      res.status(409).json({ message: `${vendor.storeName} is currently closed.` });
      return;
    }

    // ── Fetch & snapshot menu items ──────────────────────────────────────────
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, vendorId, isAvailable: true },
    });

    if (menuItems.length !== menuItemIds.length) {
      const foundIds = new Set(menuItems.map((m) => m.id));
      const missing = menuItemIds.filter((id) => !foundIds.has(id));
      res.status(404).json({ message: 'Some items not found or unavailable.', missing });
      return;
    }

    // ── Calculate totals ─────────────────────────────────────────────────────
    const DELIVERY_FEE = 15;
    const priceMap = new Map(menuItems.map((m) => [m.id, Number(m.price)]));

    const lineItems = items.map((item) => {
      const unitPrice = priceMap.get(item.menuItemId)!;
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity,
      };
    });

    const subtotal = lineItems.reduce((sum, li) => sum + li.subtotal, 0);
    const totalAmount = subtotal + DELIVERY_FEE;

    // ── Buyer phone + email for SMS / Paystack ───────────────────────────────
    const buyer = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { phone: true, email: true },
    });

    // ── Prisma transaction ───────────────────────────────────────────────────
    const orderId = await generateOrderId();

    const order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          id: orderId,
          buyerId: req.user!.id,
          vendorId,
          deliverTo,
          roomNumber: roomNumber ?? null,
          deliveryFee: DELIVERY_FEE,
          totalAmount,
          paymentMethod,
          paymentStatus: 'PENDING',
          items: {
            create: lineItems.map((li) => ({
              menuItemId: li.menuItemId,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
            })),
          },
        },
        include: {
          items: { include: { menuItem: { select: { name: true, imageUrl: true } } } },
          vendor: { select: { storeName: true } },
          buyer: { select: { name: true, phone: true } },
        },
      });
    });

    // ── Socket: notify vendor ────────────────────────────────────────────────
    try {
      getIo().to(`vendor:${vendorId}`).emit('order:new', order);
    } catch {
      // Socket not critical — log and continue
      console.error('[Socket] Failed to emit order:new');
    }

    // ── SMS (fire-and-forget) ────────────────────────────────────────────────
    const itemsSummary = lineItems
      .map((li) => {
        const name = menuItems.find((m) => m.id === li.menuItemId)?.name ?? li.menuItemId;
        return `${name} x${li.quantity}`;
      })
      .join(', ');

    const deliveryLabel = roomNumber ? `${deliverTo}, Room ${roomNumber}` : deliverTo;

    void Promise.allSettled([
      buyer?.phone
        ? sendSms(buyer.phone, smsTemplates.orderPlacedBuyer(orderId, vendor.storeName))
        : Promise.resolve(),
      vendor.user?.phone
        ? sendSms(vendor.user.phone, smsTemplates.orderPlacedVendor(orderId, itemsSummary, deliveryLabel))
        : Promise.resolve(),
    ]);

    // ── Inline Paystack initialise ───────────────────────────────────────────
    // Done in the same response so the client doesn't pay for a second HTTP
    // round trip to /api/payments/initialize. Cash-on-delivery skips this.
    let paymentInit: { authorization_url: string; reference: string } | null = null;
    let paymentInitError: string | null = null;
    if (paystackConfigured() && paymentMethod !== 'CASH' && buyer?.email) {
      const reference = `${orderId}:${Date.now()}`;
      const base = (process.env.CLIENT_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
      try {
        const data = await initializeTransaction({
          email: buyer.email,
          amount: Number(order.totalAmount),
          reference,
          callbackUrl: `${base}/track/${encodeURIComponent(orderId)}`,
          metadata: { orderId, buyerId: req.user!.id },
        });
        paymentInit = { authorization_url: data.authorization_url, reference: data.reference };
      } catch (err) {
        // Order is already created — surface the error but don't fail the whole
        // request. The buyer can retry from the Track page.
        paymentInitError = err instanceof Error ? err.message : 'Failed to initialise payment.';
      }
    }

    res.status(201).json({ ...order, paymentInit, paymentInitError });
  },
);

// ─── PATCH /api/orders/:id/status ────────────────────────────────────────────
// Vendor updates order status.

const VALID_STATUSES: OrderStatus[] = [
  'CONFIRMED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED',
];

router.patch(
  '/orders/:id/status',
  authenticateToken,
  requireRole('VENDOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body as { status?: OrderStatus };

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({
        message: `status must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
      return;
    }

    // ── Find order ───────────────────────────────────────────────────────────
    const order = await prisma.order.findUnique({
      where: { id },
      include: { buyer: { select: { phone: true } }, vendor: true },
    });

    if (!order) {
      res.status(404).json({ message: 'Order not found.' });
      return;
    }

    // ── Authorise: vendor must own this order ────────────────────────────────
    if (req.user!.role === 'VENDOR') {
      const vendorRecord = await prisma.vendor.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!vendorRecord || vendorRecord.id !== order.vendorId) {
        res.status(403).json({ message: 'You do not own this order.' });
        return;
      }
    }

    // ── Update ───────────────────────────────────────────────────────────────
    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { menuItem: { select: { name: true } } } },
        vendor: { select: { storeName: true } },
        buyer: { select: { name: true, phone: true } },
      },
    });

    // ── Socket: notify buyer + anyone tracking this order ───────────────────
    try {
      const io = getIo();
      const payload = { orderId: id, status, order: updated };
      io.to(`buyer:${order.buyerId}`).emit('order:statusUpdate', payload);
      io.to(`order:${id}`).emit('order:statusUpdate', payload);
    } catch {
      console.error('[Socket] Failed to emit order:statusUpdate');
    }

    // ── SMS on delivery ──────────────────────────────────────────────────────
    if (status === 'DELIVERED' && order.buyer?.phone) {
      void sendSms(order.buyer.phone, smsTemplates.orderDelivered(id));
    }

    res.json(updated);
  },
);

// ─── GET /api/orders/my ───────────────────────────────────────────────────────
// Buyer's order history — newest first.
// IMPORTANT: this route must be declared before /orders/:id to avoid shadowing.

router.get(
  '/orders/my',
  authenticateToken,
  requireRole('BUYER'),
  async (req: Request, res: Response) => {
    const { status, limit = '20', offset = '0' } = req.query as {
      status?: OrderStatus;
      limit?: string;
      offset?: string;
    };

    const orders = await prisma.order.findMany({
      where: {
        buyerId: req.user!.id,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit), 50),
      skip: Number(offset),
      include: {
        items: {
          include: { menuItem: { select: { name: true, imageUrl: true, category: true } } },
        },
        vendor: { select: { id: true, storeName: true, imageUrl: true } },
      },
    });

    res.json(orders);
  },
);

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────
// Public — no auth required so the Track page works without login.
// Buyer phone is intentionally omitted to protect privacy.

router.get('/orders/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { menuItem: { select: { name: true, imageUrl: true } } } },
      vendor: { select: { storeName: true } },
      buyer: { select: { name: true } },
    },
  });

  if (!order) {
    res.status(404).json({ message: 'Order not found.' });
    return;
  }

  res.json(order);
});

// ─── GET /api/vendors/:id/orders ─────────────────────────────────────────────
// Vendor's incoming orders — newest first, optional status filter.

router.get(
  '/vendors/:id/orders',
  authenticateToken,
  requireRole('VENDOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    const { id: vendorId } = req.params;
    const { status, limit = '50', offset = '0' } = req.query as {
      status?: OrderStatus;
      limit?: string;
      offset?: string;
    };

    // ── Authorise: vendor can only query their own store ─────────────────────
    if (req.user!.role === 'VENDOR') {
      const vendorRecord = await prisma.vendor.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (!vendorRecord || vendorRecord.id !== vendorId) {
        res.status(403).json({ message: 'You do not own this vendor.' });
        return;
      }
    }

    const orders = await prisma.order.findMany({
      where: {
        vendorId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit), 100),
      skip: Number(offset),
      include: {
        items: {
          include: { menuItem: { select: { name: true, price: true, category: true } } },
        },
        buyer: { select: { id: true, name: true, phone: true, level: true } },
      },
    });

    res.json(orders);
  },
);

export default router;
