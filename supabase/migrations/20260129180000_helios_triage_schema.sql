-- HELIOS Medical Triage System - Core Schema
-- Migration: 20260129180000_helios_triage_schema.sql
--
-- This migration creates the foundational tables for:
-- - Structured triage sessions with ESI scoring
-- - OLDCARTS symptom collection framework
-- - Multi-agent Grand Rounds debate protocol
-- - Consensus building with Kendall's W
-- - SOAP note generation
-- - ICD-10 code caching

-- ============================================
-- 1. TRIAGE SESSIONS - Core Session Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS triage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient linkage (nullable for anonymous sessions)
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Link to existing helios_sessions if migrating
  helios_session_id UUID REFERENCES helios_sessions(id) ON DELETE CASCADE,

  -- Language support
  language VARCHAR(5) NOT NULL DEFAULT 'en'
    CONSTRAINT valid_language CHECK (language IN ('en', 'es', 'fr')),

  -- ESI Triage Level (1=Resuscitation, 2=Emergent, 3=Urgent, 4=Less Urgent, 5=Non-urgent)
  esi_level INTEGER
    CONSTRAINT valid_esi CHECK (esi_level IS NULL OR (esi_level >= 1 AND esi_level <= 5)),
  esi_reasoning TEXT,

  -- Session status workflow
  status VARCHAR(20) NOT NULL DEFAULT 'intake'
    CONSTRAINT valid_status CHECK (status IN ('intake', 'assessment', 'debate', 'consensus', 'complete', 'escalated', 'cancelled')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Extensibility
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_triage_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS triage_sessions_updated_at ON triage_sessions;
CREATE TRIGGER triage_sessions_updated_at
  BEFORE UPDATE ON triage_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_triage_sessions_updated_at();

-- ============================================
-- 2. OLDCARTS TRACKING - Structured Symptom Collection
-- ============================================
-- OLDCARTS: Onset, Location, Duration, Character, Aggravating, Relieving, Timing, Severity
CREATE TABLE IF NOT EXISTS oldcarts_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,

  -- Chief complaint (required)
  chief_complaint TEXT NOT NULL,

  -- OLDCARTS components as JSONB for flexibility
  -- Each contains: {value: string, complete: boolean, collected_at: timestamp, follow_up_needed: boolean}
  onset JSONB DEFAULT '{"value": null, "complete": false}'::jsonb,
  location JSONB DEFAULT '{"value": null, "complete": false}'::jsonb,
  duration JSONB DEFAULT '{"value": null, "complete": false}'::jsonb,
  character_ JSONB DEFAULT '{"value": null, "complete": false}'::jsonb,  -- underscore to avoid SQL keyword
  aggravating JSONB DEFAULT '{"value": null, "complete": false}'::jsonb,
  relieving JSONB DEFAULT '{"value": null, "complete": false}'::jsonb,
  timing JSONB DEFAULT '{"value": null, "complete": false}'::jsonb,
  severity JSONB DEFAULT '{"value": null, "complete": false}'::jsonb,  -- value is 0-10 scale

  -- Computed completeness percentage (stored, updated by trigger)
  -- Weighted formula:
  --   Essential (onset, location, severity): 15% each = 45%
  --   Important (character, duration, timing): 12% each = 36%
  --   Supporting (aggravating, relieving): 9.5% each = 19%
  completeness_percentage DECIMAL(5,2) DEFAULT 0.00,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One OLDCARTS record per session
  CONSTRAINT unique_session_oldcarts UNIQUE (session_id)
);

-- Function to calculate OLDCARTS completeness
CREATE OR REPLACE FUNCTION calculate_oldcarts_completeness()
RETURNS TRIGGER AS $$
DECLARE
  score DECIMAL(5,2) := 0.00;
BEGIN
  -- Essential components (15% each = 45% total)
  IF (NEW.onset->>'complete')::boolean = true THEN
    score := score + 15.00;
  END IF;
  IF (NEW.location->>'complete')::boolean = true THEN
    score := score + 15.00;
  END IF;
  IF (NEW.severity->>'complete')::boolean = true THEN
    score := score + 15.00;
  END IF;

  -- Important components (12% each = 36% total)
  IF (NEW.character_->>'complete')::boolean = true THEN
    score := score + 12.00;
  END IF;
  IF (NEW.duration->>'complete')::boolean = true THEN
    score := score + 12.00;
  END IF;
  IF (NEW.timing->>'complete')::boolean = true THEN
    score := score + 12.00;
  END IF;

  -- Supporting components (9.5% each = 19% total)
  IF (NEW.aggravating->>'complete')::boolean = true THEN
    score := score + 9.50;
  END IF;
  IF (NEW.relieving->>'complete')::boolean = true THEN
    score := score + 9.50;
  END IF;

  NEW.completeness_percentage := score;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS oldcarts_completeness_trigger ON oldcarts_tracking;
