import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export const healthRouter = Router();

/**
 * Health check endpoint
 */
healthRouter.get('/', async (_req, res) => {
  try {
    // Check database connection
    await db.execute(sql`SELECT 1`);
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'backend',
      version: '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});
