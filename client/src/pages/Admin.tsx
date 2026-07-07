import { useState, type InputHTMLAttributes } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../lib/authStore';

const BG = '#080706';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.08)';
const ORANGE = '#F4521E';
const MUTED = '#9A8E85';

function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </label>
      <input
        {...props}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 14,
          border: `1.5px solid ${BORDER}`, background: 'rgba(255,255,255,0.04)',
          color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }}
      />
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
            <h1 style={{ fontSize: 32, margin: 0, letterSpacing: '-0.6px' }}>CampusChoo Admin</h1>
            <p style={{ color: MUTED, marginTop: 12, maxWidth: 680 }}>You are signed in as an admin. Use this dashboard to manage vendor access, monitor orders, and keep the platform secure.</p>
            <div style={{ marginTop: 28, display: 'grid', gap: 16 }}>
              <div style={{ padding: 20, borderRadius: 18, background: '#09090b', border: `1px solid ${BORDER}` }}>
                <h2 style={{ margin: '0 0 10px', fontSize: 20 }}>Admin tools</h2>
                <p style={{ margin: 0, color: MUTED }}>This page is intentionally minimal. Add your admin controls here as needed.</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
                style={{ padding: '14px 18px', borderRadius: 16, border: '1px solid rgba(244,82,30,0.4)', background: 'transparent', color: ORANGE, fontWeight: 700, cursor: 'pointer' }}
              >
                Sign out of admin
              </button>
            </div>
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
