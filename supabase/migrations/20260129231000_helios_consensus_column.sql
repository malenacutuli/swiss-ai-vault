-- Add consensus_result column to helios_sessions for tracking when Grand Rounds has run
ALTER TABLE helios_sessions ADD COLUMN IF NOT EXISTS consensus_result JSONB;
