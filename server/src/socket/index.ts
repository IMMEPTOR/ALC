import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { TechNode, TelemetryRecord, Alert } from '../models';

let io: Server;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // JWT auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Аутентификация обязательна'));
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Недействительный токен'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Subscribe to specific node updates
    socket.on('subscribe:node', (nodeId: string) => {
      socket.join(`node:${nodeId}`);
    });

    socket.on('unsubscribe:node', (nodeId: string) => {
      socket.leave(`node:${nodeId}`);
    });

    // Subscribe to all alerts
    socket.on('subscribe:alerts', () => {
      socket.join('alerts');
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

// Emit telemetry update to subscribed clients
export const emitTelemetryUpdate = (nodeId: string, data: any) => {
  if (io) {
    io.to(`node:${nodeId}`).emit('telemetry:update', data);
  }
};

// Emit new alert to all subscribers
export const emitAlert = (alert: any) => {
  if (io) {
    io.to('alerts').emit('alert:new', alert);
  }
};

// Emit node status change
export const emitNodeStatus = (nodeId: string, status: string) => {
  if (io) {
    io.to(`node:${nodeId}`).emit('node:status', { nodeId, status });
    io.emit('nodes:statusUpdate', { nodeId, status });
  }
};
