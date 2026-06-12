import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// ─── GET /api/vendors ─────────────────────────────────────────────────────────
// Public list — used by the Vendors browse page.

router.get('/vendors', async (_req: Request, res: Response) => {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: [{ isOpen: 'desc' }, { rating: 'desc' }],
    });
    res.json(vendors);
  } catch (err) {
    console.error('[vendors] DB error, returning fallback vendors', err);
    // Fallback data when the database is unreachable (helps local dev)
    const fallback = [
      {
        id: 'fallback-1',
        userId: '',
        storeName: "Fallback Kitchen",
        description: 'Sample vendor (DB unavailable)',
        location: 'Local (offline)',
        imageUrl: null,
        isOpen: false,
        rating: 0,
        cuisine: [],
      },
    ];
    res.json(fallback);
  }
});

// ─── GET /api/vendors/me ──────────────────────────────────────────────────────
// Returns the vendor profile for the currently logged-in vendor user.
// Declared BEFORE any /:id route so "me" isn't matched as an id.

router.get(
  '/vendors/me',
  authenticateToken,
  requireRole('VENDOR'),
  async (req: Request, res: Response) => {
    let vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.id },
    });

    // Lazy-create: any vendor user without a Vendor row gets one materialised
    // here. Heals accounts created before the registration flow auto-created
    // the Vendor row alongside the User.
    if (!vendor) {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { name: true },
      });
      vendor = await prisma.vendor.create({
        data: {
          userId: req.user!.id,
          storeName: user?.name ? `${user.name}'s Kitchen` : 'My Store',
          description: '',
          location: '',
          cuisine: [],
          isOpen: false,
        },
      });
    }

    res.json(vendor);
  },
);

// ─── PATCH /api/vendors/:id ───────────────────────────────────────────────────
// Update editable profile fields. Vendor must own the record (admin can edit any).
// Accepts any subset of: storeName, description, location, imageUrl, cuisine.

router.patch(
  '/vendors/:id',
  authenticateToken,
  requireRole('VENDOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found.' });
      return;
    }

    if (req.user!.role === 'VENDOR' && vendor.userId !== req.user!.id) {
      res.status(403).json({ message: 'You do not own this vendor.' });
      return;
    }

    const { storeName, description, location, imageUrl, cuisine } = req.body ?? {};
    const data: Record<string, unknown> = {};

    if (typeof storeName === 'string' && storeName.trim().length > 0) {
      data.storeName = storeName.trim();
    }
    if (typeof description === 'string') data.description = description;
    if (typeof location === 'string') data.location = location;
    if (imageUrl === null || typeof imageUrl === 'string') data.imageUrl = imageUrl;
    if (Array.isArray(cuisine)) {
      data.cuisine = cuisine.filter((c) => typeof c === 'string' && c.trim().length > 0);
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ message: 'No editable fields supplied.' });
      return;
    }

    const updated = await prisma.vendor.update({ where: { id }, data });
    res.json(updated);
  },
);

// ─── PATCH /api/vendors/:id/toggle ────────────────────────────────────────────
// Flips isOpen. Vendor must own the record (admin can toggle any).

router.patch(
  '/vendors/:id/toggle',
  authenticateToken,
  requireRole('VENDOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found.' });
      return;
    }

    if (req.user!.role === 'VENDOR' && vendor.userId !== req.user!.id) {
      res.status(403).json({ message: 'You do not own this vendor.' });
      return;
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: { isOpen: !vendor.isOpen },
    });

    res.json(updated);
  },
);

export default router;
