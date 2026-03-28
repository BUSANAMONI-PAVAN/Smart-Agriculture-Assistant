import { Server } from 'socket.io';
import { verifyToken } from '../modules/auth/token.service.js';

let io = null;

export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const rawToken = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!rawToken || typeof rawToken !== 'string') {
        return next(new Error('Authentication token is required.'));
      }

      const payload = verifyToken(rawToken);
      if (payload.type !== 'access') {
        return next(new Error('Invalid auth token type.'));
      }

      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      return next();
    } catch {
      return next(new Error('Invalid authentication token.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.data.userId || '');
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });

  return io;
}

export function emitUserNotification(userId, payload) {
  if (!io || !userId) {
    return;
  }

  io.to(`user:${userId}`).emit('notification', payload);
}

