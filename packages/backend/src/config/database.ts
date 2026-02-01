/**
 * Database configuration with Drizzle ORM
 * Provides connection pooling and query interface
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '../db/schema';
import { logger } from '../utils/logger';

/**
 * Database configuration from environment
 */
const databaseConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/quiz_dev',
  max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
  min: parseInt(process.env.DATABASE_POOL_MIN || '5', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

/**
 * PostgreSQL connection pool
 */
export const pool = new Pool(databaseConfig);

/**
 * Handle pool errors
 */
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

/**
 * Drizzle ORM instance with schema
 */
export const db = drizzle(pool, { schema });

/**
 * Check database connectivity
 * @returns Promise<boolean> True if connected successfully
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('Database connection verified');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
}

/**
 * Close database pool gracefully
 */
export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
  logger.info('Database connection pool closed');
}

// Export schema for use in queries
export { schema };
