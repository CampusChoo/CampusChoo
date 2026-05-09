import { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { verifyToken } from '../lib/tokens';

// ─── authenticateToken ────────────────────────────────────────────────────────
// Reads the Bearer token from Authorization header, verifies it, and attaches
// { id, email, role } to req.user. Responds 401 on any failure.

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization header missing or malformed.' });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (err: unknown) {
    const expired = err instanceof Error && err.name === 'TokenExpiredError';
    res.status(401).json({ message: expired ? 'Access token expired.' : 'Invalid access token.' });
  }
}

// ─── requireRole ──────────────────────────────────────────────────────────────
// Must be used after authenticateToken. Returns 403 if req.user.role is not
// in the allowed list.
//
// Usage:
//   router.delete('/vendor/:id', authenticateToken, requireRole('ADMIN'), handler)

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
      return;
    }

    next();
  };
}