CREATE TRIGGER oldcarts_completeness_trigger
  BEFORE INSERT OR UPDATE ON oldcarts_tracking
  FOR EACH ROW
  EXECUTE FUNCTION calculate_oldcarts_completeness();

-- ============================================
-- 3. AGENT OPINIONS - Grand Rounds Debate System
-- ============================================
CREATE TABLE IF NOT EXISTS agent_opinions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,

  -- Debate tracking
  debate_round INTEGER NOT NULL DEFAULT 1
    CONSTRAINT valid_round CHECK (debate_round >= 1 AND debate_round <= 10),

  -- Agent identification
  agent_id VARCHAR(100) NOT NULL,  -- e.g., 'diff_cardio', 'safety_chief'
  agent_role VARCHAR(100) NOT NULL,  -- e.g., 'Cardiology Specialist', 'Safety Coordinator'
  agent_model VARCHAR(20) DEFAULT 'sonnet',  -- opus, sonnet, haiku

  -- Differential diagnosis (ranked list with ICD-10 codes)
  -- Array of: {rank: number, icd10_code: string, icd10_name: string, confidence: 0-1, reasoning: string}
  differential_diagnosis JSONB DEFAULT '[]'::jsonb,

  -- Confidence in overall assessment
  confidence_score DECIMAL(3,2)
    CONSTRAINT valid_confidence CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),

  -- Clinical concerns
  concerns TEXT[] DEFAULT '{}',

  -- Evidence supporting the assessment
  supporting_evidence TEXT[] DEFAULT '{}',

  -- Dissenting opinion if disagreeing with emerging consensus
  dissenting_opinion TEXT,

  -- Response to other agents (for multi-round debate)
  responding_to_agent_id VARCHAR(100),
  response_reasoning TEXT,

  -- Processing metadata
  processing_time_ms INTEGER,
  token_count INTEGER,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each agent can only opine once per round per session
  CONSTRAINT unique_agent_round UNIQUE (session_id, debate_round, agent_id)
);

-- ============================================
-- 4. CONSENSUS RESULTS - Final Agreement After Debate
-- ============================================
CREATE TABLE IF NOT EXISTS consensus_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,

  -- Kendall's W coefficient of concordance (0-1, higher = more agreement)
  kendall_w DECIMAL(4,3)
    CONSTRAINT valid_kendall CHECK (kendall_w IS NULL OR (kendall_w >= 0.000 AND kendall_w <= 1.000)),

  -- Consensus status
  consensus_reached BOOLEAN NOT NULL DEFAULT false,
  rounds_required INTEGER NOT NULL DEFAULT 1,
  participating_agents TEXT[] DEFAULT '{}',

  -- Primary diagnosis with ICD-10
  primary_diagnosis JSONB,  -- {icd10_code, icd10_name, confidence, reasoning}

  -- Full differential diagnosis (ranked)
  differential_diagnosis JSONB DEFAULT '[]'::jsonb,

  -- Plan of action
  plan_of_action JSONB DEFAULT '{
    "lab_tests": [],
    "imaging": [],
    "referrals": [],
    "medications": [],
    "patient_education": [],
    "follow_up": null
  }'::jsonb,

  -- Dissenting opinions for transparency
  dissenting_opinions JSONB,  -- Array of {agent_id, agent_role, opinion, reasoning}

  -- Flags for human review
  human_review_required BOOLEAN DEFAULT false,
  human_review_reason TEXT,

  -- Final ESI level (may differ from initial assessment after debate)
  final_esi_level INTEGER
    CONSTRAINT valid_final_esi CHECK (final_esi_level IS NULL OR (final_esi_level >= 1 AND final_esi_level <= 5)),

  -- Disposition recommendation
  disposition VARCHAR(50),  -- 'ED', 'urgent_care', 'pcp_24h', 'pcp_routine', 'self_care', 'telemedicine'

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One consensus result per session
  CONSTRAINT unique_session_consensus UNIQUE (session_id)
);

