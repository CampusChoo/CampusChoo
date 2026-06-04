# Campus Choo Deployment Guide

This project uses:
- `Vercel` for the frontend React/Vite app in `client/`
- `Render` for the backend API in `server/`
- `Hostinger` only for DNS and domain configuration

## 1. Prepare the repository

1. Push your repo to GitHub.
2. Ensure the default branch is `master`.
3. Confirm `render.yaml` and `vercel.json` are present in the repo root.

## 2. Deploy the backend to Render

### Option A: Use `render.yaml` blueprint

1. Open Render and sign in.
2. Click `New +` → `Blueprint`.
3. Connect your GitHub repository.
4. Select the `master` branch.
5. Apply the blueprint.

Render will use the `render.yaml` file and ask for environment variables.

### Option B: Deploy manually as a Web Service

Use these values:
- Runtime: Node
- Branch: `master`
- Build command:
  - `npm install --include=dev && npx prisma generate --schema=server/prisma/schema.prisma && npm run build --workspace=server`
- Start command:
  - `npm run start --workspace=server`
- Health check path: `/health`

### Required Render environment variables

Set these in the Render service settings:

- `DATABASE_URL` = Your Postgres connection string
- `DIRECT_URL` = Your direct Postgres connection string for Prisma migrations
- `REDIS_URL` = Your Redis connection string
- `JWT_SECRET` = A long random secret
- `GOOGLE_CLIENT_ID` = Google OAuth client ID for sign-in
- `CORS_ORIGINS` = `https://yourdomain.com,https://www.yourdomain.com`
- `CLIENT_BASE_URL` = `https://yourdomain.com`
- `VITE_SOCKET_URL` = `https://api.yourdomain.com`
- `NODE_ENV` = `production`

Optional production variables:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `PAYSTACK_SECRET_KEY`
- `ARKESEL_API_KEY`

> Note: If Cloudinary is not configured, file uploads may be stored locally and lost between deployments.

## 3. Deploy the frontend to Vercel

1. Open Vercel and sign in.
2. Click `New Project` and import your GitHub repo.
3. Use the following build settings:
   - Root directory: project root
   - Build command: `npm install --include=dev && npm run build --workspace=client`
   - Output directory: `client/dist`
4. Deploy.

### Vercel environment variables

Set these under Project Settings → Environment Variables:

- `VITE_API_URL` = `https://api.yourdomain.com`
- `VITE_SOCKET_URL` = `https://api.yourdomain.com`
- `VITE_GOOGLE_CLIENT_ID` = Your Google OAuth client ID
- `VITE_RECAPTCHA_SITE_KEY` = Your reCAPTCHA site key

> Important: `VITE_API_URL` should be the backend root URL only, not `.../api`. The client app already appends `/api/...` at runtime.

## 4. Set up your Hostinger domain

### Frontend DNS

In Hostinger DNS records:
- `@` → A → `76.76.21.21`
- `www` → CNAME → `cname.vercel-dns.com`

Then add both domains in Vercel:
- `yourdomain.com`
- `www.yourdomain.com`

### Backend DNS

Pick a backend subdomain, for example:
- `api.yourdomain.com`

In Hostinger DNS records:
- `api` → CNAME → `<your-render-service>.onrender.com`

Then add `api.yourdomain.com` as a custom domain in Render.

## 5. Final environment mapping

### Frontend should use
- `VITE_API_URL = https://api.yourdomain.com`
- `VITE_SOCKET_URL = https://api.yourdomain.com`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_RECAPTCHA_SITE_KEY`

### Backend should use
- `CORS_ORIGINS = https://yourdomain.com,https://www.yourdomain.com`
- `CLIENT_BASE_URL = https://yourdomain.com`
- `VITE_SOCKET_URL = https://api.yourdomain.com`

## 6. Verify deployment

- Frontend: `https://yourdomain.com`
- Backend health: `https://api.yourdomain.com/health`
- API example: `https://api.yourdomain.com/api/vendors`

## 7. Useful notes

- Your frontend and backend are separate deployments.
- Vercel serves the React app.
- Render serves the Express API.
- Hostinger only manages DNS records.
