-- Add completion columns to helios_sessions
-- Migration: helios_sessions_completion.sql

-- Add summary column for storing session summaries
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add completed_at column for tracking when sessions are completed
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add user_id column if it doesn't exist (for the index)
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add index for completed sessions query (helps with listing completed sessions)
CREATE INDEX IF NOT EXISTS idx_helios_sessions_completed
  ON helios_sessions(patient_id, completed_at)
  WHERE current_phase = 'completed';

-- Add index for querying by user
CREATE INDEX IF NOT EXISTS idx_helios_sessions_user_completed
  ON helios_sessions(user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
