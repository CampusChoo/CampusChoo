// Thin Paystack wrapper. Uses Node 18+ global fetch, so no SDK dependency.
//
// All amounts here are in MAJOR units (e.g. GHS); the wrapper converts to
// pesewas (×100) before hitting Paystack.

import crypto from 'crypto';

const SECRET = process.env.PAYSTACK_SECRET_KEY ?? '';
const BASE_URL = 'https://api.paystack.co';

export function isConfigured(): boolean {
  return SECRET.length > 0 && SECRET.startsWith('sk_');
}

interface InitArgs {
  email: string;
  amount: number;        // in GHS
  reference: string;     // our own reference (must be unique per attempt)
  callbackUrl: string;   // where Paystack sends the buyer after payment
  metadata?: Record<string, unknown>;
}

interface InitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface VerifyResponse {
  status: 'success' | 'failed' | 'abandoned' | string;
  amount: number;        // in pesewas
  currency: string;
  reference: string;
  paid_at: string | null;
  channel: string | null;
  customer: { email: string };
  metadata?: Record<string, unknown> | string | null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isConfigured()) {
    throw new Error('Paystack is not configured. Set PAYSTACK_SECRET_KEY in server/.env.');
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !body.status) {
    throw new Error(`Paystack ${path}: ${body.message ?? res.statusText}`);
  }
  return body.data;
}

export async function initializeTransaction(args: InitArgs): Promise<InitResponse> {
  return call<InitResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: args.email,
      amount: Math.round(args.amount * 100), // GHS → pesewas
      reference: args.reference,
      callback_url: args.callbackUrl,
      currency: 'GHS',
      metadata: args.metadata,
    }),
  });
}

export async function verifyTransaction(reference: string): Promise<VerifyResponse> {
  return call<VerifyResponse>(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
  });
}

// Paystack signs every webhook with HMAC-SHA512 of the raw body using your
// secret key. Reject anything that doesn't match — otherwise an attacker could
// POST fake "successful payment" events.
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !SECRET) return false;
  const expected = crypto.createHmac('sha512', SECRET).update(rawBody).digest('hex');
  // Constant-time compare to avoid timing attacks.
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
