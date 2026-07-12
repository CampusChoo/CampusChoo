import { createClient } from '@supabase/supabase-js';

type Role = 'BUYER' | 'VENDOR' | 'ADMIN';
type TokenPayload = { sub: string; email: string; role: Role; exp?: number };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_KEY') ?? '';
const JWT_SECRET = Deno.env.get('JWT_SECRET') ?? '';
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const RECAPTCHA_SECRET_KEY = Deno.env.get('RECAPTCHA_SECRET_KEY') ?? '';
const CLIENT_BASE_URL = Deno.env.get('CLIENT_BASE_URL') ?? 'http://localhost:3000';
const SMS_API = Deno.env.get('SMS_API') ?? '';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? '';
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') ?? '';
const ADMIN_PHONE = Deno.env.get('ADMIN_PHONE') ?? '';
const BMS_SMS_URL = 'https://api.mnotify.com/api/sms/quick';

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) return String((err as any).message);
  return 'Internal server error.';
}

function assertEnv(name: string, value: string) {
  if (!value) {
    console.error(`Supabase function missing required env var: ${name}`);
  }
}

assertEnv('SUPABASE_URL', SUPABASE_URL);
assertEnv('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY', SERVICE_KEY);
assertEnv('JWT_SECRET', JWT_SECRET);

async function verifyRecaptcha(token: string | undefined, remoteIp: string | null) {
  const testSecret = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
  if (!token) return { ok: false, message: 'Please complete the reCAPTCHA challenge.' };
  if (!RECAPTCHA_SECRET_KEY) {
    return { ok: false, message: 'reCAPTCHA is not configured on the server.' };
  }

  const body = new URLSearchParams({
    secret: RECAPTCHA_SECRET_KEY,
    response: token,
  });
  if (remoteIp) body.set('remoteip', remoteIp);

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({})) as { success?: boolean; 'error-codes'?: string[] };
  if (data.success || RECAPTCHA_SECRET_KEY === testSecret) return { ok: true };

  const codes = data['error-codes']?.join(', ');
  return { ok: false, message: codes ? `reCAPTCHA failed: ${codes}` : 'reCAPTCHA verification failed.' };
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function empty(status = 204) {
  return new Response(null, { status, headers: corsHeaders });
}

async function bodyJson<T>(req: Request): Promise<T> {
  return await req.json().catch(() => ({})) as T;
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlJson(data: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(data)));
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  return atob(padded);
}

async function hmac(message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

async function signJwt(payload: Omit<TokenPayload, 'exp'>, ttlSeconds: number) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not set');
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlJson({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${base64Url(await hmac(unsigned))}`;
}

async function verifyJwt(token: string): Promise<TokenPayload> {
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) throw new Error('Malformed token');
  const expected = base64Url(await hmac(`${header}.${body}`));
  if (expected !== signature) throw new Error('Invalid signature');
  const payload = JSON.parse(decodeBase64Url(body)) as TokenPayload;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

async function currentUser(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) throw new Response('Unauthorized', { status: 401 });
  const payload = await verifyJwt(auth.slice(7));
  return { id: payload.sub, email: payload.email, role: payload.role };
}

function requireRole(user: { role: Role }, ...roles: Role[]) {
  if (!roles.includes(user.role)) throw new Response('Forbidden', { status: 403 });
}

async function issueTokens(user: { id: string; email: string; role: Role }) {
  const payload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = await signJwt(payload, 15 * 60);
  const refreshToken = await signJwt(payload, 7 * 24 * 60 * 60);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('refresh_token').upsert({
    userId: user.id,
    token: refreshToken,
    expiresAt,
  });
  if (error) throw error;
  return { accessToken, refreshToken };
}

function safeUser(user: Record<string, unknown>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    level: user.level ?? null,
    createdAt: user.createdAt,
  };
}

function formatOrder<T extends Record<string, unknown> | null>(order: T): T {
  if (!order) return order;
  const row = { ...order } as Record<string, unknown>;
  row.items = row.items ?? row.orderItem ?? [];
  row.buyer = row.buyer ?? row.user ?? null;
  delete row.orderItem;
  delete row.user;
  return row as T;
}

function formatOrders<T extends Record<string, unknown>>(orders: T[] | null): T[] {
  return (orders ?? []).map((order) => formatOrder(order));
}

function normalizePath(req: Request) {
  const url = new URL(req.url);
  let path = url.pathname;
  path = path.replace(/^\/functions\/v1\/api/, '');
  path = path.replace(/^\/api/, '');
  return { url, path: path || '/' };
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 120000;
  const derived = await derivePasswordKey(password, salt, iterations);
  return [`pbkdf2_sha256`, String(iterations), toBase64(salt), toBase64(derived)].join('$');
}

function constantTimeCompare(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

async function passwordMatches(password: string, passwordHash: string) {
  const [scheme, iterationsRaw, salt64, hash64] = passwordHash.split('$');
  if (scheme !== 'pbkdf2_sha256' || !iterationsRaw || !salt64 || !hash64) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64(salt64);
  const expected = fromBase64(hash64);
  const derived = await derivePasswordKey(password, salt, iterations);
  return constantTimeCompare(derived, expected);
}

async function ensureAdminUser() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_PHONE) throw new Error('Admin account is not configured.');
  const { data: existing, error: existingErr } = await supabase.from('user').select('*').eq('email', ADMIN_EMAIL).maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) {
    if (existing.role !== 'ADMIN') {
      throw new Error('Admin email is already in use by a non-admin account.');
    }
    return existing;
  }
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const { data: created, error: createErr } = await supabase.from('user').insert({
    name: 'CampusChoo Admin',
    email: ADMIN_EMAIL,
    passwordHash,
    phone: ADMIN_PHONE,
    role: 'ADMIN',
  }).select().maybeSingle();
  if (createErr || !created) throw createErr ?? new Error('Failed to create admin account.');
  return created;
}


async function sendSms(to: string, message: string) {
  if (!SMS_API) {
    throw new Error('SMS_API is not configured.');
  }
  const cleanPhone = to.replace(/^\+/, '').trim();
  const url = `${BMS_SMS_URL}?key=${encodeURIComponent(SMS_API)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: 'campuschoo',
      recipient: [cleanPhone],
      recipients: [cleanPhone], // fallback
      message,
      is_schedule: false,
      schedule_date: '',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`BMS SMS failed (${res.status}): ${body || res.statusText}`);
  }
}

function sendSmsQuietly(to: string, message: string) {
  sendSms(to, message).catch((err) => {
    console.error('Failed to send SMS notification', err);
  });
}

async function paystack<T>(path: string, init: RequestInit = {}) {
  if (!PAYSTACK_SECRET_KEY.startsWith('sk_')) throw new Error('Paystack is not configured.');
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json() as { status: boolean; message: string; data: T };
  if (!res.ok || !body.status) throw new Error(body.message ?? 'Paystack request failed.');
  return body.data;
}

async function initializePayment(args: {
  email: string;
  amount: number;
  reference: string;
  orderId: string;
  buyerId: string;
}) {
  return await paystack<{ authorization_url: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: args.email,
      amount: Math.round(args.amount * 100),
      reference: args.reference,
      callback_url: `${CLIENT_BASE_URL.replace(/\/$/, '')}/track/${encodeURIComponent(args.orderId)}`,
      currency: 'GHS',
      metadata: { orderId: args.orderId, buyerId: args.buyerId },
    }),
  });
}

