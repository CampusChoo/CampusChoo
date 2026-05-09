import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from '../lib/tokens';

let io: SocketServer;

// ─── Init ─────────────────────────────────────────────────────────────────────
// Call once from index.ts after creating the HTTP server.

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.VITE_SOCKET_URL ?? 'http://localhost:3000',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    // Optionally verify the JWT on connection so unauthenticated clients can't join rooms.
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      // Allow unauthenticated connections for track page (public order tracking).
      return next();
    }
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('[Socket] connected:', socket.id);

    // Buyer joins their personal room to receive status updates.
    socket.on('join:buyer', (userId: string) => {
      socket.join(`buyer:${userId}`);
    });

    // Vendor joins their vendor room to receive new order events.
    socket.on('join:vendor', (vendorId: string) => {
      socket.join(`vendor:${vendorId}`);
    });

    // Public room for tracking a specific order (no auth needed).
    socket.on('join:order', (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] disconnected:', socket.id);
    });
  });

  return io;
}

// ─── Accessor ─────────────────────────────────────────────────────────────────
// Import getIo() in any route to emit events.

export function getIo(): SocketServer {
  if (!io) throw new Error('Socket.io has not been initialised. Call initSocket() first.');
  return io;
}
