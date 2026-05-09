import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../lib/authStore';
import { api } from '../lib/api';

const ORANGE = '#F4521E';
const BG = '#080706';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.07)';
const MUTED = '#9A8E85';

interface OrderRow {
  id: string;
  status: string;
  totalAmount: number | string;
  createdAt: string;
  vendor: { storeName: string };
  items: { id: string; quantity: number; menuItem: { name: string } }[];
}

export default function Account() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Profile /> : <AuthScreen />;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [search] = useSearchParams();
  const redirect = search.get('redirect') ?? '/';

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', padding: '88px 24px 24px' }}>
        <div style={{
          width: '100%', maxWidth: 440,
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 28, padding: '44px 40px', backdropFilter: 'blur(20px)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28,
              color: '#fff', margin: 0, letterSpacing: '-0.5px',
            }}>
              Campus<span style={{ color: ORANGE }}>Choo</span>
            </h1>
          </div>

          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.05)',
            borderRadius: 12, padding: 4, marginBottom: 28, gap: 4,
          }}>
            <TabBtn active={tab === 'login'} onClick={() => setTab('login')}>Sign In</TabBtn>
            <TabBtn active={tab === 'register'} onClick={() => setTab('register')}>Register</TabBtn>
          </div>

          {tab === 'login' ? <LoginForm redirect={redirect} /> : <RegisterForm redirect={redirect} />}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: 10, border: 'none', borderRadius: 9,
      fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700,
      cursor: 'pointer', transition: 'all 0.2s',
      color: active ? '#fff' : MUTED, background: active ? ORANGE : 'transparent',
    }}>{children}</button>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: MUTED, fontWeight: 600, marginBottom: 7, display: 'block' }}>
        {label}
      </label>
      <input {...props} style={{
        width: '100%', padding: '13px 16px',
        border: `1.5px solid ${BORDER}`, borderRadius: 12,
        background: 'rgba(255,255,255,0.05)', color: '#fff',
        fontSize: 14, fontFamily: "'DM Sans', sans-serif",
        outline: 'none', boxSizing: 'border-box',
      }} />
    </div>
  );
}

function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading} style={{
      width: '100%', padding: 15, marginTop: 8,
      background: ORANGE, color: '#fff', border: 'none', borderRadius: 14,
      fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800,
      cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
    }}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ background: '#1a0808', border: '1px solid #7f1d1d', borderRadius: 10, padding: 12, marginBottom: 12, color: '#fca5a5', fontSize: 13 }}>
      ⚠️ {message}
    </div>
  );
}

function LoginForm({ redirect }: { redirect: string }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(''); setLoading(true);
    const r = await login(email, password);
    setLoading(false);
    if (r.ok) navigate(redirect);
    else setErr(r.message ?? 'Login failed');
  }

  return (
    <form onSubmit={submit}>
      {err && <ErrorBox message={err} />}
      <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
      <Field label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      <SubmitBtn loading={loading}>Sign In →</SubmitBtn>
    </form>
  );
}