async function routeAuth(req: Request, path: string) {
  if (req.method === 'POST' && path === '/auth/register') {
    const { name, email, password, phone, role, level, storeName, captchaToken } = await bodyJson<Record<string, string>>(req);
    if (!name || !email || !password || !phone) return json({ message: 'name, email, password and phone are required.' }, 400);
    if (password.length < 6) return json({ message: 'Password must be at least 6 characters.' }, 400);
    const captcha = await verifyRecaptcha(captchaToken, req.headers.get('x-forwarded-for'));
    if (!captcha.ok) return json({ message: captcha.message }, 400);

    const { data: existing, error: existingErr } = await supabase.from('user').select('id').eq('email', email).maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) return json({ message: 'Email already registered.' }, 409);

    const finalRole = ((role as Role) || 'BUYER') as Role;
    const passwordHash = await hashPassword(password);
    const { data: user, error } = await supabase.from('user').insert({
      name,
      email,
      passwordHash,
      phone,
      role: finalRole,
      level: level ?? null,
    }).select().maybeSingle();
    if (error || !user) throw error ?? new Error('Failed to create user.');

    if (finalRole === 'VENDOR') {
      const { error: vendorErr } = await supabase.from('vendor').insert({
        userId: user.id,
        storeName: storeName?.trim() || `${name}'s Kitchen`,
        description: '',
        location: '',
        cuisine: [],
        isOpen: false,
      });
      if (vendorErr) {
        await supabase.from('user').delete().eq('id', user.id);
        throw vendorErr;
      }
    }

    return json({ ...(await issueTokens(user)), user: safeUser(user) }, 201);
  }

  if (req.method === 'POST' && path === '/auth/login') {
    const { email, password } = await bodyJson<{ email?: string; password?: string }>(req);
    if (!email || !password) return json({ message: 'email and password are required.' }, 400);
    const { data: user, error } = await supabase.from('user').select('*').eq('email', email).maybeSingle();
    if (error) throw error;
    if (!user || !(await passwordMatches(password, user.passwordHash))) return json({ message: 'Invalid credentials.' }, 401);
    return json({ ...(await issueTokens(user)), user: safeUser(user) });
  }

  if (req.method === 'POST' && path === '/auth/refresh') {
    const { refreshToken } = await bodyJson<{ refreshToken?: string }>(req);
    if (!refreshToken) return json({ message: 'refreshToken is required.' }, 400);
    let payload: TokenPayload;
    try {
      payload = await verifyJwt(refreshToken);
    } catch {
      return json({ message: 'Invalid or expired refresh token.' }, 401);
    }
    const { data: stored } = await supabase.from('refresh_token').select('*').eq('userId', payload.sub).maybeSingle();
    if (!stored || stored.token !== refreshToken || new Date(stored.expiresAt).getTime() < Date.now()) {
      return json({ message: 'Refresh token revoked or not found.' }, 401);
    }
    return json(await issueTokens({ id: payload.sub, email: payload.email, role: payload.role }));
  }

  if (req.method === 'POST' && path === '/auth/logout') {
    const { refreshToken } = await bodyJson<{ refreshToken?: string }>(req);
    if (!refreshToken) return json({ message: 'refreshToken is required.' }, 400);
    try {
      const payload = await verifyJwt(refreshToken);
      await supabase.from('refresh_token').delete().eq('userId', payload.sub);
    } catch {
      return empty();
    }
    return empty();
  }

  if (req.method === 'POST' && path === '/auth/google') {
    if (!GOOGLE_CLIENT_ID) return json({ message: 'Google sign-in is not configured.' }, 503);
    const { idToken } = await bodyJson<{ idToken?: string }>(req);
    if (!idToken) return json({ message: 'idToken is required.' }, 400);
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!verifyRes.ok) return json({ message: 'Invalid Google ID token.' }, 401);
    const google = await verifyRes.json() as { email?: string; email_verified?: string; aud?: string; name?: string };
    if (google.aud !== GOOGLE_CLIENT_ID || !google.email || google.email_verified !== 'true') {
      return json({ message: 'Invalid Google account.' }, 401);
    }

    let { data: user, error } = await supabase.from('user').select('*').eq('email', google.email).maybeSingle();
    if (error) throw error;
    if (!user) {
      const { data: created, error: createErr } = await supabase.from('user').insert({
        name: google.name || google.email.split('@')[0],
        email: google.email,
        passwordHash: await hashPassword(crypto.randomUUID()),
        phone: '',
        role: 'BUYER',
      }).select().maybeSingle();
      if (createErr || !created) throw createErr ?? new Error('Failed to create user.');
      user = created;
    }
    return json({ ...(await issueTokens(user)), user: safeUser(user) });
  }

  if (req.method === 'POST' && path === '/auth/forgot-password') {
    const { phone } = await bodyJson<{ phone?: string }>(req);
    if (!phone) return json({ message: 'phone is required.' }, 400);

    const cleanPhone = phone.replace(/^\+/, '').trim();
    // Lookup user by phone (allowing local or international prefixed formats)
    const { data: user, error: userErr } = await supabase.from('user')
      .select('*')
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return json({ message: 'No account registered with this phone number.' }, 404);

    // Rate Limiting: Check if there's a code generated in the last 60 seconds
    const { data: existingOtp, error: existingErr } = await supabase.from('password_reset_otp').select('*').eq('email', user.email).maybeSingle();
    if (existingErr) throw existingErr;
    if (existingOtp) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < 60 * 1000) {
        const waitTime = Math.ceil((60 * 1000 - elapsed) / 1000);
        return json({ message: `Please wait ${waitTime} seconds before requesting another code.` }, 429);
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes expiry

    const { error: upsertErr } = await supabase.from('password_reset_otp').upsert({ email: user.email, code, expiresAt, createdAt: new Date().toISOString() });
    if (upsertErr) {
      console.error('Failed to store password reset OTP', upsertErr);
      return json({ message: 'Failed to generate code.' }, 500);
    }

    try {
      const message = `Your CampusChoo password reset code is ${code}. It expires in 10 minutes.`;
      await sendSms(user.phone, message);
    } catch (e) {
      console.error('Failed to send password reset SMS', e);
      return json({ message: errorMessage(e) }, 502);
    }

    return json({ ok: true, email: user.email });
  }

  if (req.method === 'POST' && path === '/auth/reset-password') {
    const { email, code, newPassword } = await bodyJson<{ email?: string; code?: string; newPassword?: string }>(req);
    if (!email || !code || !newPassword) {
      return json({ message: 'email, code and newPassword are required.' }, 400);
    }
    if (newPassword.length < 6) {
      return json({ message: 'Password must be at least 6 characters.' }, 400);
    }

    const { data: otp, error: otpErr } = await supabase.from('password_reset_otp').select('*').eq('email', email.trim()).maybeSingle();
    if (otpErr) throw otpErr;
    if (!otp || otp.code !== code.trim() || new Date(otp.expiresAt).getTime() < Date.now()) {
      return json({ message: 'Invalid or expired verification code.' }, 401);
    }

    // Update password
    const passwordHash = await hashPassword(newPassword);
    const { error: userErr } = await supabase.from('user').update({ passwordHash }).eq('email', email.trim());
    if (userErr) throw userErr;

    // Delete used OTP
    await supabase.from('password_reset_otp').delete().eq('email', email.trim());

    return json({ ok: true });
  }

  return null;
}

