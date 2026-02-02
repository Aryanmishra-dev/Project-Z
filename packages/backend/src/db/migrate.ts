import 'dotenv/config';
import { sql } from 'drizzle-orm';

import { logger } from '../utils/logger';

import { db } from './index';

/**
 * Run database migrations
 * Creates all required tables and enums for the quiz application
 */
async function migrate() {
  try {
    logger.info('Running migrations...');

    // Drop legacy tables that have incompatible schema
    await db.execute(sql`
      DROP TABLE IF EXISTS questions CASCADE;
      DROP TABLE IF EXISTS quizzes CASCADE;
      DROP TYPE IF EXISTS difficulty CASCADE;
      DROP TYPE IF EXISTS question_type CASCADE;
    `);

    // Create enums first
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('user', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE pdf_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE validation_status AS ENUM ('pending', 'valid', 'invalid', 'needs_review');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE quiz_status AS ENUM ('in_progress', 'completed', 'abandoned', 'timed_out');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE confidence_level AS ENUM ('very_low', 'low', 'medium', 'high', 'very_high');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role user_role DEFAULT 'user' NOT NULL,
        email_verified BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMPTZ
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email 
        ON users(email) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `);

    // Create refresh_tokens table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device_id ON refresh_tokens(device_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    `);

    // Create pdfs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pdfs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        page_count INTEGER,
        status pdf_status DEFAULT 'pending' NOT NULL,
        processing_started_at TIMESTAMPTZ,
        processing_completed_at TIMESTAMPTZ,
        metadata JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMPTZ
      );
      
      CREATE INDEX IF NOT EXISTS idx_pdfs_user_id ON pdfs(user_id);
      CREATE INDEX IF NOT EXISTS idx_pdfs_status ON pdfs(status);
      CREATE INDEX IF NOT EXISTS idx_pdfs_created_at ON pdfs(created_at);
      CREATE INDEX IF NOT EXISTS idx_pdfs_user_status ON pdfs(user_id, status);
    `);

    // Create questions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pdf_id UUID REFERENCES pdfs(id) ON DELETE CASCADE NOT NULL,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option TEXT NOT NULL,
        explanation TEXT,
        difficulty difficulty_level DEFAULT 'medium' NOT NULL,
        page_reference INTEGER,
        quality_score DECIMAL(3,2) NOT NULL,
        validation_status validation_status DEFAULT 'pending' NOT NULL,
        validation_errors JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_questions_pdf_id ON questions(pdf_id);
      CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
      CREATE INDEX IF NOT EXISTS idx_questions_quality ON questions(quality_score);
      CREATE INDEX IF NOT EXISTS idx_questions_validation ON questions(validation_status);
      CREATE INDEX IF NOT EXISTS idx_questions_pdf_difficulty ON questions(pdf_id, difficulty);
      CREATE INDEX IF NOT EXISTS idx_questions_valid_quality ON questions(validation_status, quality_score);
    `);

    // Create quiz_sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quiz_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        pdf_id UUID REFERENCES pdfs(id) ON DELETE CASCADE NOT NULL,
        difficulty_filter difficulty_level,
        total_questions INTEGER NOT NULL,
        correct_answers INTEGER DEFAULT 0 NOT NULL,
        status quiz_status DEFAULT 'in_progress' NOT NULL,
        score_percentage DECIMAL(5,2),
        started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_sessions_pdf_id ON quiz_sessions(pdf_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status ON quiz_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_pdf ON quiz_sessions(user_id, pdf_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_sessions_started_at ON quiz_sessions(started_at);
    `);

    // Create user_answers table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quiz_session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE NOT NULL,
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
        selected_option TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        time_spent_seconds INTEGER,
        confidence_level confidence_level,
        answered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_answers_session_id ON user_answers(quiz_session_id);
      CREATE INDEX IF NOT EXISTS idx_user_answers_question_id ON user_answers(question_id);
      CREATE INDEX IF NOT EXISTS idx_user_answers_is_correct ON user_answers(is_correct);
      CREATE INDEX IF NOT EXISTS idx_user_answers_session_question ON user_answers(quiz_session_id, question_id);
    `);

    logger.info('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}
