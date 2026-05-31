import { useEffect, useRef } from 'react';

// Loaded by the <script src="https://accounts.google.com/gsi/client"> in index.html.
// Type just enough of it for our needs.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

export default function GoogleSignInButton({
  onCredential,
  text = 'signin_with',
}: {
  onCredential: (idToken: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    // GSI script may not be loaded yet — poll briefly until window.google exists.
    let mounted = true;
    const tryInit = () => {
      if (!mounted) return;
      if (!window.google?.accounts?.id) {
        setTimeout(tryInit, 100);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current!, {
        theme: 'filled_black',
        size: 'large',
        type: 'standard',
        text,
        shape: 'pill',
        width: containerRef.current!.offsetWidth || 320,
      });
    };
    tryInit();

    return () => { mounted = false; };
  }, [clientId, onCredential, text]);

  if (!clientId) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 12, padding: 14, textAlign: 'center',
        color: '#9A8E85', fontSize: 12,
      }}>
        Google sign-in is not configured. Set <code style={{ color: '#F4521E' }}>VITE_GOOGLE_CLIENT_ID</code> in <code>client/.env</code>.
      </div>
    );
  }

  return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center' }} />;
}
