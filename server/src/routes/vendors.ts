import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// ─── GET /api/vendors ─────────────────────────────────────────────────────────
// Public list — used by the Vendors browse page.

router.get('/vendors', async (_req: Request, res: Response) => {
  const vendors = await prisma.vendor.findMany({
    orderBy: [{ isOpen: 'desc' }, { rating: 'desc' }],
  });
  res.json(vendors);
});

// ─── GET /api/vendors/me ──────────────────────────────────────────────────────
// Returns the vendor profile for the currently logged-in vendor user.
// Declared BEFORE any /:id route so "me" isn't matched as an id.

router.get(
  '/vendors/me',
  authenticateToken,
  requireRole('VENDOR'),
  async (req: Request, res: Response) => {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.id },
    });
    if (!vendor) {
      res.status(404).json({ message: 'No vendor profile linked to this account.' });
      return;
    }
    res.json(vendor);
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
