-- Run in Supabase SQL Editor
-- Migration: helios_sessions_table.sql

CREATE TABLE IF NOT EXISTS helios_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id),
  
  -- Language and specialty
  language VARCHAR(10) DEFAULT 'en',
  specialty VARCHAR(50) DEFAULT 'primary-care',
  
  -- State
  current_phase VARCHAR(50) DEFAULT 'intake',
  
  -- Messages (stored as JSONB array)
  messages JSONB DEFAULT '[]'::jsonb,
  
  -- Patient info (age, sex, etc)
  patient_info JSONB DEFAULT '{}'::jsonb,
  
  -- Safety
  red_flags JSONB DEFAULT '[]'::jsonb,
  escalation_triggered BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE helios_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous session creation (for guest users)
CREATE POLICY "Allow anonymous session creation" ON helios_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow users to view their own sessions
CREATE POLICY "Users can view own sessions" ON helios_sessions
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow updates to sessions
CREATE POLICY "Allow session updates" ON helios_sessions
  FOR UPDATE TO anon, authenticated
  USING (true);

-- Index for performance
CREATE INDEX idx_helios_sessions_patient ON helios_sessions(patient_id);
CREATE INDEX idx_helios_sessions_created ON helios_sessions(created_at DESC);
