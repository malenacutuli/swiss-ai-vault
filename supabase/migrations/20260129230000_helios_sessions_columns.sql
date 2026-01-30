-- Add missing columns for helios_sessions that the edge function expects
ALTER TABLE helios_sessions ADD COLUMN IF NOT EXISTS oldcarts_data JSONB DEFAULT '{}';
ALTER TABLE helios_sessions ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
ALTER TABLE helios_sessions ADD COLUMN IF NOT EXISTS triage_level INTEGER;
ALTER TABLE helios_sessions ADD COLUMN IF NOT EXISTS soap_note JSONB;
ALTER TABLE helios_sessions ADD COLUMN IF NOT EXISTS disposition VARCHAR(50);
