import 'dotenv/config';
import argon2 from 'argon2';

import { logger } from '../utils/logger';

import { db, users } from './index';

/**
 * Seed database with sample data
 */
async function seed() {
  try {
    logger.info('Seeding database...');

    // Create a test user
    const passwordHash = await argon2.hash('password123');

    await db
      .insert(users)
      .values({
        email: 'test@example.com',
        passwordHash,
        fullName: 'Test User',
      })
      .onConflictDoNothing();

    logger.info('✅ Database seeded successfully');
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}
