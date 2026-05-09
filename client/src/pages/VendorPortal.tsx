import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Vendor {
  id: string;
  storeName: string;
  description: string;
  location: string;
  isOpen: boolean;
  rating: number;
  imageUrl?: string | null;
}

interface MenuItem {
  id: string;
  vendorId: string;
  name: string;
  description?: string | null;
  price: number | string;
  category: string;
  imageUrl?: string | null;
  isAvailable: boolean;
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number | string;
  menuItem: { name: string };
}

interface Order {
  id: string;
  status: string;
  deliverTo: string;
  roomNumber?: string | null;
  totalAmount: number | string;
  createdAt: string;
  items: OrderItem[];
  buyer: { name: string; phone?: string };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ORANGE = '#F4521E';
const BG = '#080706';
const CARD = '#0f0d0c';
const BORDER = '#1f1c1a';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#fb923c', CONFIRMED: '#F4521E', PREPARING: '#eab308',
  READY: '#22c55e', ON_THE_WAY: '#3b82f6', DELIVERED: '#16a34a',
  CANCELLED: '#ef4444',
};

const NEXT_ACTION: Record<string, { label: string; next: string } | null> = {
  PENDING:    { label: 'Confirm',    next: 'CONFIRMED' },
  CONFIRMED:  { label: 'Preparing',  next: 'PREPARING' },
  PREPARING:  { label: 'Mark Ready', next: 'READY' },
  READY:      { label: 'On the Way', next: 'ON_THE_WAY' },
  ON_THE_WAY: { label: 'Delivered',  next: 'DELIVERED' },
  DELIVERED:  null,
  CANCELLED:  null,
};

const CATEGORY_SUGGESTIONS = ['Mains', 'Sides', 'Drinks', 'Snacks', 'Desserts', 'Combos', 'Breakfast'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
}

function ghs(v: number | string): string {
  return `GHS ${Number(v).toFixed(2)}`;
}

function todayStartMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VendorPortal() {
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [toasts, setToasts] = useState<{ id: number; msg: string; tone: 'info' | 'success' | 'error' }[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const toastIdRef = useRef(0);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cc_accessToken') : null;

  const pushToast = useCallback((msg: string, tone: 'info' | 'success' | 'error' = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const authFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return fetch(url, { ...init, headers });
  }, [token]);

  // ── Bootstrap: profile + orders + menu ──────────────────────────────────
  useEffect(() => {
    if (!token) {
      navigate('/account?redirect=/portal');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const meRes = await authFetch('/api/vendors/me');
        if (cancelled) return;

        if (meRes.status === 401) { navigate('/account?redirect=/portal'); return; }
        if (meRes.status === 403) { setErr('Only vendor accounts can access this portal.'); return; }
        if (!meRes.ok) {
          const body = await meRes.json().catch(() => ({}));
          setErr(body.message ?? 'Could not load vendor profile.');
          return;
        }
        const me: Vendor = await meRes.json();
        if (cancelled) return;
        setVendor(me);

        const [oRes, mRes] = await Promise.all([
          authFetch(`/api/vendors/${me.id}/orders`),
          fetch(`/api/vendors/${me.id}/menu`),
        ]);
        if (cancelled) return;
        if (oRes.ok) setOrders(await oRes.json());
        if (mRes.ok) setMenu(await mRes.json());
      } catch {
        if (!cancelled) setErr('Network error. Check your connection.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, navigate, authFetch]);

  // ── Socket: live order:new ──────────────────────────────────────────────
  useEffect(() => {
    if (!vendor?.id || !token) return;
    const socket = io('/', { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const join = () => socket.emit('join:vendor', vendor.id);
    socket.on('connect', join);
    join();

    socket.on('order:new', (newOrder: Order) => {
      setOrders((prev) => prev.some((o) => o.id === newOrder.id) ? prev : [newOrder, ...prev]);
      pushToast(`📦 New order ${newOrder.id} from ${newOrder.buyer?.name ?? 'a buyer'}`, 'success');
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [vendor?.id, token, pushToast]);

  // ── Actions ─────────────────────────────────────────────────────────────
  async function toggleOpen() {
    if (!vendor) return;
    const res = await authFetch(`/api/vendors/${vendor.id}/toggle`, { method: 'PATCH' });
    if (res.ok) {
      const updated: Vendor = await res.json();
      setVendor(updated);
      pushToast(updated.isOpen ? '🟢 Store is now open' : '🔴 Store is closed', 'info');
    } else {
      pushToast('Could not toggle store status', 'error');
    }
  }

  async function setOrderStatus(id: string, next: string) {
    const res = await authFetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const updated: Order = await res.json();
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, ...updated } : o));
      pushToast(`Order ${id} → ${next.replace('_', ' ')}`, 'success');
    } else {
      pushToast('Could not update order', 'error');
    }
  }

  async function toggleAvailability(item: MenuItem) {
    const res = await authFetch(`/api/menu/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable: !item.isAvailable }),
    });
    if (res.ok) {
      const updated: MenuItem = await res.json();
      setMenu((prev) => prev.map((m) => m.id === item.id ? updated : m));
    } else {
      pushToast('Could not update availability', 'error');
    }
  }

  async function savePrice(item: MenuItem, newPriceStr: string) {
    const newPrice = Number(newPriceStr);
    if (!Number.isFinite(newPrice) || newPrice < 0) {
      pushToast('Invalid price', 'error');
      return;
    }
    if (Math.abs(newPrice - Number(item.price)) < 0.005) return;
    const res = await authFetch(`/api/menu/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ price: newPrice }),
    });
    if (res.ok) {
      const updated: MenuItem = await res.json();
      setMenu((prev) => prev.map((m) => m.id === item.id ? updated : m));
      pushToast(`Updated price to ${ghs(newPrice)}`, 'success');
    } else {
      pushToast('Could not update price', 'error');
    }
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    const res = await authFetch(`/api/menu/${item.id}`, { method: 'DELETE' });
    if (res.ok) {
      setMenu((prev) => prev.filter((m) => m.id !== item.id));
      pushToast(`Deleted ${item.name}`, 'info');
    } else {
      pushToast('Could not delete item', 'error');
    }
  }

  async function addItem(data: { name: string; description: string; price: string; category: string; imageUrl: string }) {
    if (!vendor) return false;
    const res = await authFetch(`/api/vendors/${vendor.id}/menu`, {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        description: data.description || undefined,
        price: Number(data.price),
        category: data.category,
        imageUrl: data.imageUrl || undefined,
      }),
    });
    if (res.ok) {
      const created: MenuItem = await res.json();
      setMenu((prev) => [...prev, created]);
      pushToast(`Added ${created.name}`, 'success');
      return true;
    }
    const body = await res.json().catch(() => ({}));
    pushToast(body.message ?? 'Could not add item', 'error');
    return false;
  }

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const start = todayStartMs();
    const today = orders.filter((o) => new Date(o.createdAt).getTime() >= start);
    const revenue = today
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);
    return { count: today.length, revenue };
  }, [orders]);

  const menuByCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menu) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [menu]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: BG, minHeight: '100vh', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        Loading portal…
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ background: BG, minHeight: '100vh', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
          <p style={{ color: '#fca5a5', marginBottom: '1.5rem' }}>{err}</p>
          <button onClick={() => navigate('/')} style={{
            background: ORANGE, color: '#fff', border: 'none', borderRadius: '0.75rem',
            padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Syne', sans-serif",
          }}>Back home</button>
        </div>
      </div>
    );
  }

  if (!vendor) return null;

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header style={{
        borderBottom: `1px solid ${BORDER}`, padding: '1rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        position: 'sticky', top: 0, background: BG, zIndex: 20,
      }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.25rem', color: ORANGE, margin: 0 }}>
          CampusChoo
        </h1>
        <span style={{ color: '#666', fontSize: '0.8125rem', borderLeft: `1px solid ${BORDER}`, paddingLeft: '0.75rem' }}>
          Vendor Portal
        </span>
        <button onClick={() => {
          localStorage.removeItem('cc_accessToken');
          localStorage.removeItem('cc_refreshToken');
          localStorage.removeItem('cc_user');
          navigate('/');
        }} style={{
          marginLeft: 'auto', background: 'transparent', color: '#888', border: `1px solid ${BORDER}`,
          borderRadius: '0.5rem', padding: '0.4375rem 0.875rem', fontSize: '0.8125rem',
          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        }}>Log out</button>
      </header>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
        {/* ── Store Header + Toggle + Stats ── */}
        <section style={{
          background: CARD, borderRadius: '1rem', padding: '1.25rem',
          marginBottom: '1.5rem', border: `1px solid ${BORDER}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: '#666', fontSize: '0.6875rem', margin: '0 0 0.25rem', letterSpacing: '0.1em', fontWeight: 600 }}>
                STORE
              </p>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.625rem', color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
                {vendor.storeName}
              </h2>
              <p style={{ color: '#888', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>
                📍 {vendor.location}
              </p>
            </div>

            <button onClick={toggleOpen} style={{
              background: vendor.isOpen ? '#0a1f10' : '#1f0a0a',
              border: `1.5px solid ${vendor.isOpen ? '#22c55e' : '#7f1d1d'}`,
              borderRadius: '999px', padding: '0.5rem 1rem',
              color: vendor.isOpen ? '#22c55e' : '#fca5a5',
              fontWeight: 700, fontSize: '0.8125rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontFamily: "'Syne', sans-serif", letterSpacing: '0.04em',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: vendor.isOpen ? '#22c55e' : '#ef4444',
                boxShadow: vendor.isOpen ? '0 0 8px #22c55e' : 'none',
              }} />
              {vendor.isOpen ? 'OPEN' : 'CLOSED'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            <StatCard label="Orders Today" value={String(stats.count)} accent={ORANGE} />
            <StatCard label="Revenue Today" value={ghs(stats.revenue)} accent="#22c55e" />
          </div>
        </section>

        {/* ── Incoming Orders ── */}
        <section style={{ marginBottom: '2rem' }}>
          <SectionHeader
            title="Incoming Orders"
            badge={String(orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).length)}
          />
          {orders.length === 0 ? (
            <EmptyState icon="📭" title="No orders yet" hint="New orders will appear here in real time." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} onAdvance={setOrderStatus} />
              ))}
            </div>
          )}
        </section>

        {/* ── Menu Management ── */}
        <section>
          <SectionHeader title="Menu Management" />
          <AddItemForm onSubmit={addItem} />
          {menu.length === 0 ? (
            <EmptyState icon="📋" title="No menu items yet" hint="Add your first dish above to get started." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
              {menuByCategory.map(([category, items]) => (
                <div key={category}>
                  <h4 style={{
                    fontFamily: "'Syne', sans-serif", fontWeight: 700,
                    fontSize: '0.8125rem', letterSpacing: '0.08em',
                    color: ORANGE, textTransform: 'uppercase',
                    margin: '0 0 0.625rem', paddingLeft: '0.25rem',
                  }}>
                    ▾ {category} ({items.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {items.map((item) => (
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        onToggleAvailability={() => toggleAvailability(item)}
                        onSavePrice={(p) => savePrice(item, p)}
                        onDelete={() => deleteItem(item)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Toasts ── */}
      <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 100, maxWidth: 'calc(100vw - 2rem)' }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: t.tone === 'error' ? '#1f0a0a' : t.tone === 'success' ? '#0a1f10' : '#0f0d0c',
            border: `1px solid ${t.tone === 'error' ? '#7f1d1d' : t.tone === 'success' ? '#166534' : BORDER}`,
            color: t.tone === 'error' ? '#fca5a5' : t.tone === 'success' ? '#86efac' : '#e5e5e5',
            borderRadius: '0.625rem', padding: '0.75rem 1rem', fontSize: '0.875rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxWidth: '320px',
          }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: '#0a0908', border: `1px solid ${BORDER}`, borderRadius: '0.75rem', padding: '1rem' }}>
      <p style={{ margin: '0 0 0.375rem', color: '#666', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ margin: 0, color: accent, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.01em' }}>
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.875rem' }}>
      <h3 style={{
        fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.125rem',
        color: '#fff', margin: 0, letterSpacing: '-0.01em',
      }}>
        {title}
      </h3>
      {badge && (
        <span style={{
          background: ORANGE + '22', color: ORANGE, borderRadius: '999px',
          padding: '0.125rem 0.5rem', fontSize: '0.6875rem', fontWeight: 700,
        }}>{badge}</span>
      )}
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div style={{
      background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '1rem',
      padding: '2.5rem 1rem', textAlign: 'center', color: '#666',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.7 }}>{icon}</div>
      <p style={{ margin: '0 0 0.25rem', color: '#888', fontWeight: 600 }}>{title}</p>
      <p style={{ margin: 0, fontSize: '0.8125rem' }}>{hint}</p>
    </div>
  );
}

function OrderCard({ order, onAdvance }: { order: Order; onAdvance: (id: string, next: string) => void }) {
  const action = NEXT_ACTION[order.status];
  const statusColor = STATUS_COLORS[order.status] ?? ORANGE;

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '0.875rem', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <p style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1rem', color: ORANGE }}>
            {order.id}
          </p>
          <p style={{ margin: '0.125rem 0 0', color: '#888', fontSize: '0.75rem' }}>
            {fmtTime(order.createdAt)} · {order.buyer.name}
          </p>
        </div>
        <div style={{
          background: statusColor + '1f', border: `1px solid ${statusColor}`,
          borderRadius: '999px', padding: '0.1875rem 0.625rem',
          color: statusColor, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em',
        }}>
          {order.status === 'ON_THE_WAY' ? 'ON THE WAY' : order.status}
        </div>
      </div>

      <p style={{ margin: '0.5rem 0', color: '#ccc', fontSize: '0.8125rem' }}>
        📍 {order.roomNumber ? `${order.deliverTo}, Rm ${order.roomNumber}` : order.deliverTo}
      </p>

      <div style={{
        background: '#0a0908', border: `1px solid ${BORDER}`,
        borderRadius: '0.5rem', padding: '0.625rem 0.75rem', marginBottom: '0.75rem',
      }}>
        {order.items.map((it) => (
          <p key={it.id} style={{ margin: '0.125rem 0', color: '#bbb', fontSize: '0.8125rem' }}>
            <span style={{ color: ORANGE, fontWeight: 700 }}>×{it.quantity}</span> {it.menuItem.name}
          </p>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.0625rem', color: '#fff' }}>
          {ghs(order.totalAmount)}
        </p>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {action && (
            <button onClick={() => onAdvance(order.id, action.next)} style={{
              background: ORANGE, color: '#fff', border: 'none', borderRadius: '0.5rem',
              padding: '0.4375rem 0.875rem', fontWeight: 700, fontSize: '0.8125rem',
              cursor: 'pointer', fontFamily: "'Syne', sans-serif",
            }}>
              {action.label} →
            </button>
          )}
          {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
            <button onClick={() => {
              if (window.confirm(`Cancel order ${order.id}?`)) onAdvance(order.id, 'CANCELLED');
            }} style={{
              background: 'transparent', color: '#888', border: `1px solid ${BORDER}`,
              borderRadius: '0.5rem', padding: '0.4375rem 0.75rem',
              fontSize: '0.8125rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItemRow({
  item, onToggleAvailability, onSavePrice, onDelete,
}: {
  item: MenuItem;
  onToggleAvailability: () => void;
  onSavePrice: (price: string) => void;
  onDelete: () => void;
}) {
  const [priceDraft, setPriceDraft] = useState(Number(item.price).toFixed(2));

  useEffect(() => { setPriceDraft(Number(item.price).toFixed(2)); }, [item.price]);

  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: '0.625rem',
      padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.625rem',
      opacity: item.isAvailable ? 1 : 0.55,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, color: '#e5e5e5', fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </p>
        {item.description && (
          <p style={{ margin: '0.125rem 0 0', color: '#666', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.description}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{ color: '#666', fontSize: '0.75rem' }}>GHS</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={priceDraft}
          onChange={(e) => setPriceDraft(e.target.value)}
          onBlur={() => onSavePrice(priceDraft)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{
            width: '70px', background: '#0a0908', border: `1px solid ${BORDER}`,
            borderRadius: '0.375rem', color: '#fff', padding: '0.3125rem 0.5rem',
            fontSize: '0.875rem', textAlign: 'right', outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </div>

      <button onClick={onToggleAvailability} aria-label={item.isAvailable ? 'Set unavailable' : 'Set available'} style={{
        width: '38px', height: '22px', borderRadius: '999px', border: 'none',
        background: item.isAvailable ? '#22c55e' : '#3a3431',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: '2px',
          left: item.isAvailable ? '18px' : '2px',
          width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>

      <button onClick={onDelete} aria-label="Delete item" style={{
        background: 'transparent', border: `1px solid ${BORDER}`, color: '#888',
        borderRadius: '0.375rem', width: '28px', height: '28px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontSize: '0.875rem',
      }}>
        ✕
      </button>
    </div>
  );
}

function AddItemForm({
  onSubmit,
}: {
  onSubmit: (data: { name: string; description: string; price: string; category: string; imageUrl: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', imageUrl: '' });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim() || !form.price) return;
    setSubmitting(true);
    const ok = await onSubmit(form);
    setSubmitting(false);
    if (ok) {
      setForm({ name: '', description: '', price: '', category: '', imageUrl: '' });
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        width: '100%', background: 'transparent', border: `1.5px dashed ${ORANGE}66`, color: ORANGE,
        borderRadius: '0.875rem', padding: '0.875rem', fontWeight: 700, cursor: 'pointer',
        fontFamily: "'Syne', sans-serif", fontSize: '0.9375rem', marginBottom: '0.5rem',
      }}>
        + Add Menu Item
      </button>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0a0908', border: `1px solid ${BORDER}`,
    borderRadius: '0.5rem', color: '#fff', padding: '0.625rem 0.75rem',
    fontSize: '0.875rem', outline: 'none', fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box',
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: '0.875rem',
      padding: '1rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.625rem',
    }}>
      <input
        placeholder="Item name *"
        value={form.name}
        onChange={(e) => update('name', e.target.value)}
        required
        style={inputStyle}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.625rem' }}>
        <input
          placeholder="Category *"
          list="cc-categories"
          value={form.category}
          onChange={(e) => update('category', e.target.value)}
          required
          style={inputStyle}
        />
        <datalist id="cc-categories">
          {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
        </datalist>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Price *"
          value={form.price}
          onChange={(e) => update('price', e.target.value)}
          required
          style={inputStyle}
        />
      </div>

      <textarea
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => update('description', e.target.value)}
        rows={2}
        style={{ ...inputStyle, resize: 'vertical', minHeight: '50px' }}
      />

      <input
        placeholder="Image URL (optional)"
        value={form.imageUrl}
        onChange={(e) => update('imageUrl', e.target.value)}
        style={inputStyle}
      />

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
        <button type="button" onClick={() => setOpen(false)} style={{
          background: 'transparent', border: `1px solid ${BORDER}`, color: '#888',
          borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif", fontSize: '0.875rem',
        }}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} style={{
          background: ORANGE, color: '#fff', border: 'none', borderRadius: '0.5rem',
          padding: '0.5rem 1.25rem', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
          fontFamily: "'Syne', sans-serif", fontSize: '0.875rem', opacity: submitting ? 0.6 : 1,
        }}>
          {submitting ? 'Adding…' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}
