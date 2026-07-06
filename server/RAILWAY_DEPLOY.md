Render deployment guide — server

Overview
- This service hosts the Node/Express + Socket.io backend from the `server` folder.
- Use Neon Postgres for `DATABASE_URL`/`DIRECT_URL`.

1) Create a Render service
- Go to Render and create a new Web Service.
- Connect your GitHub repo and select the `server` folder as the service root.

2) Build & Start settings
- Build command:
  npm install --include=dev && npm run build
- Start command:
  npm start
- Environment: `Node`

3) Environment variables (add these in Render > Environment)
- `DATABASE_URL` — Neon Postgres connection string (use `?sslmode=require`).
- `DIRECT_URL` — same as `DATABASE_URL` (used by Prisma migrations).
- `JWT_SECRET` — a strong random secret (used for JWT signing).
- `CLIENT_BASE_URL` — your client domain, e.g. `https://your-client-domain.com`.
- `CORS_ORIGINS` — comma-separated allowed origins (include your client domain).
- Optional/service keys (if used): `REDIS_URL`, `CLOUDINARY_*`, `PAYSTACK_SECRET_KEY`, `GOOGLE_CLIENT_ID`.
- Do NOT commit secrets to the repo.

4) Running Prisma migrations
Preferred: run migrations from the Render shell or a one-off command after deployment:
- In Render, open the service shell/console and run:
  npm install --include=dev
  npx prisma generate
  npx prisma migrate deploy

Or run locally (if you have the Neon `DATABASE_URL`):
  cd server
  npm install
  npx prisma generate
  npx prisma migrate deploy

5) Verify the deployment
- After deploy + migrations, open the service URL and test:
  curl -i -H "Origin: https://your-client-domain.com" https://<your-render-api-domain>/api/vendors
- On the client, ensure the `CORS_ORIGINS` setting includes the client domain to avoid CORS rejections.

6) Socket.io notes
- Render supports long-lived WebSocket/TCP connections for web services.
- If you plan to scale horizontally, consider sticky sessions or a shared Redis adapter for Socket.io.

7) After deploy checklist
- Add `CORS_ORIGINS` = your client domain.
- Set `CLIENT_BASE_URL` = your client URL.
- Run Prisma migrations in Render shell.
- Restart the service and test `/api/vendors`.
