import type { Role } from '@prisma/client';

// Augment Express's Request to carry the authenticated user after JWT verification.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
