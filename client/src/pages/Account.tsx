import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useAuth } from '../lib/authStore';
import { api } from '../lib/api';

const ORANGE = '#F4521E';
const BG = '#080706';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.07)';
const MUTED = '#9A8E85';

// Google reCAPTCHA Enterprise site key. Set VITE_RECAPTCHA_SITE_KEY to override
// (e.g. in Vercel). The default is the project's Enterprise key.
const RECAPTCHA_SITE_KEY =
  (import.meta as unknown as { env?: { VITE_RECAPTCHA_SITE_KEY?: string } }).env?.VITE_RECAPTCHA_SITE_KEY
  ?? '6Le79E8tAAAAAGAV9mvqiWPx-IO83W0G0Q4nbi31';
const RECAPTCHA_SCRIPT_SRC = 'https://www.google.com/recaptcha/enterprise.js?render=explicit';

declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        render: (
          el: HTMLElement,
          opts: { sitekey: string; theme?: 'light' | 'dark'; callback: (t: string) => void; 'expired-callback'?: () => void },
        ) => number;
        reset: (id?: number) => void;
      };
    };
  }
}

async function uploadFile(file: Blob, filename = 'upload'): Promise<string> {
  const fd = new FormData();
  fd.append('file', file, filename);
  const res = await api('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Upload failed');
  }
  const data = await res.json();
  return data.url as string;
}

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
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', padding: '88px 24px 24px' }}>
        <div style={{
          width: '100%', maxWidth: 440,
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 28, padding: '44px 40px', backdropFilter: 'blur(20px)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28,
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

          <GoogleAuthSection redirect={redirect} mode={tab} />
          <Divider>or {tab === 'login' ? 'sign in' : 'register'} with email</Divider>

          {tab === 'login' ? <LoginForm redirect={redirect} /> : <RegisterForm redirect={redirect} />}
        </div>
      </div>
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      margin: '20px 0', color: MUTED, fontSize: 11,
      textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
    }}>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
      <span>{children}</span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

function GoogleAuthSection({ redirect, mode }: { redirect: string; mode: 'login' | 'register' }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [err, setErr] = useState('');

  return (
    <div>
      {err && <ErrorBox message={err} />}
      <GoogleSignInButton
        text={mode === 'login' ? 'signin_with' : 'signup_with'}
        promptOneTap={mode === 'login'}
        onCredential={async (idToken) => {
          setErr('');
          const r = await loginWithGoogle(idToken);
          if (r.ok) navigate(redirect);
          else setErr(r.message ?? 'Google sign-in failed.');
        }}
      />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: 10, border: 'none', borderRadius: 9,
      fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700,
      cursor: 'pointer', transition: 'all 0.2s',
      color: active ? '#fff' : MUTED, background: active ? ORANGE : 'transparent',
    }}>{children}</button>
  );
}

