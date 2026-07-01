/// <reference types="vite/client" />

// Strongly-typed env vars exposed to the client via Vite. Anything prefixed
// with VITE_ in client/.env (or set in the Vercel project's env vars) is
// available on import.meta.env at build time.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