-- ============================================
-- 5. SOAP NOTES - Clinical Documentation
-- ============================================
CREATE TABLE IF NOT EXISTS soap_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,

  -- SUBJECTIVE: Patient-reported information
  subjective JSONB DEFAULT '{
    "demographics": {},
    "chief_complaint": null,
    "hpi": null,
    "medications": [],
    "allergies": [],
    "social_history": {},
    "family_history": {},
    "review_of_systems": {}
  }'::jsonb,

  -- OBJECTIVE: Observable/measurable findings
  objective JSONB DEFAULT '{
    "vital_signs": {},
    "self_reported_findings": [],
    "physical_exam_notes": null
  }'::jsonb,

  -- ASSESSMENT: Clinical interpretation
  assessment JSONB DEFAULT '{
    "summary_statement": null,
    "problem_list": [],
    "differential_diagnosis": [],
    "clinical_reasoning": null,
    "esi_level": null,
    "esi_reasoning": null
  }'::jsonb,

  -- PLAN: Recommended actions
  plan JSONB DEFAULT '{
    "diagnostics": [],
    "treatments": [],
    "referrals": [],
    "patient_education": [],
    "follow_up": null,
    "red_flag_warnings": []
  }'::jsonb,

  -- Generated PDF storage
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Version tracking for edits
  version INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update trigger for soap_notes
CREATE OR REPLACE FUNCTION update_soap_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS soap_notes_updated_at ON soap_notes;
CREATE TRIGGER soap_notes_updated_at
  BEFORE UPDATE ON soap_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_soap_notes_updated_at();

-- ============================================
-- 6. ICD-10 CACHE - NLM Clinical Tables API Cache
-- ============================================
CREATE TABLE IF NOT EXISTS icd10_cache (
  query_hash VARCHAR(64) PRIMARY KEY,  -- SHA-256 hash of query
  query_text TEXT NOT NULL,
  response_json JSONB NOT NULL,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_icd10_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM icd10_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================

-- Triage sessions indexes
CREATE INDEX IF NOT EXISTS idx_triage_sessions_patient_id
  ON triage_sessions(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triage_sessions_status
  ON triage_sessions(status);

CREATE INDEX IF NOT EXISTS idx_triage_sessions_esi
  ON triage_sessions(esi_level)
  WHERE esi_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_triage_sessions_helios
  ON triage_sessions(helios_session_id)
  WHERE helios_session_id IS NOT NULL;

-- OLDCARTS indexes
CREATE INDEX IF NOT EXISTS idx_oldcarts_session
  ON oldcarts_tracking(session_id);

CREATE INDEX IF NOT EXISTS idx_oldcarts_completeness
  ON oldcarts_tracking(completeness_percentage DESC);

-- Agent opinions indexes (critical for Grand Rounds queries)
CREATE INDEX IF NOT EXISTS idx_agent_opinions_session_round
  ON agent_opinions(session_id, debate_round);

CREATE INDEX IF NOT EXISTS idx_agent_opinions_agent
  ON agent_opinions(agent_id);

-- Consensus results index
CREATE INDEX IF NOT EXISTS idx_consensus_session
  ON consensus_results(session_id);

CREATE INDEX IF NOT EXISTS idx_consensus_review
  ON consensus_results(human_review_required)
  WHERE human_review_required = true;

-- SOAP notes indexes
CREATE INDEX IF NOT EXISTS idx_soap_notes_session
  ON soap_notes(session_id);

-- ICD-10 cache cleanup index
CREATE INDEX IF NOT EXISTS idx_icd10_cache_expires
  ON icd10_cache(expires_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE triage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oldcarts_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_opinions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consensus_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE soap_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE icd10_cache ENABLE ROW LEVEL SECURITY;

-- Triage sessions: Users can only access their own sessions
CREATE POLICY triage_sessions_user_policy ON triage_sessions
  FOR ALL
  USING (
    patient_id = auth.uid()
    OR patient_id IS NULL  -- Allow anonymous sessions for initial access
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR patient_id IS NULL
    OR auth.role() = 'service_role'
  );

-- OLDCARTS: Access through session ownership
CREATE POLICY oldcarts_user_policy ON oldcarts_tracking
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM triage_sessions ts
      WHERE ts.id = oldcarts_tracking.session_id
      AND (ts.patient_id = auth.uid() OR ts.patient_id IS NULL OR auth.role() = 'service_role')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triage_sessions ts
      WHERE ts.id = oldcarts_tracking.session_id
      AND (ts.patient_id = auth.uid() OR ts.patient_id IS NULL OR auth.role() = 'service_role')
    )
  );

-- Agent opinions: Access through session ownership
CREATE POLICY agent_opinions_user_policy ON agent_opinions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM triage_sessions ts
      WHERE ts.id = agent_opinions.session_id
      AND (ts.patient_id = auth.uid() OR ts.patient_id IS NULL OR auth.role() = 'service_role')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triage_sessions ts
      WHERE ts.id = agent_opinions.session_id
      AND (ts.patient_id = auth.uid() OR ts.patient_id IS NULL OR auth.role() = 'service_role')
    )
  );

