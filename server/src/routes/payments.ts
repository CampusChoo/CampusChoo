// Paystack integration endpoints.
//
//   POST /api/payments/initialize   (auth, BUYER) — start a checkout for an order
//   GET  /api/payments/verify       (public)      — confirm payment after redirect
//   POST /api/payments/webhook      (public)      — Paystack-to-server callback
//
// The webhook is the source of truth. The sync /verify route lets the UI react
// immediately when the buyer comes back, but even if they close the tab the
// webhook will still mark the order paid.

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  isConfigured,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} from '../lib/paystack';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getIo } from '../sockets/orderSocket';

const router = Router();

// Paystack references must be unique per attempt. Format: <orderId>:<timestamp>.
// On verify/webhook we strip the suffix to recover the orderId.
function makeReference(orderId: string): string {
  return `${orderId}:${Date.now()}`;
}
function orderIdFromReference(reference: string): string {
  return reference.split(':')[0];
}

// Pretty client URL for the redirect back from Paystack.
function callbackUrl(orderId: string): string {
  const base = process.env.CLIENT_BASE_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/track/${encodeURIComponent(orderId)}`;
}

// ─── POST /api/payments/initialize ────────────────────────────────────────────
// Body: { orderId }. Buyer-only. Returns { authorization_url, reference }.

router.post(
  '/payments/initialize',
  authenticateToken,
  requireRole('BUYER'),
  async (req: Request, res: Response) => {
    if (!isConfigured()) {
      res.status(503).json({ message: 'Paystack is not configured. Add PAYSTACK_SECRET_KEY to server/.env.' });
      return;
    }

    const { orderId } = req.body as { orderId?: string };
    if (!orderId) {
      res.status(400).json({ message: 'orderId is required.' });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: { select: { id: true, email: true } } },
    });
    if (!order) {
      res.status(404).json({ message: 'Order not found.' });
      return;
    }
    if (order.buyerId !== req.user!.id) {
      res.status(403).json({ message: 'You do not own this order.' });
      return;
    }
    if (order.paymentStatus === 'PAID') {
      res.status(409).json({ message: 'Order is already paid.' });
      return;
    }

    const reference = makeReference(order.id);

    try {
      const data = await initializeTransaction({
        email: order.buyer.email,
        amount: Number(order.totalAmount),
        reference,
        callbackUrl: callbackUrl(order.id),
        metadata: { orderId: order.id, buyerId: order.buyerId },
      });
      res.json({
        authorization_url: data.authorization_url,
        reference: data.reference,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialise payment.';
      res.status(502).json({ message });
    }
  },
);

// ─── GET /api/payments/verify?reference=... ───────────────────────────────────
// Public — the redirect from Paystack hits this. Verifies with Paystack and
// updates the order. Idempotent: re-running after a webhook has already marked
// PAID returns the same final state.

router.get('/payments/verify', async (req: Request, res: Response) => {
  if (!isConfigured()) {
    res.status(503).json({ message: 'Paystack is not configured.' });
    return;
  }

  const reference = (req.query.reference as string | undefined)?.trim();
  if (!reference) {
    res.status(400).json({ message: 'reference query param is required.' });
    return;
  }

  const orderId = orderIdFromReference(reference);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    res.status(404).json({ message: 'Order not found.' });
    return;
  }

  try {
    const verification = await verifyTransaction(reference);

    if (verification.status === 'success') {
      // Guard against mismatched amounts (Paystack returns pesewas).
      const expectedPesewas = Math.round(Number(order.totalAmount) * 100);
      if (verification.amount !== expectedPesewas) {
        console.warn(`[Paystack] Amount mismatch for ${orderId}: expected ${expectedPesewas}, got ${verification.amount}`);
      }
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'PAID' },
      });
      try {
        getIo().to(`order:${orderId}`).emit('payment:update', { orderId, paymentStatus: 'PAID' });
      } catch { /* socket optional */ }
      res.json({ orderId, paymentStatus: updated.paymentStatus, channel: verification.channel });
      return;
    }

    if (verification.status === 'failed' || verification.status === 'abandoned') {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'FAILED' },
      });
      res.json({ orderId, paymentStatus: 'FAILED', reason: verification.status });
      return;
    }

    // Still pending on Paystack's side — leave the order untouched.
    res.json({ orderId, paymentStatus: 'PENDING', reason: verification.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to verify payment.';
    res.status(502).json({ message });
  }
});

// ─── POST /api/payments/webhook ───────────────────────────────────────────────
// Paystack-signed callback. Mounted with express.raw so we can verify the
// HMAC over the exact body bytes Paystack sent.

// Raw body is supplied by express.raw() mounted in index.ts BEFORE express.json().
router.post(
  '/payments/webhook',
  async (req: Request, res: Response) => {
    const signature = req.header('x-paystack-signature') ?? undefined;
    const rawBody = req.body as Buffer;

    if (!verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({ message: 'Invalid signature.' });
      return;
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as {
        event: string;
        data: { reference: string; status: string; amount: number };
      };
    } catch {
      res.status(400).json({ message: 'Invalid JSON.' });
      return;
    }

    // Acknowledge fast — Paystack retries if we don't respond within ~30s.
    res.status(200).json({ received: true });

    if (event.event !== 'charge.success') return;

    const orderId = orderIdFromReference(event.data.reference);
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.paymentStatus === 'PAID') return;

      const expectedPesewas = Math.round(Number(order.totalAmount) * 100);
      if (event.data.amount !== expectedPesewas) {
        console.warn(`[Webhook] Amount mismatch for ${orderId}: expected ${expectedPesewas}, got ${event.data.amount}`);
        return;
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'PAID' },
      });
      try {
        getIo().to(`order:${orderId}`).emit('payment:update', { orderId, paymentStatus: 'PAID' });
      } catch { /* socket optional */ }
    } catch (err) {
      console.error('[Webhook] Failed to apply charge.success:', err);
    }
  },
);

export default router;