async function routeAdmin(req: Request, path: string) {
  if (req.method === 'POST' && path === '/seed') {
    const body = await bodyJson<{ key?: string }>(req);
    const expectedKey = Deno.env.get('SEED_KEY');
    
    if (!expectedKey || body.key !== expectedKey) {
      return json({ message: 'Unauthorized. SEED_KEY mismatch.' }, 403);
    }

    try {
      const rows = [
        { name: 'JUMOR KINGS', phone: '242925350', hours: '7:00am-9:00pm', location: 'UMaT, Tarkwa - Halls', img: '/food/kenkey.webp', items: [
          { name: 'Kenkey', price: 7, cat: 'Mains' },
          { name: 'Fish', price: 10, cat: 'Proteins' },
          { name: 'Chicken', price: 10, cat: 'Proteins' },
          { name: 'Egg', price: 3.5, cat: 'Proteins' },
          { name: 'Sausage (Small)', price: 5, cat: 'Sides' },
          { name: 'Sausage (Big)', price: 8, cat: 'Sides' },
          { name: 'Okro Soup', price: 5, cat: 'Soups' },
          { name: 'Wele', price: 5, cat: 'Proteins' },
          { name: 'Beef', price: 5, cat: 'Proteins' },
        ]},
        { name: "ANTIE AMA'S GOB3", phone: '248448793', hours: '7.00am-4.00pm', location: 'UMaT, Tarkwa - SRC Cafeteria', img: '/food/gob3.webp', items: [
          { name: 'Gob3', price: 6, cat: 'Mains' },
          { name: 'Plain Rice', price: 5, cat: 'Mains' },
          { name: 'Plantain', price: 1, cat: 'Sides' },
          { name: 'Sausage', price: 6, cat: 'Proteins' },
          { name: 'Egg', price: 4, cat: 'Proteins' },
          { name: 'Pear (Pawpaw)', price: 4, cat: 'Sides' },
        ]},
        { name: 'FASTMAH', phone: '543499282', hours: '7:30AM-6:00PM', location: 'UMaT, Tarkwa - Faculty Block', img: '/food/waakye.webp', items: [
          { name: 'Waakye (Rice)', price: 8, cat: 'Mains' },
          { name: 'Waakye Fish', price: 7, cat: 'Proteins' },
          { name: 'Waakye Chicken (Small)', price: 10, cat: 'Proteins' },
          { name: 'Waakye Chicken (Large)', price: 15, cat: 'Proteins' },
          { name: 'Waakye Egg', price: 4, cat: 'Proteins' },
          { name: 'Waakye Sausage', price: 4, cat: 'Sides' },
          { name: 'Gob3', price: 8, cat: 'Mains' },
          { name: 'Fried Rice', price: 10, cat: 'Mains' },
          { name: 'Jollof Rice', price: 10, cat: 'Mains' },
          { name: 'Kokonte', price: 5, cat: 'Mains' },
          { name: 'Banku', price: 5, cat: 'Mains' },
          { name: 'TZ', price: 5, cat: 'Mains' },
        ]},
        { name: "MAKARIOS RESTURANT", phone: '246553515', hours: '9:30AM-10:00PM', location: 'UMaT, Tarkwa - Main Campus', img: '/food/jollof.jpg', items: [
          { name: 'Fried Rice', price: 35, cat: 'Mains' },
          { name: 'Jollof Rice', price: 35, cat: 'Mains' },
          { name: 'Banku & Tilapia', price: 40, cat: 'Combos' },
          { name: 'Shawarma', price: 40, cat: 'Snacks' },
        ]},
        { name: "CATHERINE'S KITCHEN", phone: '53569944', hours: '8:30AM-1:00AM', location: 'UMaT, Tarkwa - Halls', img: '/food/kenkey.webp', items: [
          { name: 'Kenkey', price: 5, cat: 'Mains' },
          { name: 'Fish', price: 10, cat: 'Proteins' },
          { name: 'Shrimps', price: 10, cat: 'Proteins' },
          { name: 'Egg', price: 5, cat: 'Proteins' },
          { name: 'Sausage', price: 5, cat: 'Sides' },
          { name: 'Okro Soup', price: 5, cat: 'Soups' },
          { name: 'Wele', price: 5, cat: 'Proteins' },
          { name: 'Beef', price: 5, cat: 'Proteins' },
          { name: 'Oily Rice', price: 10, cat: 'Mains' },
          { name: 'Fried Yam', price: 5, cat: 'Sides' },
          { name: 'Banku', price: 5, cat: 'Mains' },
          { name: 'Kokonte', price: 5, cat: 'Mains' },
        ]},
        { name: "TINAD'S VENTURES", phone: '597581342', hours: '2:00PM-11:00PM', location: 'UMaT, Tarkwa - Hostel Area', img: '/food/OIP (1).webp', items: [
          { name: 'Indomie', price: 30, cat: 'Mains' },
          { name: 'Spaghetti', price: 30, cat: 'Mains' },
          { name: 'Ice Cream', price: 5, cat: 'Desserts' },
        ]},
        { name: 'FOCUS', phone: '550195460', hours: '7:30AM-11:00PM', location: 'UMaT, Tarkwa - Lecture Courts', img: '/food/waakye.webp', items: [
          { name: 'Chek Chek', price: 35, cat: 'Mains' },
          { name: 'Jollof Rice (+Sausage/Egg/Chicken)', price: 35, cat: 'Mains' },
          { name: 'Waakye Package', price: 25, cat: 'Combos' },
          { name: 'Waakye (Rice)', price: 10, cat: 'Mains' },
          { name: 'Fried Rice', price: 50, cat: 'Mains' },
          { name: 'Assorted Fried Rice', price: 50, cat: 'Mains' },
          { name: 'Chicken', price: 10, cat: 'Proteins' },
          { name: 'Egg', price: 4, cat: 'Proteins' },
          { name: 'Sausage', price: 4, cat: 'Sides' },
          { name: 'Wele', price: 50, cat: 'Proteins' },
          { name: 'Salad', price: 5, cat: 'Sides' },
          { name: 'Spag & Gari', price: 5, cat: 'Snacks' },
          { name: 'Plantain', price: 5, cat: 'Sides' },
          { name: 'Pear', price: 5, cat: 'Sides' },
        ]},
        { name: 'CHEF ONE', phone: '530506391', hours: '12:00PM-12:00AM', location: 'UMaT, Tarkwa - Food Court', img: '/food/waakye.webp', items: [
          { name: 'Fried Rice', price: 30, cat: 'Mains' },
          { name: 'Jollof Rice', price: 30, cat: 'Mains' },
          { name: 'Indomie', price: 30, cat: 'Mains' },
          { name: 'Banku with Okro/Soup/Pepper', price: 30, cat: 'Combos' },
          { name: 'Banku with Tilapia', price: 100, cat: 'Combos' },
          { name: 'Emo Tuo with Groundnut Soup', price: 30, cat: 'Combos' },
          { name: 'Fufu with Soup (Sundays)', price: 40, cat: 'Combos' },
        ]},
        { name: "ENO'S KITCHEN", phone: '244074521', hours: '11:00AM-12:00AM', location: 'UMaT, Tarkwa - Hostel Jct', img: '/food/fufu.jpg', items: [
          { name: 'Fried Rice', price: 30, cat: 'Mains' },
          { name: 'Jollof Rice', price: 40, cat: 'Mains' },
          { name: 'Banku', price: 5, cat: 'Mains' },
          { name: 'Emo Tuo', price: 5, cat: 'Mains' },
          { name: 'Chicken', price: 15, cat: 'Proteins' },
          { name: 'Wele', price: 5, cat: 'Proteins' },
          { name: 'Fish', price: 15, cat: 'Proteins' },
          { name: 'Sausage', price: 5, cat: 'Sides' },
          { name: 'Towel (Meat)', price: 5, cat: 'Proteins' },
          { name: 'Beef', price: 6, cat: 'Proteins' },
          { name: 'Eggs', price: 3.5, cat: 'Proteins' },
          { name: 'Light Soup', price: 0, cat: 'Soups' },
          { name: 'Groundnut Soup', price: 0, cat: 'Soups' },
        ]},
        { name: "XANAB'S SPECIAL MEALS", phone: '244734333', hours: '9:00AM-6:00PM', location: 'UMaT, Tarkwa - Staff Quarters', img: '/food/fufu.jpg', items: [
          { name: 'Banku', price: 5, cat: 'Mains' },
          { name: 'TZ (Tuo Zaafi)', price: 5, cat: 'Mains' },
          { name: 'Emo Tuo', price: 5, cat: 'Mains' },
          { name: 'Abetsie', price: 5, cat: 'Mains' },
          { name: 'Palm Nut Soup', price: 0, cat: 'Soups' },
          { name: 'Ayoyo Soup', price: 0, cat: 'Soups' },
          { name: 'Groundnut Soup', price: 0, cat: 'Soups' },
          { name: 'Fish', price: 5, cat: 'Proteins' },
          { name: 'Egg', price: 3, cat: 'Proteins' },
          { name: 'Towel', price: 5, cat: 'Proteins' },
          { name: 'Chicken Wings', price: 10, cat: 'Proteins' },
          { name: 'Kotodwe', price: 15, cat: 'Proteins' },
          { name: 'Wele', price: 5, cat: 'Proteins' },
          { name: 'Beef', price: 5, cat: 'Proteins' },
          { name: 'Gob3', price: 5, cat: 'Mains' },
          { name: 'Plain Rice', price: 5, cat: 'Mains' },
          { name: 'Plantain', price: 2, cat: 'Sides' },
        ]},
        { name: "MONICA'S FINEST PASTRY", phone: '530518207', hours: '7:00AM-2:00PM', location: 'UMaT, Tarkwa - Halls', img: '/food/th.webp', items: [
          { name: 'Waakye (Rice)', price: 10, cat: 'Mains' },
          { name: 'Waakye Fish', price: 10, cat: 'Proteins' },
          { name: 'Waakye Chicken', price: 10, cat: 'Proteins' },
          { name: 'Waakye Egg', price: 4, cat: 'Proteins' },
          { name: 'Waakye Sausage', price: 5, cat: 'Sides' },
          { name: 'Waakye T Towel', price: 10, cat: 'Proteins' },
          { name: 'Waakye Salad/Gari/Macroni', price: 5, cat: 'Sides' },
          { name: 'Waakye Plantain', price: 1, cat: 'Sides' },
          { name: 'Kenkey', price: 5, cat: 'Mains' },
          { name: 'Kenkey Fish', price: 10, cat: 'Proteins' },
          { name: 'Kenkey Chicken', price: 10, cat: 'Proteins' },
          { name: 'Kenkey Egg', price: 4, cat: 'Proteins' },
          { name: 'Kenkey Sausage', price: 5, cat: 'Sides' },
          { name: 'Kenkey T Towel', price: 10, cat: 'Proteins' },
          { name: 'Kenkey Okro', price: 5, cat: 'Soups' },
        ]},
      ];

      const FOOD_IMG_MAP: Record<string, string> = {
        'kenkey':    '/food/kenkey.webp',
        'jollof':    '/food/jollof.jpg',
        'fufu':      '/food/fufu.jpg',
        'fufu-soup': '/food/fufu-soup.webp',
        'banku':     '/food/banku-tilapia.jpg',
        'gob3':      '/food/gob3.webp',
        'waakye':    '/food/waakye.webp',
        'waakye-pkg':'/food/waakye-package.webp',
        'tilapia':   '/food/banku-tilapia.jpg',
        'rice':      '/food/jollof.jpg',
        'fried-rice':'/food/fried-rice.webp',
        'assorted-rice':'/food/assorted-fried-rice.webp',
        'indomie':   '/food/indomie.webp',
        'spaghetti': '/food/spaghetti.webp',
        'shrimp':    '/food/fish.webp',
        'egg':       '/food/egg.webp',
        'sausage':   '/food/sausage.webp',
        'chicken':   '/food/chicken.webp',
        'fish':      '/food/fish.webp',
        'yam':       '/food/fried-yam.webp',
        'beef':      '/food/beef.webp',
        'ice cream': '/food/download (3).webp',
        'shwarma':   '/food/shawarma.webp',
        'plantain':  '/food/plantain.webp',
        'pear':      '/food/pear.webp',
        'soup':      '/food/okro-soup.webp',
        'emo tuo':   '/food/emo-tuo.webp',
        'tz':        '/food/tz.webp',
        'okro':      '/food/okro-soup.webp',
        'tilapia-combo': '/food/banku-tilapia.webp',
        'default':   '/food/jollof.jpg',
      };

      function coverImg(cat: string, name: string, fallback: string): string {
        const lc = (cat + ' ' + name).toLowerCase();
        const keys = Object.keys(FOOD_IMG_MAP).sort((a, b) => b.length - a.length);
        for (const k of keys) {
          if (lc.includes(k)) return FOOD_IMG_MAP[k];
        }
        return fallback;
      }

      const results: Record<string, { userId: string; vendorId: string; inserted: number }> = {};

      for (const row of rows) {
        const { data: user, error: userErr } = await supabase
          .from('user')
          .insert({
            name: row.name,
            email: `vendor+${Math.round(Math.random() * 1e9)}@campuschoo.app`,
            passwordHash: '$pbkdf2-sha256$120000$' + Array.from(crypto.getRandomValues(new Uint8Array(22))).map(b => String.fromCharCode(33 + (b % 94))).join(''),
            phone: '+233' + row.phone.replace(/^0+/, ''),
            role: 'VENDOR',
          })
          .select()
          .single();
        if (userErr) { console.error('user err', row.name, userErr.message); continue; }

        const { data: vendor, error: vendorErr } = await supabase
          .from('vendor')
          .insert({
            userId: user.id,
            storeName: row.name,
            description: `${row.name} — ${row.hours}`,
            location: row.location,
            imageUrl: row.img,
            isOpen: true,
            rating: 4 + Math.floor(Math.random() * 15) / 10,
            cuisine: [],
          })
          .select()
          .single();
        if (vendorErr) { console.error('vendor err', row.name, vendorErr.message); continue; }

        const menuItems = row.items.map(it => ({
          name: it.name,
          description: '',
          price: it.price,
          category: it.cat,
          imageUrl: coverImg(it.cat, it.name, row.img),
          isAvailable: true,
          vendorId: vendor.id,
        }));

        const { data: inserted, error: menuErr } = await supabase
          .from('menuItem')
          .insert(menuItems)
          .select();
        if (menuErr) console.error('menu err', row.name, menuErr.message);

        results[row.name] = { userId: user.id, vendorId: vendor.id, inserted: inserted?.length ?? 0 };
      }

      return json({ ok: true, seeded: results }, 200);
    } catch (err) {
      console.error('Seed error:', err);
      return json({ message: 'Seed failed.', error: String(err) }, 500);
    }
  }

  if (req.method === 'POST' && path === '/seed/categories') {
    const body = await bodyJson<{ key?: string }>(req);
    const expectedKey = Deno.env.get('SEED_KEY');

    if (!expectedKey || body.key !== expectedKey) {
      return json({ message: 'Unauthorized. SEED_KEY mismatch.' }, 403);
    }

    try {
      const CATEGORY_INFO: Record<string, { emoji: string; img: string; desc: string }> = {
        'Mains':    { emoji: '🍚', img: '/food/jollof.jpg',       desc: 'Staple dishes — rice, banku, kokonte, fufu.' },
        'Sides':    { emoji: '🍌', img: '/food/OIP.webp',        desc: 'Side orders — plantain, gari, sausage.' },
        'Soups':    { emoji: '🍲', img: '/food/gob3.webp',       desc: 'Freshly cooked soups — okro, palmnut, groundnut.' },
        'Drinks':   { emoji: '🥤', img: '/food/download (1).webp', desc: 'Soft drinks, juices & chilled beverages.' },
        'Snacks':   { emoji: '🍕', img: '/food/download.webp',   desc: 'Pastries, shawarma, spring rolls & more.' },
        'Desserts': { emoji: '🍦', img: '/food/download (3).webp', desc: 'Ice cream, cake & sweet treats.' },
        'Proteins': { emoji: '🍗', img: '/food/waakye.webp',    desc: 'Grilled fish, chicken, beef, eggs.' },
        'Combos':   { emoji: '🍱', img: '/food/kenkey.webp',    desc: 'Full meal combos with soup or stew.' },
        'Breakfast':{ emoji: '🥚', img: '/food/th.webp',         desc: 'Morning meals — yam, eggs, tea.' },
      };

      const results: Record<string, string> = {};
      for (const [cat, info] of Object.entries(CATEGORY_INFO)) {
        const { data, error } = await supabase
          .from('category')
          .upsert({ name: cat, emoji: info.emoji, imageUrl: info.img, description: info.desc }, { onConflict: 'name' })
          .select()
          .single();
        results[cat] = error ? `ERROR: ${error.message}` : (data?.id ?? 'ok');
      }
      return json({ ok: true, categories: results }, 200);
    } catch (err) {
      console.error('Category seed error:', err);
      return json({ message: 'Category seed failed.', error: String(err) }, 500);
    }
  }
  if (req.method === 'POST' && path === '/admin/request-code') {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_PHONE || !SMS_API) {
      return json({ message: 'Admin login is not configured.' }, 503);
    }
    const { email, password } = await bodyJson<{ email?: string; password?: string }>(req);
    if (!email || !password) return json({ message: 'email and password are required.' }, 400);
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return json({ message: 'Invalid admin credentials.' }, 401);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error } = await supabase.from('admin_otp').upsert({ email, code, expiresAt }).select();
    if (error) {
      console.error('Failed to store admin OTP', error);
      return json({ message: 'Failed to generate code.' }, 500);
    }

    // send SMS to configured admin phone
    try {
      const message = `Your CampusChoo admin verification code is ${code}. It expires in 5 minutes.`;
      await sendSms(ADMIN_PHONE, message);
    } catch (e) {
      console.error('Failed to send admin SMS', e);
      return json({ message: errorMessage(e) }, 502);
    }

    return json({ ok: true });
  }

  if (req.method === 'POST' && path === '/admin/verify') {
    const { email, code } = await bodyJson<{ email?: string; code?: string }>(req);
    if (!email || !code) return json({ message: 'email and code are required.' }, 400);
    const { data, error } = await supabase.from('admin_otp').select('*').eq('email', email).maybeSingle();
    if (error) {
      console.error('Failed to query admin OTP', error);
      return json({ message: 'Verification failed.' }, 500);
    }
    if (!data || data.code !== code || new Date(data.expiresAt).getTime() < Date.now()) {
      return json({ message: 'Invalid or expired code.' }, 401);
    }

    // delete used code
    await supabase.from('admin_otp').delete().eq('email', email);

    // Issue an access token for the admin (no refresh token)
    const payload = { sub: `admin:${email}`, email, role: 'ADMIN' as Role };
    const accessToken = await signJwt(payload, 60 * 60); // 1 hour
    const user = { id: `admin:${email}`, name: 'Admin', email, phone: ADMIN_PHONE, role: 'ADMIN', level: null, createdAt: new Date().toISOString() };
    return json({ accessToken, user }, 200);
  }

  // SECURE ADMIN MANAGEMENT ROUTES
  if (path.startsWith('/admin')) {
    let user;
    try {
      user = await currentUser(req);
    } catch {
      return json({ message: 'Not authenticated.' }, 401);
    }
    if (user.role !== 'ADMIN') {
      return json({ message: 'Forbidden: admin access required.' }, 403);
    }

    if (req.method === 'GET' && path === '/admin/stats') {
      const { count: usersCount } = await supabase.from('user').select('*', { count: 'exact', head: true });
      const { count: vendorsCount } = await supabase.from('vendor').select('*', { count: 'exact', head: true });
      const { data: orders } = await supabase.from('order').select('totalAmount, status');
      
      const ordersCount = orders?.length ?? 0;
      const totalRevenue = orders
        ?.filter(o => o.status === 'DELIVERED')
        ?.reduce((sum, o) => sum + Number(o.totalAmount), 0) ?? 0;

      return json({
        usersCount: usersCount ?? 0,
        vendorsCount: vendorsCount ?? 0,
        ordersCount,
        totalRevenue,
      });
    }

    if (req.method === 'GET' && path === '/admin/users') {
      const { data, error } = await supabase.from('user').select('*').order('createdAt', { ascending: false });
      if (error) throw error;
      return json((data ?? []).map(safeUser));
    }

    if (req.method === 'GET' && path === '/admin/vendors') {
      const { data, error } = await supabase.from('vendor').select('*, user(email, phone)');
      if (error) throw error;
      return json(data ?? []);
    }

    if (req.method === 'GET' && path === '/admin/orders') {
      const { data, error } = await supabase.from('order')
        .select('*, orderItem(menuItem(name, price)), vendor(storeName), user(name, phone)')
        .order('createdAt', { ascending: false });
      if (error) throw error;
      return json(formatOrders(data ?? []));
    }

    const matchUserRole = path.match(/^\/admin\/users\/([^/]+)\/role$/);
    if (req.method === 'PATCH' && matchUserRole) {
      const userId = matchUserRole[1];
      const { role } = await bodyJson<{ role?: Role }>(req);
      if (!role || !['BUYER', 'VENDOR', 'ADMIN'].includes(role)) {
        return json({ message: 'Valid role is required.' }, 400);
      }
      const { data, error } = await supabase.from('user').update({ role }).eq('id', userId).select().maybeSingle();
      if (error) throw error;
      return json(safeUser(data));
    }

    const matchVendorVerify = path.match(/^\/admin\/vendors\/([^/]+)\/verify$/);
    if (req.method === 'PATCH' && matchVendorVerify) {
      const vendorId = matchVendorVerify[1];
      const { status } = await bodyJson<{ status?: 'APPROVED' | 'REJECTED' }>(req);
      if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
        return json({ message: 'status must be APPROVED or REJECTED.' }, 400);
      }
      const updateData: Record<string, any> = { verificationStatus: status };
      if (status === 'APPROVED') {
        updateData.verifiedAt = new Date().toISOString();
      } else {
        updateData.verifiedAt = null;
      }
      const { data, error } = await supabase.from('vendor').update(updateData).eq('id', vendorId).select().maybeSingle();
      if (error) throw error;
      if (!data) return json({ message: 'Vendor not found.' }, 404);
      return json(data);
    }
  }

  return null;
}

