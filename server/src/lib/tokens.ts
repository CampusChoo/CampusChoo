import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

export interface TokenPayload {
  sub: string;   // userId
  email: string;
  role: Role;
}

const secret = (): string => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
};

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: '15m' });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, secret()) as TokenPayload;
}
