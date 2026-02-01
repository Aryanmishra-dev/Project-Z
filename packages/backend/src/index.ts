/**
 * Backend server entry point
 * Initializes connections and starts the server
 */
import 'dotenv/config';
import { createApp, startServer } from './app';
import { checkDatabaseConnection, closeDatabaseConnection } from './config/database';
import { redis, closeRedisConnection } from './config/redis';
import { logger } from './utils/logger';

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Close Redis connection
    await closeRedisConnection();
    logger.info('Redis connection closed');
    
    // Close database connection
    await closeDatabaseConnection();
    logger.info('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Verify database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('Database connection established');
    
    // Verify Redis connection
    const redisStatus = await redis.ping();
    if (redisStatus !== 'PONG') {
      throw new Error('Failed to connect to Redis');
    }
    logger.info('Redis connection established');
    
    // Start server
    await startServer();
    
    // Setup graceful shutdown
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Run if this is the entry point
main();
