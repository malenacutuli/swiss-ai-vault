-- Add all missing columns to helios_sessions for full orchestration support
-- Migration: 20260129140000_helios_sessions_full.sql

-- Add chief_complaint column
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS chief_complaint TEXT;

-- Add triage_level as integer (ESI 1-5)
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS triage_level INTEGER;

-- Add disposition column
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS disposition TEXT;

-- Add soap_note column for clinical documentation
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS soap_note TEXT;

-- Add recommended_action column
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS recommended_action TEXT;

-- Add escalation columns
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS escalation_triggered BOOLEAN DEFAULT FALSE;

ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- Add red_flags as JSONB array
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS red_flags JSONB DEFAULT '[]'::jsonb;

-- Add language column
ALTER TABLE helios_sessions
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_helios_sessions_user_id
  ON helios_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_helios_sessions_phase
  ON helios_sessions(current_phase);

CREATE INDEX IF NOT EXISTS idx_helios_sessions_triage
  ON helios_sessions(triage_level)
  WHERE triage_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_helios_sessions_escalated
  ON helios_sessions(escalation_triggered)
  WHERE escalation_triggered = TRUE;
