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

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: process.env.VITE_API_URL ?? 'http://localhost:3000', credentials: true }));
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

// Serve uploaded files. Vite proxies /uploads → here for the dev client.
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
