/**
 * Socket.IO WebSocket Server
 * Real-time communication for PDF processing progress
 */
import { Server as HttpServer } from 'http';

import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';

import { jwtConfig } from '../config/jwt';
import { redis } from '../config/redis';
import { JobProgress } from '../queues/pdf-queue';
import { logger } from '../utils/logger';

/**
 * Extended socket with user data
 */
interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

/**
 * JWT payload structure
 */
interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

/**
 * Socket.IO server instance
 */
let io: Server | null = null;

/**
 * Namespace for processing updates
 */
const PROCESSING_NAMESPACE = '/processing';

/**
 * Verify JWT token from socket handshake
 */
function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, jwtConfig.accessSecret) as JwtPayload;
    if (decoded.type !== 'access') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Socket authentication middleware
 */
async function authenticateSocket(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token || typeof token !== 'string') {
      logger.warn('WebSocket connection rejected: No token provided', {
        socketId: socket.id,
      });
      return next(new Error('Authentication required'));
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      logger.warn('WebSocket connection rejected: Invalid token', {
        socketId: socket.id,
      });
      return next(new Error('Invalid or expired token'));
    }

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      logger.warn('WebSocket connection rejected: Token blacklisted', {
        socketId: socket.id,
        userId: payload.sub,
      });
      return next(new Error('Token has been revoked'));
    }

    // Attach user info to socket
    socket.userId = payload.sub;
    socket.email = payload.email;

    logger.debug('WebSocket authenticated', {
      socketId: socket.id,
      userId: payload.sub,
    });

    next();
  } catch (error) {
    logger.error('WebSocket authentication error', {
      socketId: socket.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(new Error('Authentication failed'));
  }
}

/**
 * Handle socket connection events
 */
function handleConnection(socket: AuthenticatedSocket): void {
  const userId = socket.userId!;

  logger.info('WebSocket client connected', {
    socketId: socket.id,
    userId,
  });

  // Join user-specific room for targeted updates
  socket.join(`user:${userId}`);

  // Handle subscription to specific PDF updates
  socket.on('subscribe:pdf', (pdfId: string) => {
    if (typeof pdfId === 'string' && pdfId.length > 0) {
      socket.join(`pdf:${pdfId}`);
      logger.debug('Socket subscribed to PDF', {
        socketId: socket.id,
        pdfId,
      });
    }
  });

  // Handle unsubscription from PDF updates
  socket.on('unsubscribe:pdf', (pdfId: string) => {
    if (typeof pdfId === 'string') {
      socket.leave(`pdf:${pdfId}`);
      logger.debug('Socket unsubscribed from PDF', {
        socketId: socket.id,
        pdfId,
      });
    }
  });

  // Handle ping for connection health checks
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    logger.info('WebSocket client disconnected', {
      socketId: socket.id,
      userId,
      reason,
    });
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error('WebSocket error', {
      socketId: socket.id,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });
}

/**
 * Initialize Socket.IO server
 */
export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Processing namespace for PDF progress updates
  const processingNamespace = io.of(PROCESSING_NAMESPACE);

  // Apply authentication middleware
  processingNamespace.use(authenticateSocket);

  // Handle connections
  processingNamespace.on('connection', handleConnection);

  logger.info('Socket.IO server initialized', {
    namespace: PROCESSING_NAMESPACE,
  });

  return io;
}

/**
 * Get Socket.IO server instance
 */
export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeWebSocket first.');
  }
  return io;
}

/**
 * Broadcast progress update to user and PDF rooms
 */
export function broadcastProgress(userId: string, pdfId: string, progress: JobProgress): void {
  if (!io) {
    logger.warn('Cannot broadcast: Socket.IO not initialized');
    return;
  }

  const processingNamespace = io.of(PROCESSING_NAMESPACE);

  // Emit to user room (all user's connections)
  processingNamespace.to(`user:${userId}`).emit('progress', {
    pdfId,
    ...progress,
    timestamp: Date.now(),
  });

  // Also emit to PDF-specific room (if anyone subscribed directly)
  processingNamespace.to(`pdf:${pdfId}`).emit('progress', {
    pdfId,
    ...progress,
    timestamp: Date.now(),
  });

  logger.debug('Progress broadcast sent', {
    userId,
    pdfId,
    stage: progress.stage,
    percentage: progress.percentage,
  });
}

/**
 * Broadcast processing completion
 */
export function broadcastCompletion(
  userId: string,
  pdfId: string,
  result: {
    success: boolean;
    questionCount?: number;
    errorMessage?: string;
  }
): void {
  if (!io) return;

  const processingNamespace = io.of(PROCESSING_NAMESPACE);
  const event = result.success ? 'completed' : 'failed';

  processingNamespace.to(`user:${userId}`).emit(event, {
    pdfId,
    ...result,
    timestamp: Date.now(),
  });

  processingNamespace.to(`pdf:${pdfId}`).emit(event, {
    pdfId,
    ...result,
    timestamp: Date.now(),
  });
}

/**
 * Get connected users count
 */
export async function getConnectedUsersCount(): Promise<number> {
  if (!io) return 0;

  const sockets = await io.of(PROCESSING_NAMESPACE).fetchSockets();
  const uniqueUsers = new Set(sockets.map((s) => (s as unknown as AuthenticatedSocket).userId));
  return uniqueUsers.size;
}

/**
 * Close Socket.IO server
 */
export function closeWebSocket(): Promise<void> {
  return new Promise((resolve) => {
    if (io) {
      io.close(() => {
        logger.info('Socket.IO server closed');
        io = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
