/**
 * Express application setup
 * Configures middleware, routes, and error handling
 */
import express, { Express } from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import { apiRoutes } from './routes';
import { 
  errorHandler, 
  notFoundHandler,
  requestIdMiddleware,
} from './middleware';
import { logger } from './utils/logger';
// import { swaggerSetup } from './swagger'; // TODO: Install swagger-jsdoc and swagger-ui-express
import { initializeWebSocket, closeWebSocket } from './websocket';
import { closeQueues } from './queues';
import { closeWorker } from './workers';

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request ID tracking
  app.use(requestIdMiddleware);

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });
    
    next();
  });

  // Swagger documentation
  // swaggerSetup(app); // TODO: Install swagger-jsdoc and swagger-ui-express

  // API routes
  app.use('/api/v1', apiRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

/**
 * Create HTTP server with WebSocket support
 */
export function createServer(): http.Server {
  const app = createApp();
  const server = http.createServer(app);
  
  // Initialize Socket.IO
  initializeWebSocket(server);
  
  return server;
}

/**
 * Start the Express server with WebSocket
 */
export async function startServer(): Promise<http.Server> {
  const server = createServer();
  const port = process.env.PORT || 3000;

  return new Promise((resolve) => {
    server.listen(port, () => {
      logger.info(`Server started`, {
        port,
        environment: process.env.NODE_ENV || 'development',
        swagger: `http://localhost:${port}/api-docs`,
        websocket: `ws://localhost:${port}/processing`,
      });
      resolve(server);
    });
  });
}

/**
 * Graceful shutdown
 */
export async function shutdownServer(server: http.Server): Promise<void> {
  logger.info('Shutting down server...');
  
  // Close WebSocket connections
  await closeWebSocket();
  
  // Close queue connections
  await closeQueues();
  
  // Close worker
  await closeWorker();
  
  // Close HTTP server
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        logger.error('Error closing server', { error: err.message });
        reject(err);
      } else {
        logger.info('Server closed');
        resolve();
      }
    });
  });
}
