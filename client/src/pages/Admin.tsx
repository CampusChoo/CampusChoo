import { useState, useEffect, type InputHTMLAttributes } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../lib/authStore';
import { api } from '../lib/api';

const BG = '#080706';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.08)';
const ORANGE = '#F4521E';
const MUTED = '#9A8E85';

function Field({ label, type, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          {...props}
          type={inputType}
          style={{
            width: '100%', padding: isPassword ? '14px 44px 14px 16px' : '14px 16px', borderRadius: 14,
            border: `1.5px solid ${BORDER}`, background: 'rgba(255,255,255,0.04)',
            color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: MUTED,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
            }}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                <line x1="2" y1="2" x2="22" y2="22"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Button({ children, loading, ...props }: { children: React.ReactNode; loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      style={{
        width: '100%', padding: 14, border: 'none', borderRadius: 16,
        background: ORANGE, color: '#fff', fontSize: 15, fontWeight: 800,
        cursor: loading || props.disabled ? 'not-allowed' : 'pointer', opacity: loading || props.disabled ? 0.65 : 1,
      }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}

function Message({ children }: { children: string }) {
  return (
    <div style={{ marginBottom: 20, padding: 14, borderRadius: 14, background: '#131315', color: '#fff', lineHeight: 1.5, border: `1px solid ${BORDER}` }}>
      {children}
    </div>
  );
}

interface AdminStats {
  usersCount: number;
  vendorsCount: number;
  ordersCount: number;
  totalRevenue: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'BUYER' | 'VENDOR' | 'ADMIN';
  createdAt: string;
}

interface AdminVendor {
  id: string;
  userId: string;
  storeName: string;
  description: string;
  location: string;
  isOpen: boolean;
  rating: number;
  user?: { email: string; phone: string };
}

interface AdminOrder {
  id: string;
  buyerId: string;
  vendorId: string;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';
  deliverTo: string;
  totalAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  vendor?: { storeName: string };
  user?: { name: string; phone: string };
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'vendors' | 'orders'>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [vendors, setVendors] = useState<AdminVendor[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, vendorsRes, ordersRes] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/users'),
        api('/api/admin/vendors'),
        api('/api/admin/orders'),
      ]);

      if (!statsRes.ok || !usersRes.ok || !vendorsRes.ok || !ordersRes.ok) {
        throw new Error('Failed to fetch admin data.');
      }

      setStats(await statsRes.json());
      setUsers(await usersRes.json());
      setVendors(await vendorsRes.json());
      setOrders(await ordersRes.json());
    } catch (err: any) {
      setError(err?.message ?? 'An error occurred while loading dashboard.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleVendorOpen(vendorId: string) {
    try {
      const res = await api(`/api/vendors/${vendorId}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to toggle vendor status');
      const updated = await res.json();
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, isOpen: updated.isOpen } : v));
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleChangeUserRole(userId: string, role: string) {
    setUpdatingId(userId);
    try {
      const res = await api(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update user role');
      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: updated.role } : u));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleChangeOrderStatus(orderId: string, status: string) {
    try {
      const res = await api(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update order status');
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: updated.status } : o));
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>
        <p>Loading Admin Dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ background: '#3f1313', color: '#ffc4c4', padding: 16, borderRadius: 14, display: 'inline-block', maxWidth: 500 }}>
          <p style={{ margin: 0 }}>⚠️ {error}</p>
          <button onClick={fetchData} style={{ marginTop: 12, padding: '8px 16px', background: ORANGE, border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Overview stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ padding: 24, borderRadius: 18, background: CARD, border: `1.5px solid ${BORDER}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: '#4ADE80' }}>GH₵ {stats?.totalRevenue.toFixed(2)}</div>
        </div>
        <div style={{ padding: 24, borderRadius: 18, background: CARD, border: `1.5px solid ${BORDER}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Orders</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: '#fff' }}>{stats?.ordersCount}</div>
        </div>
        <div style={{ padding: 24, borderRadius: 18, background: CARD, border: `1.5px solid ${BORDER}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Users</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: '#fff' }}>{stats?.usersCount}</div>
        </div>
        <div style={{ padding: 24, borderRadius: 18, background: CARD, border: `1.5px solid ${BORDER}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendors</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: '#fff' }}>{stats?.vendorsCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: `1.5px solid ${BORDER}`, paddingBottom: 12, marginBottom: 20, overflowX: 'auto' }}>
        {(['stats', 'users', 'vendors', 'orders'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 18px',
              background: activeTab === tab ? ORANGE : 'transparent',
              color: activeTab === tab ? '#fff' : MUTED,
              border: 'none',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 24, padding: 24, overflowX: 'auto' }}>
        {activeTab === 'stats' && (
          <div>
            <h3 style={{ margin: '0 0 10px', fontSize: 20 }}>System Status</h3>
            <p style={{ color: MUTED, margin: '0 0 20px', fontSize: 14 }}>Overview of database connections and SMS API status.</p>
            <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderRadius: 12, background: '#09090b', border: `1px solid ${BORDER}` }}>
                <span>Database Connectivity</span>
                <span style={{ color: '#4ADE80', fontWeight: 700 }}>Operational</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderRadius: 12, background: '#09090b', border: `1px solid ${BORDER}` }}>
                <span>SMS Gateway (mNotify)</span>
                <span style={{ color: '#4ADE80', fontWeight: 700 }}>Operational</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${BORDER}`, textAlign: 'left', color: MUTED }}>
                <th style={{ padding: 12 }}>Name</th>
                <th style={{ padding: 12 }}>Email</th>
                <th style={{ padding: 12 }}>Phone</th>
                <th style={{ padding: 12 }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: 12, fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: 12, color: MUTED }}>{u.email}</td>
                  <td style={{ padding: 12, color: MUTED }}>{u.phone || 'N/A'}</td>
                  <td style={{ padding: 12 }}>
                    <select
                      value={u.role}
                      disabled={updatingId === u.id}
                      onChange={(e) => handleChangeUserRole(u.id, e.target.value)}
                      style={{ background: '#09090b', color: '#fff', border: `1.5px solid ${BORDER}`, padding: '6px 12px', borderRadius: 8, outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="BUYER">Buyer</option>
                      <option value="VENDOR">Vendor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'vendors' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${BORDER}`, textAlign: 'left', color: MUTED }}>
                <th style={{ padding: 12 }}>Store Name</th>
                <th style={{ padding: 12 }}>Owner Email</th>
                <th style={{ padding: 12 }}>Location</th>
                <th style={{ padding: 12 }}>Rating</th>
                <th style={{ padding: 12 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: 12, fontWeight: 600 }}>{v.storeName}</td>
                  <td style={{ padding: 12, color: MUTED }}>{v.user?.email || 'N/A'}</td>
                  <td style={{ padding: 12, color: MUTED }}>{v.location || 'Not set'}</td>
                  <td style={{ padding: 12, color: ORANGE, fontWeight: 700 }}>★ {v.rating.toFixed(1)}</td>
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => handleToggleVendorOpen(v.id)}
                      style={{
                        padding: '6px 12px',
                        background: v.isOpen ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                        color: v.isOpen ? '#4ADE80' : '#EF4444',
                        border: `1.5px solid ${v.isOpen ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      {v.isOpen ? 'Open' : 'Closed'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'orders' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${BORDER}`, textAlign: 'left', color: MUTED }}>
                <th style={{ padding: 12 }}>Order ID</th>
                <th style={{ padding: 12 }}>Buyer</th>
                <th style={{ padding: 12 }}>Vendor</th>
                <th style={{ padding: 12 }}>Amount</th>
                <th style={{ padding: 12 }}>Created At</th>
                <th style={{ padding: 12 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>{o.id}</td>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{o.user?.name || 'N/A'}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{o.user?.phone}</div>
                  </td>
                  <td style={{ padding: 12, color: MUTED }}>{o.vendor?.storeName || 'N/A'}</td>
                  <td style={{ padding: 12, fontWeight: 700 }}>GH₵ {Number(o.totalAmount).toFixed(2)}</td>
                  <td style={{ padding: 12, color: MUTED, fontSize: 12 }}>{new Date(o.createdAt).toLocaleString()}</td>
                  <td style={{ padding: 12 }}>
                    <select
                      value={o.status}
                      onChange={(e) => handleChangeOrderStatus(o.id, e.target.value)}
                      style={{ background: '#09090b', color: '#fff', border: `1.5px solid ${BORDER}`, padding: '6px 12px', borderRadius: 8, outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="PREPARING">Preparing</option>
                      <option value="READY">Ready</option>
                      <option value="ON_THE_WAY">On the Way</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sign out */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onLogout}
          style={{
            padding: '12px 24px',
            background: 'transparent',
            color: ORANGE,
            border: `1.5px solid ${ORANGE}`,
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Sign Out of Admin
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, loading, adminRequestCode, adminVerifyCode, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingButton, setLoadingButton] = useState(false);

  if (loading) return null;

  if (user?.role === 'ADMIN') {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff' }}>
        <Navbar />
        <main style={{ maxWidth: 980, margin: '0 auto', padding: '84px 24px 48px' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 28, padding: 34 }}>
            <h1 style={{ fontSize: 32, margin: 0, letterSpacing: '-0.6px', marginBottom: 20 }}>CampusChoo Admin</h1>
            <AdminDashboard onLogout={async () => {
              await logout();
              navigate('/');
            }} />
          </div>
        </main>
      </div>
    );
  }

  async function handleRequestCode(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoadingButton(true);
    const result = await adminRequestCode(email.trim(), password);
    setLoadingButton(false);
    if (!result.ok) {
      setError(result.message ?? 'Failed to request admin code.');
      return;
    }
    setStep('code');
    setMessage('Verification code sent to the admin phone. Enter it below to continue.');
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoadingButton(true);
    const result = await adminVerifyCode(code.trim());
    setLoadingButton(false);
    if (!result.ok) {
      setError(result.message ?? 'Failed to verify code.');
      return;
    }
    navigate('/bonney');
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff' }}>
      <Navbar />
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', padding: '80px 24px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 28, padding: '40px 36px' }}>
          <h1 style={{ fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>CampusChoo Admin</h1>
          <p style={{ color: MUTED, marginTop: 10, lineHeight: 1.7 }}>This page is hidden behind <strong>/bonney</strong>. Sign in with your admin credentials and verify with a one-time SMS code.</p>
          {message && <Message>{message}</Message>}
          {error && <div style={{ marginBottom: 20, padding: 14, borderRadius: 14, background: '#3f1313', color: '#ffc4c4' }}>{error}</div>}

          {step === 'credentials' ? (
            <form onSubmit={handleRequestCode}>
              <Field label="Admin email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" />
              <Field label="Admin password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter admin password" />
              <Button loading={loadingButton}>Request verification code</Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              <Field label="6-digit verification code" type="text" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="123456" inputMode="numeric" maxLength={6} />
              <Button loading={loadingButton}>Verify and enter dashboard</Button>
              <button type="button" onClick={() => setStep('credentials')} style={{ marginTop: 14, width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 16, padding: '14px 18px', cursor: 'pointer' }}>Back to admin login</button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
