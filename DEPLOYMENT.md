# Campus Choo Deployment Guide

This project now uses:
- Vercel for the React/Vite frontend in `client/`
- Supabase Postgres for data
- Supabase Edge Functions for backend API logic
- Supabase Storage for uploads

## 1. Supabase Setup

1. Create a Supabase project.
2. Install and log in to the Supabase CLI.
3. Link the local project:

```bash
supabase link --project-ref your-project-ref
```

4. Apply migrations:

```bash
supabase db push
```

5. Deploy the API Edge Function:

```bash
supabase functions deploy api
```

## 2. Supabase Secrets

Set these Edge Function secrets:

```bash
supabase secrets set JWT_SECRET="long-random-secret"
supabase secrets set PAYSTACK_SECRET_KEY="sk_live_or_test_key"
supabase secrets set GOOGLE_CLIENT_ID="your-google-client-id"
supabase secrets set ARKESEL_API_KEY="optional-arkesel-key"
```

Supabase automatically provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
to Edge Functions.

## 3. Frontend Environment

Set these in Vercel:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_API_URL=https://your-project.supabase.co/functions/v1/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

`VITE_API_URL` should point to the `api` Edge Function, not to `/api`.

## 4. Vercel Deploy

Use these Vercel settings:

- Root directory: project root
- Build command: `npm install --include=dev && npm run build --workspace=client`
- Output directory: `client/dist`

## 5. Verify

- Frontend: `https://yourdomain.com`
- API vendors: `https://your-project.supabase.co/functions/v1/api/vendors`
- Track order: `https://yourdomain.com/track/CC-12345`

The old Express/Render/Railway backend has been removed. The frontend talks to
Supabase Edge Functions for all API behavior.
