import { createClient } from '@supabase/supabase-js';

type Role = 'BUYER' | 'VENDOR' | 'ADMIN';
type TokenPayload = { sub: string; email: string; role: Role; exp?: number };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_KEY') ?? '';
const JWT_SECRET = Deno.env.get('JWT_SECRET') ?? '';
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_BASE_URL = Deno.env.get('CLIENT_BASE_URL') ?? 'http://localhost:3000';
const ARKESEL_API_KEY = Deno.env.get('ARKESEL_API_KEY') ?? '';

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

async function sendSms(to: string, message: string) {
  if (!ARKESEL_API_KEY) return;
  await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: { 'api-key': ARKESEL_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: 'CampusChoo', message, recipients: [to] }),
  }).catch(() => undefined);
}

async function routeAuth(req: Request, path: string) {
  if (req.method === 'POST' && path === '/auth/register') {
    const { name, email, password, phone, role, level, storeName } = await bodyJson<Record<string, string>>(req);
    if (!name || !email || !password || !phone) return json({ message: 'name, email, password and phone are required.' }, 400);
    if (password.length < 6) return json({ message: 'Password must be at least 6 characters.' }, 400);

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

  return null;
}

async function routeVendors(req: Request, path: string, url: URL) {
  if (req.method === 'GET' && path === '/vendors') {
    const { data, error } = await supabase.from('vendor').select('*').order('isOpen', { ascending: false }).order('rating', { ascending: false });
    if (error) throw error;
    return json(data ?? []);
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
    if (buyer?.phone) sendSms(buyer.phone, `Hi! Your CampusChoo order ${orderId} from ${vendor.storeName} has been placed.`);
    if (vendorUser?.phone) sendSms(vendorUser.phone, `New order ${orderId} on CampusChoo!\nItems: ${itemsSummary}\nDeliver to: ${deliveryLabel}`);

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
    if (status === 'DELIVERED' && order.user?.phone) sendSms(order.user.phone, `Your CampusChoo order ${statusPatch[1]} has been delivered!`);
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