-- Consensus results: Access through session ownership
CREATE POLICY consensus_user_policy ON consensus_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM triage_sessions ts
      WHERE ts.id = consensus_results.session_id
      AND (ts.patient_id = auth.uid() OR ts.patient_id IS NULL OR auth.role() = 'service_role')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triage_sessions ts
      WHERE ts.id = consensus_results.session_id
      AND (ts.patient_id = auth.uid() OR ts.patient_id IS NULL OR auth.role() = 'service_role')
    )
  );

-- SOAP notes: Access through session ownership
CREATE POLICY soap_notes_user_policy ON soap_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM triage_sessions ts
      WHERE ts.id = soap_notes.session_id
      AND (ts.patient_id = auth.uid() OR ts.patient_id IS NULL OR auth.role() = 'service_role')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM triage_sessions ts
      WHERE ts.id = soap_notes.session_id
      AND (ts.patient_id = auth.uid() OR ts.patient_id IS NULL OR auth.role() = 'service_role')
    )
  );

-- ICD-10 cache: Public read, service role write
CREATE POLICY icd10_cache_read_policy ON icd10_cache
  FOR SELECT
  USING (true);  -- Anyone can read cache

CREATE POLICY icd10_cache_write_policy ON icd10_cache
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY icd10_cache_update_policy ON icd10_cache
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY icd10_cache_delete_policy ON icd10_cache
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get full session with all related data
CREATE OR REPLACE FUNCTION get_full_triage_session(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'session', to_jsonb(ts.*),
    'oldcarts', to_jsonb(ot.*),
    'agent_opinions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(ao.*) ORDER BY ao.debate_round, ao.created_at)
       FROM agent_opinions ao WHERE ao.session_id = p_session_id),
      '[]'::jsonb
    ),
    'consensus', to_jsonb(cr.*),
    'soap_note', to_jsonb(sn.*)
  )
  INTO result
  FROM triage_sessions ts
  LEFT JOIN oldcarts_tracking ot ON ot.session_id = ts.id
  LEFT JOIN consensus_results cr ON cr.session_id = ts.id
  LEFT JOIN soap_notes sn ON sn.session_id = ts.id
  WHERE ts.id = p_session_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate Kendall's W coefficient
-- This is a simplified version; full implementation would need more rounds of debate
CREATE OR REPLACE FUNCTION calculate_kendall_w(p_session_id UUID, p_round INTEGER DEFAULT 1)
RETURNS DECIMAL(4,3) AS $$
DECLARE
  n_judges INTEGER;
  n_items INTEGER;
  sum_rank_sq DECIMAL;
  mean_rank DECIMAL;
  s_value DECIMAL;
  kendall_w DECIMAL(4,3);
BEGIN
  -- Count participating agents
  SELECT COUNT(DISTINCT agent_id) INTO n_judges
  FROM agent_opinions
  WHERE session_id = p_session_id AND debate_round = p_round;

  IF n_judges < 2 THEN
    RETURN NULL;
  END IF;

  -- For now, return a placeholder based on confidence agreement
  -- Full implementation would calculate based on ranking concordance
  SELECT COALESCE(
    1.0 - STDDEV(confidence_score) / NULLIF(AVG(confidence_score), 0),
    0.5
  )::DECIMAL(4,3)
  INTO kendall_w
  FROM agent_opinions
  WHERE session_id = p_session_id AND debate_round = p_round;

  RETURN LEAST(GREATEST(kendall_w, 0.000), 1.000);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE triage_sessions IS 'Core session tracking for HELIOS medical triage with ESI scoring';
COMMENT ON TABLE oldcarts_tracking IS 'OLDCARTS symptom collection framework with weighted completeness scoring';
COMMENT ON TABLE agent_opinions IS 'Individual agent assessments for Grand Rounds multi-agent debate protocol';
COMMENT ON TABLE consensus_results IS 'Final consensus after multi-round agent debate with Kendalls W coefficient';
COMMENT ON TABLE soap_notes IS 'Generated SOAP format clinical documentation';
COMMENT ON TABLE icd10_cache IS 'Cache for NLM Clinical Tables API ICD-10 lookups';

COMMENT ON COLUMN oldcarts_tracking.completeness_percentage IS 'Weighted score: Essential(onset,location,severity)=45%, Important(character,duration,timing)=36%, Supporting(aggravating,relieving)=19%';
COMMENT ON COLUMN consensus_results.kendall_w IS 'Kendalls coefficient of concordance (0-1), measures agreement between agents';
COMMENT ON COLUMN agent_opinions.differential_diagnosis IS 'Array of {rank, icd10_code, icd10_name, confidence, reasoning}';
