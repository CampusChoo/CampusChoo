import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function SupabaseDemo() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<any>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setMessage(error.message || 'Unable to read Supabase session.');
      }
      setUser(data.session?.user ?? null);
      setLoading(false);
    }
    init();
  }, []);

  async function handleMagicLink() {
    setMessage('Sending magic link...');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Magic link sent to ${email}. Check your inbox.`);
    setEmail('');
    setQueryResult(null);
  }

  async function handleSignOut() {
    setMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setUser(null);
    setQueryResult(null);
    setMessage('Signed out successfully.');
  }

  async function handleQueryProfiles() {
    setMessage('Querying profiles...');
    const { data, error } = await supabase.from('profiles').select('*').limit(5);
    if (error) {
      setMessage(error.message);
      setQueryResult(null);
      return;
    }
    setMessage('Query succeeded. Showing up to 5 rows.');
    setQueryResult(data);
  }

  return (
    <main style={{ padding: '2rem', color: '#fff', background: '#080706', minHeight: '100vh' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <Link to="/" style={{ color: '#F4521E', textDecoration: 'none' }}>← Back to home</Link>
        <h1 style={{ marginTop: '1rem', fontSize: '2.25rem' }}>Supabase Demo</h1>
        <p style={{ margin: '0.75rem 0 1.5rem', color: '#ccc' }}>
          This page shows a simple Supabase client integration using your Vite env values.
        </p>

        <section style={{ marginBottom: '1.5rem', padding: '1.25rem', borderRadius: 16, background: '#121212' }}>
          <h2 style={{ margin: '0 0 0.75rem' }}>Auth status</h2>
          {loading ? (
            <p>Loading session...</p>
          ) : (
            <>
              <p>Status: <strong>{user ? 'Signed in' : 'Signed out'}</strong></p>
              {user ? (
                <div>
                  <p>Email: {user.email ?? '—'}</p>
                  <p>User ID: {user.id}</p>
                  <button onClick={handleSignOut} style={{ marginTop: 12, padding: '0.75rem 1rem', border: 'none', borderRadius: 8, background: '#F4521E', color: '#fff', cursor: 'pointer' }}>
                    Sign out
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    Email address
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      placeholder="you@example.com"
                      style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid #333', background: '#121212', color: '#fff' }}
                    />
                  </label>
                  <button
                    disabled={!email.trim()}
                    onClick={handleMagicLink}
                    style={{ padding: '0.75rem 1rem', border: 'none', borderRadius: 8, background: '#F4521E', color: '#fff', cursor: 'pointer' }}
                  >
                    Send magic link
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section style={{ marginBottom: '1.5rem', padding: '1.25rem', borderRadius: 16, background: '#121212' }}>
          <h2 style={{ margin: '0 0 0.75rem' }}>Sample query</h2>
          <p style={{ margin: '0 0 1rem', color: '#ccc' }}>
            This will query the `profiles` table in your Supabase project. If you do not have this table,
            the request will return an error message instead.
          </p>
          <button
            onClick={handleQueryProfiles}
            style={{ padding: '0.75rem 1rem', border: 'none', borderRadius: 8, background: '#F4521E', color: '#fff', cursor: 'pointer' }}
          >
            Query `profiles`
          </button>
          {queryResult && (
            <pre style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#0f0f0f', overflowX: 'auto' }}>
              {JSON.stringify(queryResult, null, 2)}
            </pre>
          )}
        </section>

        {message && (
          <div style={{ padding: '1rem', borderRadius: 12, background: '#1a1a1a', color: '#fff' }}>
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