async function routeVendors(req: Request, path: string, url: URL) {
  if (req.method === 'GET' && path === '/vendors') {
    const { data, error } = await supabase.from('vendor').select('*').order('isOpen', { ascending: false }).order('rating', { ascending: false });
    if (error) throw error;
    return json(data ?? []);
  }

  if (req.method === 'POST' && path === '/vendors/verification') {
    const user = await currentUser(req);
    requireRole(user, 'VENDOR');
    const { idType, idUrl, selfieUrl } = await bodyJson<{ idType?: string; idUrl?: string; selfieUrl?: string }>(req);
    if (!idType || !idUrl || !selfieUrl) {
      return json({ message: 'idType, idUrl and selfieUrl are required.' }, 400);
    }
    const valid = ['PASSPORT', 'GHANA_CARD', 'STUDENT_ID'];
    if (!valid.includes(idType)) {
      return json({ message: `idType must be one of: ${valid.join(', ')}.` }, 400);
    }
    const { data: vendor, error: getErr } = await supabase.from('vendor').select('*').eq('userId', user.id).maybeSingle();
    if (getErr) throw getErr;
    if (!vendor) return json({ message: 'Vendor record not found.' }, 404);
    const { data, error: updateErr } = await supabase.from('vendor')
      .update({ idType, idUrl, selfieUrl, verificationStatus: 'PENDING' })
      .eq('userId', user.id)
      .select()
      .maybeSingle();
    if (updateErr) throw updateErr;
    return json(data);
  }

  if (req.method === 'GET' && path === '/vendors/me') {
    const user = await currentUser(req);
    requireRole(user, 'VENDOR');
    let { data: vendor, error } = await supabase.from('vendor').select('*').eq('userId', user.id).maybeSingle();
    if (error) throw error;
    if (!vendor) {
      const { data: userRow } = await supabase.from('user').select('name').eq('id', user.id).maybeSingle();
      const { data: created, error: createErr } = await supabase.from('vendor').insert({
        userId: user.id,
        storeName: userRow?.name ? `${userRow.name}'s Kitchen` : 'My Store',
        description: '',
        location: '',
        cuisine: [],
        isOpen: false,
      }).select().maybeSingle();
      if (createErr) throw createErr;
      vendor = created;
    }
    return json(vendor);
  }

  const vendorOrders = path.match(/^\/vendors\/([^/]+)\/orders$/);
  if (req.method === 'GET' && vendorOrders) {
    const user = await currentUser(req);
    requireRole(user, 'VENDOR', 'ADMIN');
    const vendorId = vendorOrders[1];
    if (user.role === 'VENDOR') {
      const { data: own } = await supabase.from('vendor').select('id').eq('userId', user.id).maybeSingle();
      if (!own || own.id !== vendorId) return json({ message: 'You do not own this vendor.' }, 403);
    }
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    let query = supabase.from('order')
      .select('*, orderItem(menuItem(name, price, category)), user(id, name, phone, level)')
      .eq('vendorId', vendorId)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);
    const status = url.searchParams.get('status');
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return json(formatOrders(data ?? []));
  }

  const toggle = path.match(/^\/vendors\/([^/]+)\/toggle$/);
  if (req.method === 'PATCH' && toggle) {
    const user = await currentUser(req);
    requireRole(user, 'VENDOR', 'ADMIN');
    const { data: vendor, error } = await supabase.from('vendor').select('*').eq('id', toggle[1]).maybeSingle();
    if (error) throw error;
    if (!vendor) return json({ message: 'Vendor not found.' }, 404);
    if (user.role === 'VENDOR' && vendor.userId !== user.id) return json({ message: 'You do not own this vendor.' }, 403);
    if (!vendor.isOpen && vendor.verificationStatus !== 'APPROVED') {
      return json({ message: 'Your vendor account must be verified by an admin before you can open your store.' }, 403);
    }
    const { data, error: updateErr } = await supabase.from('vendor').update({ isOpen: !vendor.isOpen }).eq('id', vendor.id).select().maybeSingle();
    if (updateErr) throw updateErr;
    return json(data);
  }

  const patchVendor = path.match(/^\/vendors\/([^/]+)$/);
  if (req.method === 'PATCH' && patchVendor) {
    const user = await currentUser(req);
    requireRole(user, 'VENDOR', 'ADMIN');
    const { data: vendor, error } = await supabase.from('vendor').select('*').eq('id', patchVendor[1]).maybeSingle();
    if (error) throw error;
    if (!vendor) return json({ message: 'Vendor not found.' }, 404);
    if (user.role === 'VENDOR' && vendor.userId !== user.id) return json({ message: 'You do not own this vendor.' }, 403);
    const body = await bodyJson<Record<string, unknown>>(req);
    const update: Record<string, unknown> = {};
    for (const key of ['storeName', 'description', 'location', 'imageUrl'] as const) {
      if (typeof body[key] === 'string' || body[key] === null) update[key] = body[key];
    }
    if (Array.isArray(body.cuisine)) update.cuisine = body.cuisine.filter((c) => typeof c === 'string');
    if (!Object.keys(update).length) return json({ message: 'No editable fields supplied.' }, 400);
    const { data, error: updateErr } = await supabase.from('vendor').update(update).eq('id', vendor.id).select().maybeSingle();
    if (updateErr) throw updateErr;
    return json(data);
  }

  return null;
}

