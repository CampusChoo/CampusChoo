import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { initSocket } from './sockets/orderSocket';
import authRouter from './routes/auth';
import ordersRouter from './routes/orders';
import vendorsRouter from './routes/vendors';
import menuRouter from './routes/menu';
import uploadRouter from './routes/upload';
import paymentsRouter from './routes/payments';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT ?? 4000;

// Comma-separated list of allowed origins. Set CORS_ORIGINS in prod env (e.g.
// "https://campuschoo.com,https://www.campuschoo.com"). Falls back to the dev
// client so local development just works.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / curl / Postman (no Origin header).
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// IMPORTANT: Paystack signs webhooks with HMAC over the RAW request bytes.
// We must capture the body as a Buffer BEFORE express.json() consumes it,
// otherwise signature verification will always fail.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Socket.io must be initialised before routes that call getIo().
initSocket(httpServer);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
// ordersRouter handles both /api/orders/* and /api/vendors/:id/orders
app.use('/api', ordersRouter);
// vendorsRouter handles /api/vendors/me and /api/vendors/:id/toggle
app.use('/api', vendorsRouter);
// menuRouter handles /api/vendors/:id/menu and /api/menu/:id
app.use('/api', menuRouter);
// uploadRouter handles POST /api/upload (multer disk storage)
app.use('/api', uploadRouter);
// paymentsRouter handles /api/payments/{initialize,verify,webhook}
app.use('/api', paymentsRouter);

// Serve uploaded files. Vite proxies /uploads → here for the dev client.
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Neon's serverless DB occasionally drops the connection. Without these handlers,
// any unhandled Prisma rejection in an async route would kill the dev process.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
