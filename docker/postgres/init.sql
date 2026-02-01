-- PostgreSQL Initialization Script
-- This script runs when the container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE quiz_dev TO postgres;

-- ============================
-- Performance Optimizations
-- ============================

-- Create indexes for analytics queries (after tables exist)
-- These will be created by migrations, but we define them here for reference

-- Composite index for user quiz history (common analytics query)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_sessions_user_completed 
--   ON quiz_sessions(user_id, completed_at DESC) 
--   WHERE status = 'completed';

-- Index for date-based analytics
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_sessions_completed_date 
--   ON quiz_sessions(DATE(completed_at)) 
--   WHERE status = 'completed';

-- Index for user answer correctness analysis
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_answers_question_correct 
--   ON user_answers(question_id, is_correct);

-- Partial index for active sessions only
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_active 
--   ON refresh_tokens(user_id, expires_at) 
--   WHERE revoked_at IS NULL;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Database initialized successfully at %', NOW();
END $$;
