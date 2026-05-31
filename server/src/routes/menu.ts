import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Returns the vendor record owned by the calling user, or null.

async function getOwnedVendor(userId: string) {
  return prisma.vendor.findUnique({
    where: { userId },
    select: { id: true },
  });
}

// ─── GET /api/vendors/:id/menu ────────────────────────────────────────────────
// Public — anyone can view a vendor's menu.

router.get(
  '/vendors/:id/menu',
  async (req: Request, res: Response) => {
    const { id: vendorId } = req.params;
    const items = await prisma.menuItem.findMany({
      where: { vendorId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(items);
  },
);

// ─── POST /api/vendors/:id/menu ───────────────────────────────────────────────
// Vendor adds a new item to their menu.

router.post(
  '/vendors/:id/menu',
  authenticateToken,
  requireRole('VENDOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    const { id: vendorId } = req.params;
    const { name, description, price, category, imageUrl, images, videoUrl } = req.body as {
      name?: string;
      description?: string;
      price?: number | string;
      category?: string;
      imageUrl?: string;
      images?: string[];
      videoUrl?: string;
    };

    if (!name || !category || price == null) {
      res.status(400).json({ message: 'name, category and price are required.' });
      return;
    }

    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      res.status(400).json({ message: 'price must be a non-negative number.' });
      return;
    }

    if (req.user!.role === 'VENDOR') {
      const owned = await getOwnedVendor(req.user!.id);
      if (!owned || owned.id !== vendorId) {
        res.status(403).json({ message: 'You do not own this vendor.' });
        return;
      }
    }

    const cleanImages = Array.isArray(images)
      ? images.map((u) => String(u).trim()).filter(Boolean)
      : [];

    const item = await prisma.menuItem.create({
      data: {
        vendorId,
        name: name.trim(),
        description: description?.trim() || null,
        price: priceNum,
        category: category.trim(),
        imageUrl: imageUrl?.trim() || null,
        images: cleanImages,
        videoUrl: videoUrl?.trim() || null,
      },
    });

    res.status(201).json(item);
  },
);

// ─── PATCH /api/menu/:id ──────────────────────────────────────────────────────
// Update any subset of fields. Used by inline price edit and availability toggle.

router.patch(
  '/menu/:id',
  authenticateToken,
  requireRole('VENDOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, price, category, imageUrl, images, videoUrl, isAvailable } = req.body as {
      name?: string;
      description?: string | null;
      price?: number | string;
      category?: string;
      imageUrl?: string | null;
      images?: string[];
      videoUrl?: string | null;
      isAvailable?: boolean;
    };

    const item = await prisma.menuItem.findUnique({
      where: { id },
      select: { id: true, vendor: { select: { userId: true } } },
    });

    if (!item) {
      res.status(404).json({ message: 'Menu item not found.' });
      return;
    }

    if (req.user!.role === 'VENDOR' && item.vendor.userId !== req.user!.id) {
      res.status(403).json({ message: 'You do not own this item.' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined)        data.name = name.trim();
    if (description !== undefined) data.description = description?.toString().trim() || null;
    if (category !== undefined)    data.category = category.trim();
    if (imageUrl !== undefined)    data.imageUrl = imageUrl?.toString().trim() || null;
    if (videoUrl !== undefined)    data.videoUrl = videoUrl?.toString().trim() || null;
    if (Array.isArray(images))     data.images = images.map((u) => String(u).trim()).filter(Boolean);
    if (isAvailable !== undefined) data.isAvailable = Boolean(isAvailable);

    if (price !== undefined) {
      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        res.status(400).json({ message: 'price must be a non-negative number.' });
        return;
      }
      data.price = priceNum;
    }

    const updated = await prisma.menuItem.update({ where: { id }, data });
    res.json(updated);
  },
);

// ─── DELETE /api/menu/:id ─────────────────────────────────────────────────────

router.delete(
  '/menu/:id',
  authenticateToken,
  requireRole('VENDOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const item = await prisma.menuItem.findUnique({
      where: { id },
      select: { vendor: { select: { userId: true } } },
    });

    if (!item) {
      res.status(404).json({ message: 'Menu item not found.' });
      return;
    }

    if (req.user!.role === 'VENDOR' && item.vendor.userId !== req.user!.id) {
      res.status(403).json({ message: 'You do not own this item.' });
      return;
    }

    await prisma.menuItem.delete({ where: { id } });
    res.status(204).end();
  },
);

export default router;
