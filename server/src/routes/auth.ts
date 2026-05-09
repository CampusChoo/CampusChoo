import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import redis, { refreshKey, REFRESH_TTL_SECONDS } from '../lib/redis';
import { signAccessToken, signRefreshToken, verifyToken } from '../lib/tokens';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeUser(user: { id: string; name: string; email: string; phone: string; role: Role; level: string | null; createdAt: Date }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    level: user.level,
    createdAt: user.createdAt,
  };
}

function issueTokens(userId: string, email: string, role: Role) {
  const payload = { sub: userId, email, role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, phone, role, level } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    role?: Role;
    level?: string;
  };

  if (!name || !email || !password || !phone) {
    res.status(400).json({ message: 'name, email, password and phone are required.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ message: 'Password must be at least 6 characters.' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: 'Email already registered.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      phone,
      role: role ?? 'BUYER',
      level: level ?? null,
    },
  });

  const { accessToken, refreshToken } = issueTokens(user.id, user.email, user.role);
  await redis.set(refreshKey(user.id), refreshToken, 'EX', REFRESH_TTL_SECONDS);

  res.status(201).json({ accessToken, refreshToken, user: safeUser(user) });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: 'email and password are required.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: 'Invalid credentials.' });
    return;
  }

  const { accessToken, refreshToken } = issueTokens(user.id, user.email, user.role);
  await redis.set(refreshKey(user.id), refreshToken, 'EX', REFRESH_TTL_SECONDS);

  res.json({ accessToken, refreshToken, user: safeUser(user) });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ message: 'refreshToken is required.' });
    return;
  }

  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token.' });
    return;
  }

  const stored = await redis.get(refreshKey(payload.sub));
  if (!stored || stored !== refreshToken) {
    res.status(401).json({ message: 'Refresh token revoked or not found.' });
    return;
  }

  // Rotate: issue both a new access token and a new refresh token.
  const { accessToken, refreshToken: newRefreshToken } = issueTokens(
    payload.sub,
    payload.email,
    payload.role,
  );
  await redis.set(refreshKey(payload.sub), newRefreshToken, 'EX', REFRESH_TTL_SECONDS);

  res.json({ accessToken, refreshToken: newRefreshToken });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ message: 'refreshToken is required.' });
    return;
  }

  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch {
    // Token is already invalid — treat as logged out.
    res.status(204).send();
    return;
  }

  await redis.del(refreshKey(payload.sub));
  res.status(204).send();
});

export default router;
