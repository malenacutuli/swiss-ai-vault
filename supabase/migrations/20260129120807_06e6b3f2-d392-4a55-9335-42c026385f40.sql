-- Create helios_sessions table with all completion columns
CREATE TABLE IF NOT EXISTS helios_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID,
  language TEXT DEFAULT 'en',
  current_phase TEXT DEFAULT 'intake',
  messages JSONB DEFAULT '[]'::jsonb,
  symptom_entities JSONB DEFAULT '[]'::jsonb,
  hypothesis_list JSONB DEFAULT '[]'::jsonb,
  red_flags JSONB DEFAULT '[]'::jsonb,
  escalation_triggered BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  triage_level TEXT,
  disposition TEXT,
  chief_complaint TEXT,
  summary TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE helios_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own sessions"
ON helios_sessions FOR SELECT TO authenticated
USING (auth.uid() = patient_id OR auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
ON helios_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = patient_id OR auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON helios_sessions FOR UPDATE TO authenticated
USING (auth.uid() = patient_id OR auth.uid() = user_id);

-- Create indexes for completed sessions query
CREATE INDEX IF NOT EXISTS idx_helios_sessions_completed
  ON helios_sessions(patient_id, completed_at)
  WHERE current_phase = 'completed';

CREATE INDEX IF NOT EXISTS idx_helios_sessions_user_completed
  ON helios_sessions(user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_helios_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_helios_sessions_timestamp
  BEFORE UPDATE ON helios_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_helios_sessions_updated_at();