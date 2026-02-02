import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';

const { Pool } = pkg;
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
  min: parseInt(process.env.DATABASE_POOL_MIN || '5'),
});

export const db = drizzle(pool, { schema });

// Export schema for use in queries
export * from './schema';
