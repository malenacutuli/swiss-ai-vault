-- ============================================
-- HELIOS Healthcare Module Schema
-- Multi-language support: EN, ES, FR
-- ============================================

-- Create HELIOS schema
CREATE SCHEMA IF NOT EXISTS helios;

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE helios.language_enum AS ENUM ('en', 'es', 'fr');

CREATE TYPE helios.phase_enum AS ENUM (
  'intake', 'identity_verification', 'chief_complaint',
  'history_taking', 'triage', 'differential', 'plan',
  'safety_gate', 'booking', 'documentation',
  'completed', 'escalated', 'abandoned'
);

CREATE TYPE helios.triage_enum AS ENUM (
  'ESI1', 'ESI2', 'ESI3', 'ESI4', 'ESI5'
);

CREATE TYPE helios.disposition_enum AS ENUM (
  'emergency', 'urgent_care', 'primary_care',
  'specialist', 'telehealth', 'self_care'
);

CREATE TYPE helios.severity_enum AS ENUM (
  'critical', 'high', 'moderate', 'low'
);

CREATE TYPE helios.audit_event_type AS ENUM (
  'session_started', 'phase_transition', 'message_received',
  'message_sent', 'agent_output', 'tool_call', 'tool_response',
  'red_flag_detected', 'escalation_triggered', 'safety_check',
  'booking_created', 'handoff_generated', 'session_completed',
  'voice_processed', 'emotion_detected', 'error_occurred'
);

-- ============================================
-- MAIN SESSIONS TABLE
-- ============================================

CREATE TABLE helios.case_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id),
  tenant_id UUID,

  -- Language
  language helios.language_enum NOT NULL DEFAULT 'en',

  -- State machine
  current_phase helios.phase_enum NOT NULL DEFAULT 'intake',
  phase_history JSONB NOT NULL DEFAULT '[]',

  -- Patient demographics
  patient_demographics JSONB NOT NULL DEFAULT '{}',

  -- Chief complaint
  chief_complaint TEXT,
  chief_complaint_data JSONB,

  -- Clinical data
  symptom_entities JSONB NOT NULL DEFAULT '[]',
  medical_history JSONB NOT NULL DEFAULT '[]',
  surgical_history JSONB NOT NULL DEFAULT '[]',
  medications JSONB NOT NULL DEFAULT '[]',
  allergies JSONB NOT NULL DEFAULT '[]',
  family_history JSONB NOT NULL DEFAULT '[]',
  social_history JSONB NOT NULL DEFAULT '{}',

  -- Hypothesis & reasoning
  hypothesis_list JSONB NOT NULL DEFAULT '[]',
  evidence_map JSONB NOT NULL DEFAULT '{}',

  -- Safety
  red_flags JSONB NOT NULL DEFAULT '[]',
  escalation_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_reason TEXT,

  -- Triage & disposition
  triage_level helios.triage_enum,
  disposition JSONB,
  final_confidence DECIMAL(3,2),

  -- Consensus
  consensus_data JSONB,

  -- Team outputs
  team_outputs JSONB NOT NULL DEFAULT '{}',

  -- Conversation
  messages JSONB NOT NULL DEFAULT '[]',

  -- Voice analytics
  voice_analytics JSONB,

  -- Tool history
  tool_calls JSONB NOT NULL DEFAULT '[]',

  -- Booking
  booking_data JSONB,

  -- Handoff
  handoff_packet_id UUID,
  handoff_data JSONB,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_helios_sessions_patient ON helios.case_sessions(patient_id);
CREATE INDEX idx_helios_sessions_tenant ON helios.case_sessions(tenant_id);
CREATE INDEX idx_helios_sessions_language ON helios.case_sessions(language);
CREATE INDEX idx_helios_sessions_phase ON helios.case_sessions(current_phase);
CREATE INDEX idx_helios_sessions_triage ON helios.case_sessions(triage_level);
CREATE INDEX idx_helios_sessions_escalated ON helios.case_sessions(escalation_triggered) WHERE escalation_triggered = TRUE;
CREATE INDEX idx_helios_sessions_created ON helios.case_sessions(created_at DESC);

