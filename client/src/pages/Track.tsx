import { useState, useEffect, useRef, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { apiUrl, SOCKET_URL } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrackItem {
  id: string;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  menuItem: { name: string; imageUrl?: string | null };
}

interface TrackOrder {
  id: string;
  status: string;
  deliverTo: string;
  roomNumber?: string | null;
  createdAt: string;
  totalAmount: number | string;
  subtotal: number | string;
  deliveryFee: number | string;
  paymentMethod: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  riderName?: string | null;
  riderPhone?: string | null;
  vendorId: string;
  items: TrackItem[];
  vendor: { storeName: string };
  buyer: { name: string };
}

type PayBanner =
  | { kind: 'idle' }
  | { kind: 'verifying' }
  | { kind: 'paid'; channel?: string | null }
  | { kind: 'failed'; reason?: string }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

interface StatusUpdatePayload {
  orderId: string;
  status: string;
  order?: TrackOrder;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'PENDING',    label: 'Order Placed' },
  { key: 'CONFIRMED',  label: 'Confirmed' },
  { key: 'PREPARING',  label: 'Preparing' },
  { key: 'READY',      label: 'Ready' },
  { key: 'ON_THE_WAY', label: 'On the Way' },
  { key: 'DELIVERED',  label: 'Delivered' },
];

const ETA_MAP: Record<string, number> = {
  PENDING: 45, CONFIRMED: 35, PREPARING: 20,
  READY: 8, ON_THE_WAY: 4, DELIVERED: 0, CANCELLED: 0,
};

const PAYMENT_LABELS: Record<string, string> = {
  MTN_MOMO: 'MTN MoMo',
  VODAFONE_CASH: 'Vodafone Cash',
  AIRTELTIGO_MONEY: 'AirtelTigo Money',
  CASH: 'Cash on Delivery',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F4521E', CONFIRMED: '#F4521E', PREPARING: '#F4521E',
  READY: '#22c55e', ON_THE_WAY: '#3b82f6', DELIVERED: '#22c55e',
  CANCELLED: '#ef4444',
};