function Field({ label, type, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: MUTED, fontWeight: 600, marginBottom: 7, display: 'block' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input {...props} type={inputType} style={{
          width: '100%', padding: isPassword ? '13px 44px 13px 16px' : '13px 16px',
          border: `1.5px solid ${BORDER}`, borderRadius: 12,
          background: 'rgba(255,255,255,0.05)', color: '#fff',
          fontSize: 14, fontFamily: "'Inter', sans-serif",
          outline: 'none', boxSizing: 'border-box',
        }} />
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

function SubmitBtn({ loading, disabled, children }: { loading: boolean; disabled?: boolean; children: React.ReactNode }) {
  const isDisabled = loading || disabled;
  return (
    <button type="submit" disabled={isDisabled} style={{
      width: '100%', padding: 15, marginTop: 8,
      background: ORANGE, color: '#fff', border: 'none', borderRadius: 14,
      fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 800,
      cursor: isDisabled ? (loading ? 'wait' : 'not-allowed') : 'pointer',
      opacity: isDisabled ? 0.5 : 1,
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
  const { login, forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot_phone' | 'forgot_reset'>('login');
  const [phone, setPhone] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(''); setSuccess(''); setLoading(true);
    const r = await login(email, password);
    setLoading(false);
    if (r.ok) navigate(redirect);
    else setErr(r.message ?? 'Login failed');
  }

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setErr(''); setSuccess(''); setLoading(true);
    const r = await forgotPassword(phone.trim());
    setLoading(false);
    if (r.ok && r.email) {
      setResetEmail(r.email);
      setView('forgot_reset');
      setSuccess('Verification code sent to your registered phone number. Enter it below.');
    } else {
      setErr(r.message ?? 'Failed to send verification code.');
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setErr(''); setSuccess(''); setLoading(true);
    const r = await resetPassword(resetEmail.trim(), resetCode.trim(), newPassword);
    setLoading(false);
    if (r.ok) {
      setView('login');
      setSuccess('Your password has been reset successfully! Please sign in.');
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setPhone('');
      setResetEmail('');
    } else {
      setErr(r.message ?? 'Password reset failed.');
    }
  }

  if (view === 'forgot_phone') {
    return (
      <form onSubmit={handleSendCode}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#fff' }}>Reset Password</h3>
        <p style={{ fontSize: 13, color: MUTED, marginBottom: 20, lineHeight: 1.5 }}>
          Enter your registered phone number. We will verify your account and send a 6-digit security code to this number.
        </p>
        {err && <ErrorBox message={err} />}
        {success && <div style={{ background: 'rgba(244,82,30,0.1)', border: '1px solid rgba(244,82,30,0.3)', borderRadius: 10, padding: 12, marginBottom: 12, color: ORANGE, fontSize: 13 }}>{success}</div>}
        <Field label="Phone Number" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024XXXXXXX or +233XXXXXXXXX" />
        <SubmitBtn loading={loading}>Send Reset Code</SubmitBtn>
        <button
          type="button"
          onClick={() => { setView('login'); setErr(''); setSuccess(''); }}
          style={{ width: '100%', marginTop: 14, background: 'transparent', border: 'none', color: MUTED, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
        >
          ← Back to Sign In
        </button>
      </form>
    );
  }

  if (view === 'forgot_reset') {
    return (
      <form onSubmit={handleResetPassword}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#fff' }}>Enter Reset Code</h3>
        {err && <ErrorBox message={err} />}
        {success && <div style={{ background: 'rgba(244,82,30,0.1)', border: '1px solid rgba(244,82,30,0.3)', borderRadius: 10, padding: 12, marginBottom: 12, color: ORANGE, fontSize: 13 }}>{success}</div>}
        <Field label="6-Digit Reset Code" type="text" required value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" maxLength={6} />
        <Field label="New Password" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
        <SubmitBtn loading={loading}>Reset Password</SubmitBtn>
        <button
          type="button"
          onClick={() => { setView('forgot_phone'); setErr(''); setSuccess(''); }}
          style={{ width: '100%', marginTop: 14, background: 'transparent', border: 'none', color: MUTED, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
        >
          ← Resend Code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit}>
      {err && <ErrorBox message={err} />}
      {success && <div style={{ background: 'rgba(244,82,30,0.1)', border: '1px solid rgba(244,82,30,0.3)', borderRadius: 10, padding: 12, marginBottom: 12, color: ORANGE, fontSize: 13 }}>{success}</div>}
      <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
      <Field label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { setView('forgot_phone'); setErr(''); setSuccess(''); }}
          style={{ background: 'transparent', border: 'none', color: ORANGE, fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 600 }}
        >
          Forgot password?
        </button>
      </div>
      <SubmitBtn loading={loading}>Sign In →</SubmitBtn>
    </form>
  );
}

// Only UMaT (Tarkwa) is live; the rest render a "Coming Soon" notice and block submit.
const UMAT_VALUE = 'UMAT';
const UNIVERSITIES: { value: string; label: string }[] = [
  { value: 'UMAT',     label: 'University of Mines and Technology (UMaT) — Tarkwa' },
  { value: 'UG',       label: 'University of Ghana (Legon)' },
  { value: 'KNUST',    label: 'Kwame Nkrumah University of Science and Technology (KNUST)' },
  { value: 'UCC',      label: 'University of Cape Coast (UCC)' },
  { value: 'UEW',      label: 'University of Education, Winneba (UEW)' },
  { value: 'UDS',      label: 'University for Development Studies (UDS)' },
  { value: 'UHAS',     label: 'University of Health and Allied Sciences (UHAS)' },
  { value: 'UENR',     label: 'University of Energy and Natural Resources (UENR)' },
  { value: 'UPSA',     label: 'University of Professional Studies, Accra (UPSA)' },
  { value: 'GIMPA',    label: 'Ghana Institute of Management and Public Administration (GIMPA)' },
  { value: 'CKT_UTAS', label: 'C. K. Tedam University of Technology and Applied Sciences (CKT-UTAS)' },
  { value: 'UESD',     label: 'University of Environment and Sustainable Development (UESD)' },
  { value: 'AAMUSTED', label: 'Akenten Appiah-Menka University (AAMUSTED)' },
  { value: 'SDD_UBIDS',label: 'Simon Diedong Dombo University (SDD-UBIDS)' },
  { value: 'GCTU',     label: 'Ghana Communication Technology University (GCTU)' },
  { value: 'ASHESI',   label: 'Ashesi University' },
  { value: 'CENTRAL',  label: 'Central University' },
  { value: 'VVU',      label: 'Valley View University' },
  { value: 'PENTECOST',label: 'Pentecost University' },
  { value: 'CUCG',     label: 'Catholic University of Ghana' },
  { value: 'METHODIST',label: 'Methodist University Ghana' },
  { value: 'WIUC',     label: 'Wisconsin International University College' },
  { value: 'LUG',      label: 'Lancaster University Ghana' },
  { value: 'REGENT',   label: 'Regent University College of Science and Technology' },
  { value: 'CSUC',     label: 'Christian Service University' },
  { value: 'PUG',      label: 'Presbyterian University Ghana' },
  { value: 'ANUC',     label: 'All Nations University College' },
];

type IdType = 'STUDENT_ID' | 'GHANA_CARD' | 'DRIVERS_LICENSE' | 'PASSPORT' | 'OTHER';
const ID_TYPES: { value: IdType; label: string }[] = [
  { value: 'STUDENT_ID',      label: 'Student ID Card' },
  { value: 'GHANA_CARD',      label: 'Ghana Card (National ID)' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  { value: 'PASSPORT',        label: 'Passport' },
  { value: 'OTHER',           label: 'Other Government-Issued ID' },
];

function RegisterForm({ redirect }: { redirect: string }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'basic' | 'verification'>('basic');
  const [form, setForm] = useState({ name: '', email: '', phone: '', level: '', password: '', storeName: '', university: '', role: 'BUYER' as 'BUYER' | 'VENDOR' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [verification, setVerification] = useState<{ idType: IdType | ''; idFile: File | null; selfieBlob: Blob | null }>({
    idType: '', idFile: null, selfieBlob: null,
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const universityBlocked = form.university !== '' && form.university !== UMAT_VALUE;
  const blockedUniversity = universityBlocked
    ? UNIVERSITIES.find((u) => u.value === form.university)?.label
    : undefined;

  // Step 1 button: BUYER registers immediately; VENDOR proceeds to verification.
  async function submitBasic(e: FormEvent) {
    e.preventDefault();
    if (!form.university)        { setErr('Please select your university.'); return; }
    if (universityBlocked)       { setErr('This university is not yet supported.'); return; }
    if (!acceptedTerms)          { setErr('You must accept the Terms & Conditions to continue.'); return; }
    if (!captchaToken)           { setErr('Please complete the reCAPTCHA challenge.'); return; }

    if (form.role === 'VENDOR') {
      setErr('');
      setStep('verification');
      return;
    }

    // Buyer path — register straight away.
    setErr(''); setLoading(true);
    const r = await register({
      name: form.name, email: form.email, phone: form.phone, password: form.password,
      role: form.role, level: form.level || undefined, captchaToken: captchaToken ?? undefined,
    });
    setLoading(false);
    if (r.ok) navigate(redirect);
    else setErr(r.message ?? 'Registration failed');
  }

  // Step 2 button (vendor only): register, then upload ID + selfie using the
  // freshly-issued access token. We collect files in browser memory first so
  // /api/upload (auth-gated) only runs once the user is signed in.
  async function submitVerification(e: FormEvent) {
    e.preventDefault();
    if (!verification.idType)   { setErr('Please choose the ID type.'); return; }
    if (!verification.idFile)   { setErr('Please upload a photo of your ID.'); return; }
    if (!verification.selfieBlob) { setErr('Please capture a selfie for facial verification.'); return; }

    setErr(''); setLoading(true);
    const r = await register({
      name: form.name, email: form.email, phone: form.phone, password: form.password,
      role: form.role, storeName: form.storeName || undefined, captchaToken: captchaToken ?? undefined,
    });
    if (!r.ok) { setLoading(false); setErr(r.message ?? 'Registration failed'); return; }

    try {
      const idUrl     = await uploadFile(verification.idFile, `id-${verification.idType.toLowerCase()}.jpg`);
      const selfieUrl = await uploadFile(verification.selfieBlob, 'selfie.jpg');
      
      const vRes = await api('/api/vendors/verification', {
        method: 'POST',
        body: JSON.stringify({
          idType: verification.idType,
          idUrl,
          selfieUrl,
        }),
      });
      if (!vRes.ok) {
        const body = await vRes.json().catch(() => ({}));
        throw new Error(body.message ?? 'Failed to submit verification details.');
      }

      setLoading(false);
      navigate(redirect);
    } catch (uploadErr) {
      setLoading(false);
      setErr(uploadErr instanceof Error ? uploadErr.message : 'Failed to upload verification documents.');
    }
  }

  if (step === 'verification') {
    return (
      <VerificationStep
        err={err}
        loading={loading}
        verification={verification}
        setVerification={setVerification}
        onBack={() => { setErr(''); setStep('basic'); }}
        onSubmit={submitVerification}
      />
    );
  }

  return (
    <form onSubmit={submitBasic}>
      {err && <ErrorBox message={err} />}
      <Field label="Full Name" required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Ama Asante" />
      <Field label="Email" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="ama@stu.umat.edu.gh" />
      <Field label="Phone Number" type="tel" required value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="0551 234 567" />

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: MUTED, fontWeight: 600, marginBottom: 7, display: 'block' }}>University</label>
        <select required value={form.university} onChange={(e) => update('university', e.target.value)} style={{
          width: '100%', padding: '13px 16px', border: `1.5px solid ${universityBlocked ? '#7f1d1d' : BORDER}`,
          borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: '#fff',
          fontSize: 14, fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
        }}>
          <option value="" style={{ background: '#1a1510' }}>Select your university…</option>
          {UNIVERSITIES.map((u) => (
            <option key={u.value} value={u.value} style={{ background: '#1a1510' }}>{u.label}</option>
          ))}
        </select>
      </div>

      {universityBlocked && (
        <ComingSoonBox university={blockedUniversity!} />
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: MUTED, fontWeight: 600, marginBottom: 7, display: 'block' }}>I am a…</label>
        <select value={form.role} onChange={(e) => update('role', e.target.value as 'BUYER' | 'VENDOR')} style={{
          width: '100%', padding: '13px 16px', border: `1.5px solid ${BORDER}`,
          borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: '#fff',
          fontSize: 14, fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
        }}>
          <option value="BUYER" style={{ background: '#1a1510' }}>Student / Staff (buyer)</option>
          <option value="VENDOR" style={{ background: '#1a1510' }}>Food Vendor</option>
        </select>
      </div>
      {form.role === 'BUYER' && (
        <Field label="Level (optional)" value={form.level} onChange={(e) => update('level', e.target.value)} placeholder="e.g. 100, 200, Staff" />
      )}
      {form.role === 'VENDOR' && (
        <Field label="Store Name" required value={form.storeName} onChange={(e) => update('storeName', e.target.value)} placeholder="e.g. Mama Ama's Kitchen" />
      )}
      <Field label="Password" type="password" required minLength={6} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="At least 6 characters" />

      <TermsCheckbox checked={acceptedTerms} onChange={setAcceptedTerms} />
      <RecaptchaWidget onToken={setCaptchaToken} />

      <SubmitBtn loading={loading} disabled={universityBlocked}>
        {form.role === 'VENDOR' ? 'Continue to Verification →' : 'Create Account →'}
      </SubmitBtn>
    </form>
  );
}

// ─── Terms & Conditions ──────────────────────────────────────────────────────

function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
      padding: '12px 14px', marginBottom: 14,
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`,
      borderRadius: 12,
    }}>
      <input
        type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, width: 16, height: 16, accentColor: ORANGE, flexShrink: 0 }}
      />
      <span style={{ fontSize: 13, color: '#ddd', lineHeight: 1.5 }}>
        I agree to the{' '}
        <a href="/terms" target="_blank" rel="noreferrer" style={{ color: ORANGE, textDecoration: 'underline' }}>
          Terms &amp; Conditions
        </a>{' '}
        and the{' '}
        <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: ORANGE, textDecoration: 'underline' }}>
          Privacy Policy
        </a>
        .
      </span>
    </label>
  );
}

// ─── reCAPTCHA v2 (checkbox) ─────────────────────────────────────────────────

function RecaptchaWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    function ensureScript() {
      if (document.querySelector(`script[src="${RECAPTCHA_SCRIPT_SRC}"]`)) return;
      const script = document.createElement('script');
      script.src = RECAPTCHA_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        if (!cancelled) setStatus('failed');
      };
      document.head.appendChild(script);
    }

    const tryRender = () => {
      if (cancelled) return;
      const g = window.grecaptcha?.enterprise;
      if (g?.render && ref.current && widgetIdRef.current === null) {
        try {
          widgetIdRef.current = g.render(ref.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            theme: 'dark',
            callback: (token) => {
              setStatus('ready');
              onToken(token);
            },
            'expired-callback': () => onToken(null),
          });
          setStatus('ready');
        } catch { /* already rendered — ignore */ }
      } else {
        timer = window.setTimeout(tryRender, 250);
      }
    };
    ensureScript();
    tryRender();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', minHeight: 78, alignItems: 'center' }}>
      <div ref={ref} />
      {status === 'loading' && (
        <span style={{ color: MUTED, fontSize: 12 }}>Loading reCAPTCHA...</span>
      )}
      {status === 'failed' && (
        <span style={{ color: '#fca5a5', fontSize: 12, textAlign: 'center' }}>
          reCAPTCHA could not load. Check your connection or site key.
        </span>
      )}
    </div>
  );
}

// ─── Vendor verification step ────────────────────────────────────────────────

function VerificationStep({
  err, loading, verification, setVerification, onBack, onSubmit,
}: {
  err: string;
  loading: boolean;
  verification: { idType: IdType | ''; idFile: File | null; selfieBlob: Blob | null };
  setVerification: React.Dispatch<React.SetStateAction<{ idType: IdType | ''; idFile: File | null; selfieBlob: Blob | null }>>;
  onBack: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4, letterSpacing: '-0.3px' }}>
          🪪 Vendor Verification
        </div>
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          To keep CampusChoo safe, we verify every vendor's identity. Upload a photo of your ID and capture a selfie for facial recognition.
        </div>
      </div>

      {err && <ErrorBox message={err} />}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: MUTED, fontWeight: 600, marginBottom: 7, display: 'block' }}>ID Type</label>
        <select
          required
          value={verification.idType}
          onChange={(e) => setVerification((v) => ({ ...v, idType: e.target.value as IdType, idFile: null }))}
          style={{
            width: '100%', padding: '13px 16px', border: `1.5px solid ${BORDER}`,
            borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: '#fff',
            fontSize: 14, fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
          }}
        >
          <option value="" style={{ background: '#1a1510' }}>Select an ID type…</option>
          {ID_TYPES.map((t) => (
            <option key={t.value} value={t.value} style={{ background: '#1a1510' }}>{t.label}</option>
          ))}
        </select>
      </div>

      <IdImagePicker
        file={verification.idFile}
        onPick={(f) => setVerification((v) => ({ ...v, idFile: f }))}
      />

      <SelfieCapture
        blob={verification.selfieBlob}
        onCapture={(b) => setVerification((v) => ({ ...v, selfieBlob: b }))}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button type="button" onClick={onBack} disabled={loading} style={{
          flex: '0 0 auto', padding: '15px 22px',
          background: 'transparent', color: '#fff',
          border: `1.5px solid ${BORDER}`, borderRadius: 14,
          fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
        }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <SubmitBtn loading={loading}>Submit &amp; Create Account →</SubmitBtn>
        </div>
      </div>
    </form>
  );
}

function IdImagePicker({ file, onPick }: { file: File | null; onPick: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: MUTED, fontWeight: 600, marginBottom: 7, display: 'block' }}>
        Photo of your ID
      </label>
      <input
        ref={inputRef} type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${BORDER}` }}>
          <img src={preview} alt="ID preview" style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'cover' }} />
          <button type="button" onClick={() => { onPick(null); if (inputRef.current) inputRef.current.value = ''; }} style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '6px 10px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Remove</button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} style={{
          width: '100%', padding: 24, background: 'rgba(255,255,255,0.04)',
          border: `1.5px dashed ${BORDER}`, borderRadius: 12,
          color: MUTED, cursor: 'pointer', fontSize: 14, fontWeight: 500,
          fontFamily: "'Inter', sans-serif",
        }}>
          📷 Click to upload an image of your ID
        </button>
      )}
    </div>
  );
}

function SelfieCapture({ blob, onCapture }: { blob: Blob | null; onCapture: (b: Blob | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [camErr, setCamErr] = useState('');

  useEffect(() => {
    if (!blob) { setPreview(null); return; }
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(() => {
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [stream]);

  async function start() {
    setCamErr('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: 'user' },
        audio: false,
      });
      setStream(s);
      // Wait a tick for the video element to mount, then attach.
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => undefined);
        }
      }, 50);
    } catch {
      setCamErr('Could not access camera. Please grant camera permission and try again.');
    }
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  async function capture() {
    if (!videoRef.current || !stream) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 480;
    canvas.height = v.videoHeight || 360;
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const captured: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85));
    if (captured) onCapture(captured);
    stop();
  }

  function retake() {
    onCapture(null);
    start();
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: MUTED, fontWeight: 600, marginBottom: 7, display: 'block' }}>
        Selfie (Facial Verification)
      </label>

      {camErr && (
        <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 8 }}>{camErr}</div>
      )}

      {preview ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${BORDER}` }}>
          <img src={preview} alt="Selfie preview" style={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'cover' }} />
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            borderRadius: 8, padding: '4px 10px',
            fontSize: 11, fontWeight: 600,
          }}>✓ Captured — will be matched against your ID</div>
          <button type="button" onClick={retake} style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '6px 10px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Retake</button>
        </div>
      ) : stream ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${BORDER}`, background: '#000' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'cover' }} />
          <div style={{ display: 'flex', gap: 8, padding: 10, background: 'rgba(0,0,0,0.5)' }}>
            <button type="button" onClick={capture} style={{
              flex: 1, padding: 10, background: ORANGE, color: '#fff',
              border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13,
            }}>📸 Capture</button>
            <button type="button" onClick={stop} style={{
              padding: '10px 14px', background: 'transparent', color: '#fff',
              border: `1px solid ${BORDER}`, borderRadius: 10, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Inter', sans-serif", fontSize: 13,
            }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={start} style={{
          width: '100%', padding: 24, background: 'rgba(255,255,255,0.04)',
          border: `1.5px dashed ${BORDER}`, borderRadius: 12,
          color: MUTED, cursor: 'pointer', fontSize: 14, fontWeight: 500,
          fontFamily: "'Inter', sans-serif",
        }}>
          📸 Start camera to take a selfie
        </button>
      )}
    </div>
  );
}