-- RLS
ALTER TABLE helios.case_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions" ON helios.case_sessions
  FOR ALL USING (
    patient_id = auth.uid() OR
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION helios.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON helios.case_sessions
  FOR EACH ROW
  EXECUTE FUNCTION helios.update_updated_at();

-- ============================================
-- AUDIT LOG (WORM - Write Once Read Many)
-- ============================================

CREATE TABLE helios.audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES helios.case_sessions(session_id),

  -- Event info
  event_type helios.audit_event_type NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,

  -- Content
  event_payload JSONB NOT NULL,

  -- Language
  language helios.language_enum NOT NULL DEFAULT 'en',

  -- Hash chain for integrity
  previous_hash TEXT NOT NULL DEFAULT 'genesis',
  event_hash TEXT NOT NULL,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent modifications (WORM)
CREATE OR REPLACE FUNCTION helios.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is immutable - modifications not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_no_update
  BEFORE UPDATE ON helios.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION helios.prevent_audit_modification();

CREATE TRIGGER audit_no_delete
  BEFORE DELETE ON helios.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION helios.prevent_audit_modification();

-- Indexes
CREATE INDEX idx_helios_audit_session ON helios.audit_log(session_id);
CREATE INDEX idx_helios_audit_type ON helios.audit_log(event_type);
CREATE INDEX idx_helios_audit_created ON helios.audit_log(created_at DESC);

-- ============================================
-- RED FLAG RULES REFERENCE TABLE
-- ============================================

CREATE TABLE helios.red_flag_rules (
  rule_id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  category TEXT NOT NULL,
  severity helios.severity_enum NOT NULL,
  escalation_level TEXT NOT NULL CHECK (escalation_level IN ('emergency', 'urgent', 'flag_only')),
  rule_conditions JSONB NOT NULL,
  action_en TEXT NOT NULL,
  action_es TEXT NOT NULL,
  action_fr TEXT NOT NULL,
  emergency_number_en TEXT NOT NULL DEFAULT '911',
  emergency_number_es TEXT NOT NULL DEFAULT '911',
  emergency_number_fr TEXT NOT NULL DEFAULT '15',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial red flag rules
INSERT INTO helios.red_flag_rules (rule_id, name_en, name_es, name_fr, category, severity, escalation_level, rule_conditions, action_en, action_es, action_fr, emergency_number_en, emergency_number_es, emergency_number_fr) VALUES
('cardiac_001', 'Chest Pain with Risk Factors', 'Dolor Torácico con Factores de Riesgo', 'Douleur Thoracique avec Facteurs de Risque',
 'cardiac', 'critical', 'emergency',
 '{"keywords": ["chest pain", "chest pressure"], "risk_factors": ["age>=40", "diabetes", "hypertension"]}',
 'EMERGENCY: Call 911 immediately', 'EMERGENCIA: Llame al 911 inmediatamente', 'URGENCE: Appelez le 15 immédiatement',
 '911', '911', '15'),

('neuro_001', 'Stroke Symptoms (FAST)', 'Síntomas de Derrame (FAST)', 'Symptômes d''AVC (FAST)',
 'neuro', 'critical', 'emergency',
 '{"keywords": ["facial droop", "arm weakness", "speech difficulty", "sudden severe headache"]}',
 'EMERGENCY: Possible stroke. Call 911', 'EMERGENCIA: Posible derrame. Llame al 911', 'URGENCE: AVC possible. Appelez le 15',
 '911', '911', '15'),

('psych_001', 'Suicidal Ideation', 'Ideación Suicida', 'Idéation Suicidaire',
 'psychiatric', 'critical', 'emergency',
 '{"keywords": ["kill myself", "want to die", "suicide", "end my life"]}',
 'CRISIS: Call 988 immediately', 'CRISIS: Llame al 024 inmediatamente', 'CRISE: Appelez le 3114 immédiatement',
 '988', '024', '3114'),

('peds_001', 'Infant Fever', 'Fiebre en Lactante', 'Fièvre du Nourrisson',
 'pediatric', 'critical', 'emergency',
 '{"age_months_lt": 3, "keywords": ["fever"], "temperature_f_gte": 100.4}',
 'EMERGENCY: Infant fever requires ER', 'EMERGENCIA: Fiebre en lactante requiere urgencias', 'URGENCE: Fièvre du nourrisson nécessite urgences',
 '911', '911', '15');

-- ============================================
-- HANDOFF PACKETS
-- ============================================

CREATE TABLE helios.handoff_packets (
  packet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES helios.case_sessions(session_id),

  -- Language
  language helios.language_enum NOT NULL,

  -- Content
  soap_note JSONB NOT NULL,
  patient_summary TEXT NOT NULL,
  clinical_timeline JSONB NOT NULL DEFAULT '[]',
  red_flags JSONB NOT NULL DEFAULT '[]',
  evidence_citations JSONB NOT NULL DEFAULT '[]',
  unanswered_questions JSONB NOT NULL DEFAULT '[]',
  recommended_workup JSONB NOT NULL DEFAULT '[]',

  -- AI Disclaimer
  ai_disclaimer TEXT NOT NULL,

  -- Destination
  destination_type helios.disposition_enum NOT NULL,
  provider_id TEXT,

  -- Timestamps
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_helios_handoff_session ON helios.handoff_packets(session_id);
CREATE INDEX idx_helios_handoff_generated ON helios.handoff_packets(generated_at DESC);

-- RLS
ALTER TABLE helios.handoff_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_handoffs" ON helios.handoff_packets
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