async function routeMenu(req: Request, path: string) {
  const vendorMenu = path.match(/^\/vendors\/([^/]+)\/menu$/);
  if (req.method === 'GET' && vendorMenu) {
    const { data, error } = await supabase.from('menuItem').select('*').eq('vendorId', vendorMenu[1]).order('category').order('name');
    if (error) throw error;
    return json(data ?? []);
  }

  if (req.method === 'POST' && vendorMenu) {
    const user = await currentUser(req);
    requireRole(user, 'VENDOR', 'ADMIN');
    const vendorId = vendorMenu[1];
    if (user.role === 'VENDOR') {
      const { data: own } = await supabase.from('vendor').select('id').eq('userId', user.id).maybeSingle();
      if (!own || own.id !== vendorId) return json({ message: 'You do not own this vendor.' }, 403);
    }
    const body = await bodyJson<Record<string, unknown>>(req);
    if (!body.name || !body.category || body.price == null) return json({ message: 'name, category and price are required.' }, 400);
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return json({ message: 'price must be a non-negative number.' }, 400);
    const { data, error } = await supabase.from('menuItem').insert({
      vendorId,
      name: String(body.name).trim(),
      description: body.description ? String(body.description).trim() : null,
      price,
      category: String(body.category).trim(),
      imageUrl: body.imageUrl ? String(body.imageUrl).trim() : null,
      images: Array.isArray(body.images) ? body.images.map(String).filter(Boolean) : [],
      videoUrl: body.videoUrl ? String(body.videoUrl).trim() : null,
    }).select().maybeSingle();
    if (error) throw error;
    return json(data, 201);
  }

  const menuItem = path.match(/^\/menu\/([^/]+)$/);
  if ((req.method === 'PATCH' || req.method === 'DELETE') && menuItem) {
    const user = await currentUser(req);
    requireRole(user, 'VENDOR', 'ADMIN');
    const { data: item, error } = await supabase.from('menuItem').select('id, vendor(userId)').eq('id', menuItem[1]).maybeSingle();
    if (error) throw error;
    if (!item) return json({ message: 'Menu item not found.' }, 404);
    const vendorUserId = Array.isArray(item.vendor) ? item.vendor[0]?.userId : item.vendor?.userId;
    if (user.role === 'VENDOR' && vendorUserId !== user.id) return json({ message: 'You do not own this item.' }, 403);
    if (req.method === 'DELETE') {
      const { error: deleteErr } = await supabase.from('menuItem').delete().eq('id', menuItem[1]);
      if (deleteErr) throw deleteErr;
      return empty();
    }
    const body = await bodyJson<Record<string, unknown>>(req);
    const update: Record<string, unknown> = {};
    for (const key of ['name', 'description', 'category', 'imageUrl', 'videoUrl'] as const) {
      if (body[key] !== undefined) update[key] = body[key] ? String(body[key]).trim() : null;
    }
    if (Array.isArray(body.images)) update.images = body.images.map(String).filter(Boolean);
    if (body.isAvailable !== undefined) update.isAvailable = Boolean(body.isAvailable);
    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) return json({ message: 'price must be a non-negative number.' }, 400);
      update.price = price;
    }
    const { data, error: updateErr } = await supabase.from('menuItem').update(update).eq('id', menuItem[1]).select().maybeSingle();
    if (updateErr) throw updateErr;
    return json(data);
  }

  return null;
}

