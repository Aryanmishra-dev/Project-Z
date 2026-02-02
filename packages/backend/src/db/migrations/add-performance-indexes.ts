/**
 * Database Indexes Migration
 * Adds performance indexes for analytics and common queries
 * Run with: npx tsx src/db/migrations/add-performance-indexes.ts
 */
import { sql } from 'drizzle-orm';

import { logger } from '../../utils/logger';
import { db } from '../index';

async function addPerformanceIndexes() {
  logger.info('Starting performance indexes migration...');

  const indexes = [
    {
      name: 'idx_quiz_sessions_user_completed',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_sessions_user_completed 
        ON quiz_sessions(user_id, completed_at DESC) 
        WHERE status = 'completed'
      `,
      description: 'Composite index for user quiz history analytics',
    },
    {
      name: 'idx_quiz_sessions_completed_date',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_sessions_completed_date 
        ON quiz_sessions((completed_at::date)) 
        WHERE status = 'completed'
      `,
      description: 'Index for date-based analytics queries',
    },
    {
      name: 'idx_quiz_sessions_difficulty_user',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_sessions_difficulty_user 
        ON quiz_sessions(user_id, difficulty_filter, score_percentage) 
        WHERE status = 'completed'
      `,
      description: 'Index for difficulty-based performance analysis',
    },
    {
      name: 'idx_user_answers_question_correct',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_answers_question_correct 
        ON user_answers(question_id, is_correct)
      `,
      description: 'Index for question accuracy analysis',
    },
    {
      name: 'idx_user_answers_session_time',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_answers_session_time 
        ON user_answers(quiz_session_id, time_spent_seconds)
      `,
      description: 'Index for time-based learning pattern analysis',
    },
    {
      name: 'idx_refresh_tokens_active',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_active 
        ON refresh_tokens(user_id, expires_at) 
        WHERE revoked_at IS NULL
      `,
      description: 'Partial index for active sessions',
    },
    {
      name: 'idx_pdfs_user_status',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pdfs_user_status 
        ON pdfs(user_id, status, created_at DESC)
      `,
      description: 'Index for user PDF listing with status filter',
    },
    {
      name: 'idx_questions_pdf_validated',
      query: sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_pdf_validated 
        ON questions(pdf_id, validation_status) 
        WHERE validation_status = 'validated'
      `,
      description: 'Partial index for validated questions per PDF',
    },
  ];

  for (const index of indexes) {
    try {
      logger.info(`Creating index: ${index.name} - ${index.description}`);
      await db.execute(index.query);
      logger.info(`✓ Index ${index.name} created successfully`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        logger.info(`Index ${index.name} already exists, skipping`);
      } else {
        logger.error(`Failed to create index ${index.name}:`, error);
      }
    }
  }

  logger.info('Performance indexes migration completed');
}

// Run if called directly
if (require.main === module) {
  addPerformanceIndexes()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export { addPerformanceIndexes };