const ORANGE = '#F4521E';
const BG = '#080706';
const SUPPORT_NUMBER = '233000000000';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStepIndex(status: string): number {
  return STEPS.findIndex((s) => s.key === status);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GH', {
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GH', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function ghs(v: number | string): string {
  return `GHS ${Number(v).toFixed(2)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Track() {
  const { orderId: routeOrderId } = useParams<{ orderId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [inputValue, setInputValue] = useState('');
  const [order, setOrder] = useState<TrackOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eta, setEta] = useState(0);
  const [payBanner, setPayBanner] = useState<PayBanner>({ kind: 'idle' });
  const socketRef = useRef<Socket | null>(null);
  const etaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch order ─────────────────────────────────────────────────────────
  const fetchOrder = useCallback(async (id: string) => {
    const normalised = id.trim().toUpperCase();
    if (!normalised) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(normalised)}`));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? `Couldn't find order ${normalised}.`);
        setOrder(null);
        return;
      }
      const data: TrackOrder = await res.json();
      setOrder(data);
      setEta(ETA_MAP[data.status] ?? 0);
    } catch {
      setError('Could not connect. Check your internet and try again.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auto-load from URL (route param OR ?id= query) ──────────────────────
  useEffect(() => {
    const id = routeOrderId ?? searchParams.get('id') ?? '';
    if (id) {
      setInputValue(id);
      fetchOrder(id);
    }
  }, [routeOrderId, searchParams, fetchOrder]);

  // ── Verify Paystack payment when the buyer comes back via ?reference=... ──
  // Paystack appends ?reference=<our_ref> to the callback URL. We hit our
  // /api/payments/verify route, which confirms with Paystack and updates the
  // order's paymentStatus. Then we strip the param so a page refresh doesn't
  // re-verify.
  useEffect(() => {
    const reference = searchParams.get('reference') ?? searchParams.get('trxref');
    if (!reference) return;

    let cancelled = false;
    setPayBanner({ kind: 'verifying' });
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/payments/verify?reference=${encodeURIComponent(reference)}`));
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setPayBanner({ kind: 'error', message: body.message ?? 'Could not verify payment.' });
        } else if (body.paymentStatus === 'PAID') {
          setPayBanner({ kind: 'paid', channel: body.channel });
          // Re-fetch so the order details reflect the new paymentStatus.
          if (body.orderId) fetchOrder(body.orderId);
        } else if (body.paymentStatus === 'FAILED') {
          setPayBanner({ kind: 'failed', reason: body.reason });
        } else {
          setPayBanner({ kind: 'pending' });
        }
      } catch {
        if (!cancelled) setPayBanner({ kind: 'error', message: 'Network error while verifying payment.' });
      } finally {
        // Strip ?reference/?trxref from the URL so refresh won't re-verify.
        if (!cancelled) {
          const next = new URLSearchParams(searchParams);
          next.delete('reference');
          next.delete('trxref');
          const qs = next.toString();
          const path = routeOrderId ? `/track/${routeOrderId}` : '/track';
          navigate(qs ? `${path}?${qs}` : path, { replace: true });
        }
      }
    })();

    return () => { cancelled = true; };
    // searchParams change is the trigger — fetchOrder is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Socket.io live updates ──────────────────────────────────────────────
  useEffect(() => {
    if (!order?.id) return;
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join:order', order.id));
    socket.emit('join:order', order.id);

    socket.on('order:statusUpdate', (payload: StatusUpdatePayload) => {
      if (payload.orderId !== order.id) return;
      setOrder((prev) => prev ? { ...prev, status: payload.status, ...(payload.order ?? {}) } : prev);
      setEta(ETA_MAP[payload.status] ?? 0);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [order?.id]);

  // ── ETA countdown (per minute) ──────────────────────────────────────────
  useEffect(() => {
    if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
    if (eta <= 0) return;
    etaIntervalRef.current = setInterval(() => {
      setEta((prev) => {
        if (prev <= 1) {
          if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 60_000);
    return () => { if (etaIntervalRef.current) clearInterval(etaIntervalRef.current); };
  }, [eta]);

  // ── Submit handler ──────────────────────────────────────────────────────
  function handleTrack(e: FormEvent) {
    e.preventDefault();
    const id = inputValue.trim().toUpperCase();
    if (!id) return;
    navigate(`/track/${id}`, { replace: true });
    fetchOrder(id);
  }

  const stepIndex = order ? getStepIndex(order.status) : -1;
  const progressPct = order && order.status !== 'CANCELLED' && stepIndex >= 0
    ? Math.round(((stepIndex + 1) / STEPS.length) * 100)
    : 0;
  const statusColor = order ? STATUS_COLORS[order.status] ?? ORANGE : ORANGE;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: BG, minHeight: '100vh',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#fff',
    }}>
      {/* ── Header ── */}
      <header style={{
        borderBottom: '1px solid #1a1a1a', padding: '1rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        position: 'sticky', top: 0, background: BG, zIndex: 10,
      }}>
        <button
          onClick={() => navigate('/')}
          aria-label="Back home"
          style={{
            color: ORANGE, background: 'none', border: 'none',
            fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: 0,
          }}
        >←</button>
        <h1 style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
          fontSize: '1.25rem', color: ORANGE, margin: 0, letterSpacing: '-0.02em',
        }}>CampusChoo</h1>
        <span style={{ color: '#888', fontSize: '0.8125rem', marginLeft: 'auto' }}>
          Order Tracking
        </span>
      </header>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        {/* ── Paystack payment banner (only when returning from checkout) ── */}
        {payBanner.kind !== 'idle' && <PaymentBanner state={payBanner} />}

        {/* ── Search Bar ── */}
        <form onSubmit={handleTrack} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter order ID e.g. CC-12345"
            spellCheck={false}
            autoCapitalize="characters"
            style={{
              flex: 1, background: '#111', border: '1.5px solid #222',
              borderRadius: '0.75rem', color: '#fff',
              padding: '0.8125rem 1rem', fontSize: '0.9375rem',
              outline: 'none', fontFamily: "'Inter', sans-serif",
              letterSpacing: '0.02em',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = ORANGE)}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#222')}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              background: ORANGE, color: '#fff', border: 'none',
              borderRadius: '0.75rem', padding: '0.8125rem 1.5rem',
              fontWeight: 700, fontSize: '0.9375rem',
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: "'Bricolage Grotesque', sans-serif", whiteSpace: 'nowrap',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.2s, transform 0.1s',
            }}
          >
            {loading ? '…' : 'Track ▶'}
          </button>
        </form>

        {/* ── Error ── */}
        {error && (
          <div style={{
            background: '#1a0808', border: '1px solid #7f1d1d',
            borderRadius: '0.75rem', padding: '1rem',
            marginBottom: '1.5rem', color: '#fca5a5', fontSize: '0.875rem',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && !order && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#666' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
            <p style={{ fontSize: '0.875rem' }}>Looking up your order…</p>
          </div>
        )}

        {order && (
          <>
            {/* ── Order Header + Timeline ── */}
            <section style={{
              background: '#0f0d0c', borderRadius: '1rem',
              padding: '1.25rem', marginBottom: '1rem',
              border: '1px solid #1f1c1a',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem',
              }}>
                <div>
                  <p style={{ color: '#666', fontSize: '0.6875rem', margin: '0 0 0.25rem', letterSpacing: '0.1em', fontWeight: 600 }}>
                    ORDER ID
                  </p>
                  <h2 style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
                    fontSize: '1.5rem', color: ORANGE, margin: 0,
                    letterSpacing: '-0.01em',
                  }}>
                    {order.id}
                  </h2>
                </div>
                <div style={{
                  background: statusColor + '1f',
                  border: `1.5px solid ${statusColor}`,
                  borderRadius: '999px', padding: '0.3125rem 0.875rem',
                  color: statusColor, fontSize: '0.6875rem',
                  fontWeight: 700, letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}>
                  {order.status === 'ON_THE_WAY' ? 'ON THE WAY' : order.status}
                </div>
              </div>

              {/* ── Animated Progress Bar ── */}
              {order.status !== 'CANCELLED' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{
                    background: '#1f1c1a', borderRadius: '999px',
                    height: '6px', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '999px',
                      background: `linear-gradient(90deg, ${ORANGE}, #ff8c42)`,
                      width: `${progressPct}%`,
                      transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: `0 0 12px ${ORANGE}66`,
                    }} />
                  </div>
                </div>
              )}

              {/* ── Timeline Steps ── */}
              {order.status !== 'CANCELLED' && (
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  {STEPS.map((step, i) => {
                    const done = i < stepIndex;
                    const active = i === stepIndex;
                    return (
                      <div key={step.key} style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', position: 'relative',
                      }}>
                        {i > 0 && (
                          <div style={{
                            position: 'absolute', left: '-50%', top: '9px',
                            width: '100%', height: '2px',
                            background: done || active ? ORANGE : '#2a2624',
                            transition: 'background 0.6s ease', zIndex: 0,
                          }} />
                        )}
                        <div style={{ position: 'relative', zIndex: 1, marginBottom: '0.5rem' }}>
                          {done ? (
                            <div style={{
                              width: '20px', height: '20px', borderRadius: '50%',
                              background: ORANGE,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: `0 0 8px ${ORANGE}66`,
                            }}>
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          ) : active ? (
                            <div style={{ position: 'relative', width: '20px', height: '20px' }}>
                              <span style={{
                                position: 'absolute', inset: 0,
                                borderRadius: '50%', background: ORANGE,
                                animation: 'ping 1.4s cubic-bezier(0,0,0.2,1) infinite',
                                opacity: 0.6,
                              }} />
                              <div style={{
                                position: 'relative', width: '20px', height: '20px',
                                borderRadius: '50%', background: ORANGE,
                                boxShadow: `0 0 16px ${ORANGE}aa, inset 0 0 6px #fff4`,
                              }} />
                            </div>
                          ) : (
                            <div style={{
                              width: '20px', height: '20px', borderRadius: '50%',
                              background: '#1a1614', border: '2px solid #2a2624',
                            }} />
                          )}
                        </div>
                        <p style={{
                          fontSize: '0.6rem', textAlign: 'center', margin: 0,
                          lineHeight: 1.2, padding: '0 2px',
                          color: done ? ORANGE : active ? '#fff' : '#4a4543',
                          fontWeight: active ? 700 : done ? 600 : 400,
                          fontFamily: active ? "'Bricolage Grotesque', sans-serif" : "'Inter', sans-serif",
                        }}>
                          {step.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {order.status === 'CANCELLED' && (
                <div style={{
                  textAlign: 'center', padding: '1.5rem 0',
                  color: '#ef4444', fontSize: '0.9375rem',
                }}>
                  ✕ This order was cancelled
                </div>
              )}
            </section>

            {/* ── ETA Strip ── */}
            {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
              <section style={{
                background: 'linear-gradient(135deg, #1a0e08, #200f00)',
                border: `1px solid ${ORANGE}44`, borderRadius: '1rem',
                padding: '1rem 1.25rem', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.875rem',
                boxShadow: `0 0 24px ${ORANGE}11`,
              }}>
                <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>⏱</span>
                <div>
                  <p style={{
                    margin: 0, color: ORANGE, fontWeight: 700, fontSize: '1.0625rem',
                    fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.01em',
                  }}>
                    {eta > 0 ? `~${eta} minute${eta !== 1 ? 's' : ''} away` : 'Arriving very soon!'}
                  </p>
                  <p style={{ margin: '0.125rem 0 0', color: '#888', fontSize: '0.75rem' }}>
                    Estimated delivery time
                  </p>
                </div>
              </section>
            )}

            {order.status === 'DELIVERED' && (
              <section style={{
                background: 'linear-gradient(135deg, #061a0c, #0a2614)',
                border: '1px solid #22c55e44', borderRadius: '1rem',
                padding: '1rem 1.25rem', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.875rem',
              }}>
                <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>🎉</span>
                <div>
                  <p style={{
                    margin: 0, color: '#22c55e', fontWeight: 700, fontSize: '1.0625rem',
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                  }}>
                    Order Delivered!
                  </p>
                  <p style={{ margin: '0.125rem 0 0', color: '#888', fontSize: '0.75rem' }}>
                    Enjoy your meal — don't forget to rate it!
                  </p>
                </div>
              </section>
            )}

            {/* ── Details Grid ── */}
            <section style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.625rem', marginBottom: '1rem',
            }}>
              {[
                { icon: '📍', label: 'Deliver To', value: order.roomNumber ? `${order.deliverTo}, Rm ${order.roomNumber}` : order.deliverTo },
                { icon: '🕐', label: 'Placed',     value: `${fmtDate(order.createdAt)} · ${fmtTime(order.createdAt)}` },
                { icon: '🏪', label: 'Vendor',     value: order.vendor.storeName },
                { icon: '💳', label: 'Payment',    value: `${PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod} · ${ghs(order.totalAmount)}` },
              ].map((item) => (
                <div key={item.label} style={{
                  background: '#0f0d0c', border: '1px solid #1f1c1a',
                  borderRadius: '0.75rem', padding: '0.875rem',
                }}>
                  <p style={{
                    margin: '0 0 0.375rem', color: '#666', fontSize: '0.65rem',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    <span style={{ marginRight: '0.25rem' }}>{item.icon}</span>{item.label}
                  </p>
                  <p style={{
                    margin: 0, color: '#e5e5e5', fontSize: '0.875rem',
                    fontWeight: 600, lineHeight: 1.3,
                  }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </section>

            {/* ── Rider Card ── */}
            {order.riderName && (
              <section style={{
                background: '#0f0d0c', border: '1px solid #1f1c1a',
                borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '1rem',
              }}>
                <p style={{
                  margin: '0 0 0.75rem', color: '#666', fontSize: '0.65rem',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  🛵 Your Rider
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${ORANGE}, #ff8c42)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
                    fontSize: '1rem', color: '#fff', flexShrink: 0,
                    boxShadow: `0 4px 12px ${ORANGE}44`,
                  }}>
                    {getInitials(order.riderName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 0.1875rem', fontWeight: 700, fontSize: '0.9375rem' }}>
                      {order.riderName}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} style={{
                          color: s <= 4 ? ORANGE : '#2a2624', fontSize: '0.75rem',
                        }}>★</span>
                      ))}
                      <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: '0.375rem' }}>
                        4.8
                      </span>
                    </div>
                  </div>
                  {order.riderPhone && (
                    <a
                      href={`tel:${order.riderPhone}`}
                      style={{
                        background: ORANGE, color: '#fff', borderRadius: '0.5rem',
                        padding: '0.5rem 0.875rem', textDecoration: 'none',
                        fontSize: '0.8125rem', fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: '0.3125rem',
                        fontFamily: "'Bricolage Grotesque', sans-serif",
                      }}
                    >
                      📞 Call
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* ── Order Items ── */}
            <section style={{
              background: '#0f0d0c', border: '1px solid #1f1c1a',
              borderRadius: '1rem', padding: '1.25rem', marginBottom: '1rem',
            }}>
              <p style={{
                margin: '0 0 1rem', fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em',
              }}>
                Your Order
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {order.items.map((item) => (
                  <div key={item.id} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: '0.5rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <span style={{
                        background: ORANGE + '22', color: ORANGE,
                        borderRadius: '0.375rem', padding: '0.125rem 0.4375rem',
                        fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                      }}>
                        ×{item.quantity}
                      </span>
                      <span style={{
                        color: '#ccc', fontSize: '0.875rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.menuItem.name}
                      </span>
                    </div>
                    <span style={{ color: '#e5e5e5', fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }}>
                      {ghs(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                borderTop: '1px solid #1f1c1a', marginTop: '1rem',
                paddingTop: '0.875rem',
                display: 'flex', flexDirection: 'column', gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.875rem' }}>
                  <span>Subtotal</span>
                  <span>{ghs(order.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.875rem' }}>
                  <span>Delivery Fee</span>
                  <span>{ghs(order.deliveryFee)}</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  color: '#fff', fontSize: '1.0625rem', fontWeight: 700,
                  marginTop: '0.25rem', paddingTop: '0.5rem',
                  borderTop: '1px dashed #1f1c1a',
                }}>
                  <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Total</span>
                  <span style={{ color: ORANGE }}>{ghs(order.totalAmount)}</span>
                </div>
              </div>
            </section>

            {/* ── Quick Actions ── */}
            <section style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.625rem',
            }}>
              <a
                href={`https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(`Hello CampusChoo, I need help with order ${order.id}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#0a1a0e', border: '1px solid #1a3a22',
                  borderRadius: '0.75rem', padding: '0.875rem 0.5rem',
                  textAlign: 'center', textDecoration: 'none', color: '#4ade80',
                  fontSize: '0.75rem', fontWeight: 600,
                  display: 'flex', flexDirection: 'column',
                  gap: '0.375rem', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>💬</span>
                <span>Support</span>
              </a>
              <a
                href={`https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(`Reporting an issue with order ${order.id}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#1a0e08', border: '1px solid #3a1f0e',
                  borderRadius: '0.75rem', padding: '0.875rem 0.5rem',
                  textAlign: 'center', textDecoration: 'none', color: '#fb923c',
                  fontSize: '0.75rem', fontWeight: 600,
                  display: 'flex', flexDirection: 'column',
                  gap: '0.375rem', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <span>Report Issue</span>
              </a>
              <button
                onClick={() => navigate(`/menu?vendorId=${order.vendorId}`)}
                style={{
                  background: '#0e0e1a', border: '1px solid #1f1f3a',
                  borderRadius: '0.75rem', padding: '0.875rem 0.5rem',
                  textAlign: 'center', cursor: 'pointer', color: '#818cf8',
                  fontSize: '0.75rem', fontWeight: 600,
                  display: 'flex', flexDirection: 'column',
                  gap: '0.375rem', alignItems: 'center',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>🔄</span>
                <span>Reorder</span>
              </button>
            </section>
          </>
        )}

        {/* ── Empty state ── */}
        {!order && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#444' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem', opacity: 0.5 }}>🛵</div>
            <h2 style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
              fontSize: '1.125rem', color: '#666', marginBottom: '0.5rem',
            }}>
              Track Your Order
            </h2>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, maxWidth: '280px', margin: '0 auto' }}>
              Enter your order ID above or open the link from your confirmation SMS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentBanner({ state }: { state: PayBanner }) {
  const styles: Record<PayBanner['kind'], { bg: string; border: string; text: string; emoji: string; title: string; body: string }> = {
    idle:      { bg: '',          border: '',          text: '',         emoji: '',  title: '',                          body: '' },
    verifying: { bg: '#0a1330',    border: '#1e3a8a',   text: '#bfdbfe',  emoji: '⏳', title: 'Verifying payment…',         body: 'Hold on a second while we confirm your payment with Paystack.' },
    paid:      { bg: '#0a1f10',    border: '#166534',   text: '#86efac',  emoji: '✅', title: 'Payment received',           body: state.kind === 'paid' && state.channel ? `Paid via ${state.channel}. Your order is on its way.` : 'Your order is confirmed and on its way.' },
    failed:    { bg: '#1f0a0a',    border: '#7f1d1d',   text: '#fca5a5',  emoji: '⚠️', title: 'Payment was not completed',  body: state.kind === 'failed' && state.reason ? `Paystack reported: ${state.reason}. You can retry from the order page.` : 'Your payment did not go through. Please try again.' },
    pending:   { bg: '#1f1810',    border: '#9a6e1e',   text: '#fde68a',  emoji: '⏱', title: 'Payment still processing',   body: 'Paystack has not confirmed your payment yet. We will update this page automatically as soon as it does.' },
    error:     { bg: '#1f0a0a',    border: '#7f1d1d',   text: '#fca5a5',  emoji: '⚠️', title: 'Could not verify',           body: state.kind === 'error' ? state.message : 'Unknown error.' },
  };
  const s = styles[state.kind];
  if (!s.title) return null;
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      borderRadius: '0.875rem', padding: '1rem 1.125rem', marginBottom: '1rem',
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    }}>
      <span style={{ fontSize: '1.25rem', flexShrink: 0, lineHeight: 1 }}>{s.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '0.9375rem', marginBottom: 2 }}>
          {s.title}
        </div>
        <div style={{ fontSize: '0.8125rem', opacity: 0.9, lineHeight: 1.5 }}>
          {s.body}
        </div>
      </div>
    </div>
  );
}