async function generateOrderId() {
  for (;;) {
    const id = `CC-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    const { data } = await supabase.from('order').select('id').eq('id', id).maybeSingle();
    if (!data) return id;
  }
}

async function routeOrders(req: Request, path: string, url: URL) {
  if (req.method === 'POST' && path === '/orders') {
    const user = await currentUser(req);
    requireRole(user, 'BUYER');
    const body = await bodyJson<{
      vendorId?: string;
      items?: Array<{ menuItemId: string; quantity: number }>;
      deliverTo?: string;
      roomNumber?: string;
      paymentMethod?: string;
    }>(req);
    if (!body.vendorId || !body.items?.length || !body.deliverTo || !body.paymentMethod) {
      return json({ message: 'vendorId, items, deliverTo and paymentMethod are required.' }, 400);
    }
    const { data: vendor, error: vendorErr } = await supabase.from('vendor').select('*, user(phone)').eq('id', body.vendorId).maybeSingle();
    if (vendorErr) throw vendorErr;
    if (!vendor) return json({ message: 'Vendor not found.' }, 404);
    if (!vendor.isOpen) return json({ message: `${vendor.storeName} is currently closed.` }, 409);

    const menuItemIds = body.items.map((i) => i.menuItemId);
    const { data: menuItems, error: menuErr } = await supabase.from('menuItem')
      .select('*')
      .in('id', menuItemIds)
      .eq('vendorId', body.vendorId)
      .eq('isAvailable', true);
    if (menuErr) throw menuErr;
    if ((menuItems ?? []).length !== menuItemIds.length) return json({ message: 'Some items not found or unavailable.' }, 404);

    const priceMap = new Map((menuItems ?? []).map((m) => [m.id, Number(m.price)]));
    const lineItems = body.items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: priceMap.get(item.menuItemId) ?? 0,
    }));
    const deliveryFee = 15;
    const totalAmount = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) + deliveryFee;
    const { data: buyer } = await supabase.from('user').select('phone, email').eq('id', user.id).maybeSingle();
    const orderId = await generateOrderId();

    const { data: created, error: orderErr } = await supabase.from('order').insert({
      id: orderId,
      buyerId: user.id,
      vendorId: body.vendorId,
      deliverTo: body.deliverTo,
      roomNumber: body.roomNumber ?? null,
      deliveryFee,
      totalAmount,
      paymentMethod: body.paymentMethod,
      paymentStatus: 'PENDING',
    }).select().maybeSingle();
    if (orderErr) throw orderErr;
    const { error: itemsErr } = await supabase.from('orderItem').insert(lineItems.map((item) => ({ ...item, orderId })));
    if (itemsErr) {
      await supabase.from('order').delete().eq('id', orderId);
      throw itemsErr;
    }

    const { data: order } = await supabase.from('order')
      .select('*, orderItem(menuItem(name, imageUrl)), vendor(storeName), user(name, phone)')
      .eq('id', orderId)
      .maybeSingle();

    const itemsSummary = lineItems.map((li) => `${menuItems?.find((m) => m.id === li.menuItemId)?.name ?? li.menuItemId} x${li.quantity}`).join(', ');
    const deliveryLabel = body.roomNumber ? `${body.deliverTo}, Room ${body.roomNumber}` : body.deliverTo;
    const { data: vendorUser } = await supabase.from('user').select('phone').eq('id', vendor.userId).maybeSingle();
    if (buyer?.phone) sendSmsQuietly(buyer.phone, `Hi! Your CampusChoo order ${orderId} from ${vendor.storeName} has been placed.`);
    if (vendorUser?.phone) sendSmsQuietly(vendorUser.phone, `New order ${orderId} on CampusChoo!\nItems: ${itemsSummary}\nDeliver to: ${deliveryLabel}`);

    let paymentInit = null;
    let paymentInitError = null;
    if (PAYSTACK_SECRET_KEY.startsWith('sk_') && body.paymentMethod !== 'CASH' && buyer?.email) {
      try {
        paymentInit = await initializePayment({
          email: buyer.email,
          amount: Number(created.totalAmount),
          reference: `${orderId}:${Date.now()}`,
          orderId,
          buyerId: user.id,
        });
      } catch (err) {
        paymentInitError = err instanceof Error ? err.message : 'Failed to initialise payment.';
      }
    }
    return json({ ...formatOrder(order ?? created), paymentInit, paymentInitError }, 201);
  }

  if (req.method === 'GET' && path === '/orders/my') {
    const user = await currentUser(req);
    requireRole(user, 'BUYER');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 50);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    let query = supabase.from('order')
      .select('*, orderItem(menuItem(name, imageUrl, category)), vendor(id, storeName, imageUrl)')
      .eq('buyerId', user.id)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);
    const status = url.searchParams.get('status');
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return json(formatOrders(data ?? []));
  }

  const statusPatch = path.match(/^\/orders\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && statusPatch) {
    const user = await currentUser(req);
    requireRole(user, 'VENDOR', 'ADMIN');
    const { status } = await bodyJson<{ status?: string }>(req);
    const valid = ['CONFIRMED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];
    if (!status || !valid.includes(status)) return json({ message: `status must be one of: ${valid.join(', ')}.` }, 400);
    const { data: order, error } = await supabase.from('order').select('*, user(phone), vendor(*)').eq('id', statusPatch[1]).maybeSingle();
    if (error) throw error;
    if (!order) return json({ message: 'Order not found.' }, 404);
    if (user.role === 'VENDOR') {
      const { data: own } = await supabase.from('vendor').select('id').eq('userId', user.id).maybeSingle();
      if (!own || own.id !== order.vendorId) return json({ message: 'You do not own this order.' }, 403);
    }
    const { data, error: updateErr } = await supabase.from('order')
      .update({ status })
      .eq('id', statusPatch[1])
      .select('*, orderItem(menuItem(name)), vendor(storeName), user(name, phone)')
      .maybeSingle();
    if (updateErr) throw updateErr;
    if (status === 'DELIVERED' && order.user?.phone) sendSmsQuietly(order.user.phone, `Your CampusChoo order ${statusPatch[1]} has been delivered!`);
    return json(formatOrder(data));
  }

  const getOrder = path.match(/^\/orders\/([^/]+)$/);
  if (req.method === 'GET' && getOrder) {
    const { data, error } = await supabase.from('order')
      .select('*, orderItem(menuItem(name, imageUrl)), vendor(storeName), user(name)')
      .eq('id', getOrder[1])
      .maybeSingle();
    if (error) throw error;
    if (!data) return json({ message: 'Order not found.' }, 404);
    return json(formatOrder(data));
  }

  return null;
}

async function routePayments(req: Request, path: string, url: URL) {
  if (req.method === 'POST' && path === '/payments/initialize') {
    const user = await currentUser(req);
    requireRole(user, 'BUYER');
    const { orderId } = await bodyJson<{ orderId?: string }>(req);
    if (!orderId) return json({ message: 'orderId is required.' }, 400);
    const { data: order, error } = await supabase.from('order').select('*, user(id, email)').eq('id', orderId).maybeSingle();
    if (error) throw error;
    if (!order) return json({ message: 'Order not found.' }, 404);
    if (order.buyerId !== user.id) return json({ message: 'You do not own this order.' }, 403);
    if (order.paymentStatus === 'PAID') return json({ message: 'Order is already paid.' }, 409);
    const data = await initializePayment({
      email: order.user.email,
      amount: Number(order.totalAmount),
      reference: `${order.id}:${Date.now()}`,
      orderId: order.id,
      buyerId: order.buyerId,
    });
    return json(data);
  }

  if (req.method === 'GET' && path === '/payments/verify') {
    const reference = url.searchParams.get('reference')?.trim();
    if (!reference) return json({ message: 'reference query param is required.' }, 400);
    const orderId = reference.split(':')[0];
    const { data: order, error } = await supabase.from('order').select('*').eq('id', orderId).maybeSingle();
    if (error) throw error;
    if (!order) return json({ message: 'Order not found.' }, 404);
    const verification = await paystack<{ status: string; amount: number; channel: string | null }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (verification.status === 'success') {
      const expected = Math.round(Number(order.totalAmount) * 100);
      if (verification.amount !== expected) return json({ orderId, paymentStatus: 'PENDING', reason: 'amount_mismatch' });
      await supabase.from('order').update({ paymentStatus: 'PAID' }).eq('id', orderId);
      return json({ orderId, paymentStatus: 'PAID', channel: verification.channel });
    }
    if (verification.status === 'failed' || verification.status === 'abandoned') {
      await supabase.from('order').update({ paymentStatus: 'FAILED' }).eq('id', orderId);
      return json({ orderId, paymentStatus: 'FAILED', reason: verification.status });
    }
    return json({ orderId, paymentStatus: 'PENDING', reason: verification.status });
  }

  if (req.method === 'POST' && path === '/payments/webhook') {
    const raw = await req.text();
    const signature = req.headers.get('x-paystack-signature') ?? '';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(PAYSTACK_SECRET_KEY), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const expected = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (!signature || signature !== expected) return json({ message: 'Invalid signature.' }, 401);
    const event = JSON.parse(raw) as { event: string; data: { reference: string; amount: number } };
    if (event.event === 'charge.success') {
      const orderId = event.data.reference.split(':')[0];
      const { data: order } = await supabase.from('order').select('*').eq('id', orderId).maybeSingle();
      if (order && order.paymentStatus !== 'PAID' && event.data.amount === Math.round(Number(order.totalAmount) * 100)) {
        await supabase.from('order').update({ paymentStatus: 'PAID' }).eq('id', orderId);
      }
    }
    return json({ received: true });
  }

  return null;
}

async function routeUpload(req: Request, path: string) {
  if (req.method !== 'POST' || path !== '/upload') return null;
  const user = await currentUser(req);
  requireRole(user, 'VENDOR', 'ADMIN');
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ message: 'No file uploaded.' }, 400);
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return json({ message: 'Only image/* and video/* files are allowed' }, 400);
  if (file.size > 50 * 1024 * 1024) return json({ message: 'File too large.' }, 400);
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const key = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('campuschoo').upload(key, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('campuschoo').getPublicUrl(key);
  return json({
    url: data.publicUrl,
    kind: file.type.startsWith('video/') ? 'video' : 'image',
    size: file.size,
    mime: file.type,
  }, 201);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return empty(200);
  if (!SUPABASE_URL || !SERVICE_KEY || !JWT_SECRET) {
    console.error('Missing required Edge Function environment:', {
      SUPABASE_URL: Boolean(SUPABASE_URL),
      SERVICE_KEY: Boolean(SERVICE_KEY),
      JWT_SECRET: Boolean(JWT_SECRET),
    });
    return json({ message: 'Missing required backend environment. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY), and JWT_SECRET.' }, 500);
  }
  try {
    const { path, url } = normalizePath(req);
    const response =
      await routeAuth(req, path) ??
      await routeAdmin(req, path) ??
      await routeVendors(req, path, url) ??
      await routeMenu(req, path) ??
      await routeOrders(req, path, url) ??
      await routePayments(req, path, url) ??
      await routeUpload(req, path);

    return response ?? json({ message: 'Not found.' }, 404);
  } catch (err) {
    if (err instanceof Response) {
      const message = err.status === 401 ? 'Not authenticated.' : 'Access denied.';
      return json({ message }, err.status);
    }
    console.error('Unhandled function error:', err);
    return json({ message: errorMessage(err) }, 500);
  }
});
