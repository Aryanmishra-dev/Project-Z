-- PostgreSQL Initialization Script
-- This script runs when the container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE quiz_dev TO postgres;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Database initialized successfully at %', NOW();
END $$;
