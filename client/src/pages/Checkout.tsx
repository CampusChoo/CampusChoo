import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useCart } from '../lib/cartStore';
import { useAuth } from '../lib/authStore';
import { api } from '../lib/api';

const ORANGE = '#F4521E';
const BG = '#060504';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.07)';
const MUTED = '#928579';

const BUILDINGS = [
  { group: 'Hostels', options: ['Hostel A — Block 1', 'Hostel A — Block 2', 'Hostel B — Block 1', 'Hostel B — Block 2', 'Hostel C', 'Hostel D', 'Staff Bungalows'] },
  { group: 'Academic', options: ['Main Lecture Hall', 'Engineering Block', 'Science Block', 'Library', 'Admin Block'] },
];

const PAYMENT_OPTIONS = [
  { value: 'MTN_MOMO',         label: 'MTN Mobile Money',  emoji: '📱', popular: true },
  { value: 'VODAFONE_CASH',    label: 'Vodafone Cash',     emoji: '📲', popular: false },
  { value: 'AIRTELTIGO_MONEY', label: 'AirtelTigo Money',  emoji: '📳', popular: false },
] as const;

const DELIVERY_FEE = 15;

export default function Checkout() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const cart = useCart();

  const [step, setStep] = useState<1 | 2>(1);
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [vendorNote, setVendorNote] = useState('');
  const [payment, setPayment] = useState<'MTN_MOMO' | 'VODAFONE_CASH' | 'AIRTELTIGO_MONEY'>('MTN_MOMO');
  const [momoNumber, setMomoNumber] = useState(user?.phone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [orderId, setOrderId] = useState('');

  const total = cart.subtotal + (cart.lines.length > 0 ? DELIVERY_FEE : 0);

  if (authLoading) return null;

  if (!user) {
    return (
      <FullPageMessage
        icon="🔒"
        title="Sign in to checkout"
        message="You need an account to place an order."
        cta={<Link to="/account?redirect=/checkout" style={ctaStyle}>Sign In →</Link>}
      />
    );
  }

  if (cart.lines.length === 0 && !orderId) {
    return (
      <FullPageMessage
        icon="🛒"
        title="Your cart is empty"
        message="Add something delicious from the menu first."
        cta={<Link to="/menu" style={ctaStyle}>Browse Menu →</Link>}
      />
    );
  }

  function continueToPayment(e: FormEvent) {
    e.preventDefault();
    if (!building) { setErr('Please select a building.'); return; }
    setErr('');
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function placeOrder() {
    if (!cart.vendorId) { setErr('Cart is empty.'); return; }
    setErr(''); setSubmitting(true);
    try {
      const res = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: cart.vendorId,
          items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.qty })),
          deliverTo: building,
          roomNumber: room || undefined,
          paymentMethod: payment,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.message ?? 'Could not place order.');
        return;
      }
      setOrderId(body.id);
      cart.clear();
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#ECE4DC', fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />

      {/* Success overlay */}
      {orderId && <SuccessOverlay orderId={orderId} />}

      <div style={{ padding: '88px 5% 80px', maxWidth: 1040, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }}>
        <div>
          {/* Steps */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Step n={1} name="Delivery Details" state={step === 1 ? 'active' : 'done'} />
            <div style={{ flex: 1, height: 1, background: BORDER, margin: '0 12px', maxWidth: 60 }} />
            <Step n={2} name="Payment" state={step === 2 ? 'active' : 'pending'} />
          </div>

          {err && <ErrorBox message={err} />}

          {step === 1 && (
            <form onSubmit={continueToPayment}>
              <FormSection num={1} title="Delivery Location">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <FieldGroup label="Building / Hostel">
                    <select required value={building} onChange={(e) => setBuilding(e.target.value)} style={selectStyle}>
                      <option value="">Select building…</option>
                      {BUILDINGS.map((g) => (
                        <optgroup key={g.group} label={g.group} style={{ background: '#141210' }}>
                          {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </FieldGroup>
                  <FieldGroup label="Room / Floor">
                    <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 14B" style={inputStyle} />
                  </FieldGroup>
                </div>
              </FormSection>

              <FormSection num={2} title="Your Contact">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <FieldGroup label="Full Name">
                    <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                  </FieldGroup>
                  <FieldGroup label="Phone Number">
                    <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
                  </FieldGroup>
                </div>
              </FormSection>

              <FormSection num={3} title="Note to Vendor">
                <textarea
                  value={vendorNote} onChange={(e) => setVendorNote(e.target.value)}
                  placeholder="e.g. No pepper, extra sauce…"
                  style={{ ...inputStyle, height: 80, width: '100%', resize: 'none' }}
                />
              </FormSection>

              <button type="submit" style={primaryBtn}>Continue to Payment →</button>
            </form>
          )}

          {step === 2 && (
            <>
              <FormSection num="💳" title="Choose Payment Method">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {PAYMENT_OPTIONS.map((opt) => (
                    <PayOption key={opt.value} option={opt} selected={payment === opt.value} onClick={() => setPayment(opt.value)} />
                  ))}
                </div>
                <FieldGroup label="MoMo Number">
                  <input required type="tel" value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} placeholder="e.g. 0241 234 567" style={inputStyle} />
                </FieldGroup>
                <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
                  💡 You'll receive a payment prompt on this number. Approve it to complete your order.
                </p>
              </FormSection>

              <button onClick={placeOrder} disabled={submitting} style={primaryBtn}>
                🚀 {submitting ? 'Placing…' : `Place Order & Pay GHS ${total.toFixed(0)}`}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 10 }}>
                Payments are processed securely via Paystack.
              </p>

              <button onClick={() => setStep(1)} style={{
                marginTop: 16, width: '100%', padding: 12,
                background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`,
                borderRadius: 12, fontSize: 13, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}>← Back to delivery details</button>
            </>
          )}
        </div>

        <OrderSummary lines={cart.lines} subtotal={cart.subtotal} delivery={DELIVERY_FEE} total={total} building={building} room={room} />
      </div>
    </div>
  );
}

function Step({ n, name, state }: { n: number; name: string; state: 'active' | 'done' | 'pending' }) {
  const colors = {
    active: { bg: ORANGE, border: ORANGE, color: '#fff', name: '#fff' },
    done:   { bg: '#1A7A3C', border: '#1A7A3C', color: '#fff', name: MUTED },
    pending: { bg: 'transparent', border: BORDER, color: MUTED, name: MUTED },
  }[state];

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800,
        border: `2px solid ${colors.border}`,
        background: colors.bg, color: colors.color, flexShrink: 0,
      }}>{state === 'done' ? '✓' : n}</div>
      <span style={{ fontSize: 13, fontWeight: state === 'active' ? 700 : 500, color: colors.name, marginLeft: 8, whiteSpace: 'nowrap' }}>
        {name}
      </span>
    </div>
  );
}

function FormSection({ num, title, children }: { num: number | string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 22,
      padding: '28px 32px', marginBottom: 20, backdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(244,82,30,0.15)', border: '1px solid rgba(244,82,30,0.3)',
          color: ORANGE, fontFamily: "'Syne', sans-serif",
          fontSize: 13, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{num}</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: MUTED, fontWeight: 600, marginBottom: 7 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function PayOption({ option, selected, onClick }: { option: typeof PAYMENT_OPTIONS[number]; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '16px 18px',
      border: `1.5px solid ${selected ? ORANGE : BORDER}`,
      background: selected ? 'rgba(244,82,30,0.07)' : 'transparent',
      borderRadius: 14, cursor: 'pointer',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        border: `2px solid ${selected ? ORANGE : BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {selected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: ORANGE }} />}
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: 'rgba(249,193,58,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>{option.emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{option.label}</div>
        <div style={{ fontSize: 12, color: MUTED }}>Pay with your {option.label} wallet</div>
      </div>
      {option.popular && (
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
          background: 'rgba(26,122,60,0.15)', color: '#23A852',
          border: '1px solid rgba(26,122,60,0.25)',
          padding: '3px 9px', borderRadius: 999,
        }}>Popular</span>
      )}
    </div>
  );
}

function OrderSummary({ lines, subtotal, delivery, total, building, room }: {
  lines: { menuItemId: string; name: string; price: number; qty: number; vendorName: string }[];
  subtotal: number; delivery: number; total: number;
  building: string; room: string;
}) {
  const vendorName = lines[0]?.vendorName ?? 'Vendor';
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 22,
      overflow: 'hidden', backdropFilter: 'blur(10px)', position: 'sticky', top: 88,
    }}>
      <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 }}>
          Order Summary
        </div>
        <div style={{ fontSize: 12, color: MUTED }}>
          {itemCount} item{itemCount !== 1 ? 's' : ''} · {vendorName}
        </div>
      </div>

      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lines.map((l) => (
          <div key={l.menuItemId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 22, width: 36, textAlign: 'center', flexShrink: 0 }}>🍽️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{l.name}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{l.vendorName}</div>
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>×{l.qty}</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: ORANGE, flexShrink: 0 }}>
              GHS {(l.price * l.qty).toFixed(0)}
            </div>
          </div>
        ))}
      </div>

      {building && (
        <div style={{
          margin: '0 24px 16px',
          background: 'rgba(26,122,60,0.1)', border: '1px solid rgba(26,122,60,0.2)',
          borderRadius: 12, padding: '12px 16px',
          fontSize: 13, color: '#4ADE80',
        }}>
          📍 {building}{room ? `, ${room}` : ''}
        </div>
      )}

      <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}` }}>
        <Row label="Subtotal" value={`GHS ${subtotal.toFixed(0)}`} />
        <Row label="Delivery fee" value={`GHS ${delivery}`} />
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
          color: '#fff', paddingTop: 14, marginTop: 8, borderTop: `1px solid ${BORDER}`,
        }}>
          <span>Total</span>
          <span style={{ color: ORANGE }}>GHS {total.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, padding: '4px 0' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function SuccessOverlay({ orderId }: { orderId: string }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(6,5,4,0.97)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', textAlign: 'center', padding: 40,
    }}>
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        border: '3px solid #23A852',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 52, marginBottom: 28, color: '#23A852',
        boxShadow: '0 0 40px rgba(26,122,60,0.4)',
      }}>✓</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: '-1.5px', marginBottom: 10 }}>
        Order placed!
      </div>
      <p style={{ fontSize: 16, color: MUTED, maxWidth: 380, marginBottom: 8 }}>
        Your food is being prepared. Your rider will pick it up shortly.
      </p>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: ORANGE, marginBottom: 32, letterSpacing: '-0.5px' }}>
        {orderId}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to={`/track/${orderId}`} style={{
          padding: '14px 28px', borderRadius: 999, background: ORANGE, color: '#fff',
          fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>🛵 Track My Order</Link>
        <Link to="/menu" style={{
          padding: '14px 28px', borderRadius: 999,
          background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`,
          fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>Order Again</Link>
      </div>
    </div>
  );
}

function FullPageMessage({ icon, title, message, cta }: { icon: string; title: string; message: string; cta: React.ReactNode }) {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />
      <div style={{ paddingTop: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>{icon}</div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, color: '#fff', marginBottom: 12, letterSpacing: '-0.5px' }}>{title}</h1>
        <p style={{ color: MUTED, fontSize: 15, marginBottom: 28, maxWidth: 360 }}>{message}</p>
        {cta}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px',
  border: `1.5px solid ${BORDER}`, borderRadius: 12,
  background: 'rgba(255,255,255,0.05)', color: '#fff',
  fontSize: 14, fontFamily: "'DM Sans', sans-serif",
  outline: 'none', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'none', paddingRight: 36 };

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: 17,
  background: ORANGE, color: '#fff', border: 'none', borderRadius: 14,
  fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};

const ctaStyle: React.CSSProperties = {
  background: ORANGE, color: '#fff', padding: '14px 28px',
  borderRadius: 999, fontFamily: "'Syne', sans-serif",
  fontSize: 15, fontWeight: 700, textDecoration: 'none',
};

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ background: '#1a0808', border: '1px solid #7f1d1d', borderRadius: 12, padding: 14, marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>
      ⚠️ {message}
    </div>
  );
}