function ComingSoonBox({ university }: { university: string }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(244,82,30,0.10), rgba(249,193,58,0.06))',
      border: '1px solid rgba(244,82,30,0.35)',
      borderRadius: 14, padding: '16px 18px', marginBottom: 16,
    }}>
      <div style={{
        fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 800,
        color: ORANGE, marginBottom: 6, letterSpacing: '-0.3px',
      }}>
        🚧 Coming Soon
      </div>
      <div style={{ fontSize: 13, color: '#fff', marginBottom: 4 }}>
        CampusChoo isn't live at <strong>{university}</strong> yet.
      </div>
      <div style={{ fontSize: 12, color: MUTED }}>
        We're currently only operating at the University of Mines and Technology (UMaT), Tarkwa. Check back soon — we're expanding fast.
      </div>
    </div>
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
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
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
                fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 800, color: '#fff',
              }}>{initials}</div>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 3 }}>
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
              fontFamily: "'Inter', sans-serif",
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
      fontFamily: "'Inter', sans-serif",
    }}>{children}</button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 22, padding: '28px 32px', marginBottom: 20 }}>
      <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 20px', letterSpacing: '-0.5px' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, textAlign: 'center' }}>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 800, color: ORANGE, letterSpacing: '-1px' }}>{n}</div>
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
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 800, color: ORANGE }}>
              GHS {Number(o.totalAmount).toFixed(0)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