function RegisterForm({ redirect }: { redirect: string }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', level: '', password: '', role: 'BUYER' as 'BUYER' | 'VENDOR' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(''); setLoading(true);
    const r = await register({
      name: form.name, email: form.email, phone: form.phone, password: form.password,
      role: form.role, level: form.level || undefined,
    });
    setLoading(false);
    if (r.ok) navigate(redirect);
    else setErr(r.message ?? 'Registration failed');
  }

  return (
    <form onSubmit={submit}>
      {err && <ErrorBox message={err} />}
      <Field label="Full Name" required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Ama Asante" />
      <Field label="Email" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="ama@stu.umat.edu.gh" />
      <Field label="Phone Number" type="tel" required value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="0551 234 567" />
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: MUTED, fontWeight: 600, marginBottom: 7, display: 'block' }}>I am a…</label>
        <select value={form.role} onChange={(e) => update('role', e.target.value as 'BUYER' | 'VENDOR')} style={{
          width: '100%', padding: '13px 16px', border: `1.5px solid ${BORDER}`,
          borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: '#fff',
          fontSize: 14, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
        }}>
          <option value="BUYER" style={{ background: '#1a1510' }}>Student / Staff (buyer)</option>
          <option value="VENDOR" style={{ background: '#1a1510' }}>Food Vendor</option>
        </select>
      </div>
      {form.role === 'BUYER' && (
        <Field label="Level (optional)" value={form.level} onChange={(e) => update('level', e.target.value)} placeholder="e.g. 100, 200, Staff" />
      )}
      <Field label="Password" type="password" required minLength={6} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="At least 6 characters" />
      <SubmitBtn loading={loading}>Create Account →</SubmitBtn>
    </form>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [section, setSection] = useState<'overview' | 'orders' | 'settings'>('overview');

  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/orders/my?limit=50');
        if (res.ok) setOrders(await res.json());
      } catch { /* ignore */ }
    })();
  }, []);

  if (!user) return null;

  const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const totalSpent = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((s, o) => s + Number(o.totalAmount), 0);

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />
      <div style={{ padding: '88px 5% 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, alignItems: 'start' }}>
          {/* Sidebar */}
          <aside style={{
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: 22,
            padding: 28, position: 'sticky', top: 88,
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: `linear-gradient(135deg, ${ORANGE}, #F9C13A)`,
                margin: '0 auto 12px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: '#fff',
              }}>{initials}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 3 }}>
                {user.name}
              </div>
              <span style={{
                fontSize: 12, color: '#FF7A4D',
                background: 'rgba(244,82,30,0.12)',
                padding: '3px 10px', borderRadius: 999, display: 'inline-block',
              }}>
                {user.role === 'VENDOR' ? 'Vendor' : `${user.level ? `Level ${user.level}` : 'Buyer'}`}
              </span>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <NavItem active={section === 'overview'} onClick={() => setSection('overview')}>📊 Overview</NavItem>
              <NavItem active={section === 'orders'} onClick={() => setSection('orders')}>🧾 Orders ({orders.length})</NavItem>
              <NavItem active={section === 'settings'} onClick={() => setSection('settings')}>⚙️ Settings</NavItem>
              {user.role === 'VENDOR' && (
                <NavItem active={false} onClick={() => navigate('/portal')}>🪪 Vendor Portal</NavItem>
              )}
            </nav>
            <button onClick={async () => { await logout(); navigate('/'); }} style={{
              marginTop: 20, paddingTop: 16, borderTop: `1px solid ${BORDER}`,
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', borderRadius: 12,
              fontSize: 14, fontWeight: 500, color: '#ef4444',
              cursor: 'pointer', border: 'none', background: 'transparent',
              fontFamily: "'DM Sans', sans-serif",
            }}>🚪 Sign out</button>
          </aside>

          {/* Main */}
          <div>
            {section === 'overview' && (
              <>
                <Section title="Your Activity">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <Stat n={String(orders.length)} l="Total Orders" />
                    <Stat n={`GHS ${totalSpent.toFixed(0)}`} l="Total Spent" />
                    <Stat n="—" l="Saved Addresses" />
                  </div>
                </Section>
                <Section title="Recent Orders">
                  {orders.length === 0
                    ? <Empty icon="🛒" title="No orders yet" hint="Browse vendors to get started." />
                    : <OrderList orders={orders.slice(0, 5)} />}
                </Section>
              </>
            )}

            {section === 'orders' && (
              <Section title={`All Orders (${orders.length})`}>
                {orders.length === 0
                  ? <Empty icon="📭" title="No orders yet" hint="Your order history will appear here." />
                  : <OrderList orders={orders} />}
              </Section>
            )}

            {section === 'settings' && (
              <Section title="Profile Settings">
                <FieldStatic label="Full Name" value={user.name} />
                <FieldStatic label="Email" value={user.email} />
                <FieldStatic label="Phone Number" value={user.phone} />
                <FieldStatic label="Role" value={user.role} />
                {user.level && <FieldStatic label="Level" value={user.level} />}
                <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
                  Editing profile fields isn't supported yet — coming soon.
                </p>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px', borderRadius: 12,
      fontSize: 14, fontWeight: 500,
      color: active ? ORANGE : MUTED,
      cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%',
      background: active ? 'rgba(244,82,30,0.12)' : 'transparent',
      fontFamily: "'DM Sans', sans-serif",
    }}>{children}</button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 22, padding: '28px 32px', marginBottom: 20 }}>
      <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 20px', letterSpacing: '-0.5px' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, textAlign: 'center' }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: ORANGE, letterSpacing: '-1px' }}>{n}</div>
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 3 }}>{l}</div>
    </div>
  );
}

function FieldStatic({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px', color: MUTED, fontWeight: 600, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{value}</p>
    </div>
  );
}

function Empty({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: MUTED }}>
      <div style={{ fontSize: 36, opacity: 0.6, marginBottom: 8 }}>{icon}</div>
      <p style={{ color: '#ccc', fontWeight: 600, marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 13 }}>{hint}</p>
    </div>
  );
}

function OrderList({ orders }: { orders: OrderRow[] }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {orders.map((o) => (
        <div key={o.id} onClick={() => navigate(`/track/${o.id}`)} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`,
          borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
        }}>
          <div style={{ fontSize: 26 }}>🍽️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
              {o.items.map((i) => `${i.menuItem.name} ×${i.quantity}`).join(', ')}
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>
              {o.vendor.storeName} · {o.id}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
              {new Date(o.createdAt).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: ORANGE }}>
              GHS {Number(o.totalAmount).toFixed(0)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
