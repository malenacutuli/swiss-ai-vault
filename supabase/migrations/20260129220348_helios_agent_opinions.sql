-- Store individual agent opinions from Grand Rounds
CREATE TABLE IF NOT EXISTS helios_agent_opinions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES helios_sessions(session_id) ON DELETE CASCADE,
  debate_round INTEGER DEFAULT 1,
  agent_id VARCHAR(100) NOT NULL,
  agent_role VARCHAR(200),

  -- Analysis content
  question_analysis JSONB,
  differential_diagnosis JSONB,  -- Array of {rank, diagnosis, icd10_code, confidence, reasoning}

  -- Confidence
  self_confidence DECIMAL(3,2),  -- 0.00-1.00
  uncertainty_areas TEXT[],

  -- Recommendations
  recommended_actions JSONB,
  urgency_assessment JSONB,  -- {esi_level, reasoning, red_flags[]}

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store consensus results
CREATE TABLE IF NOT EXISTS helios_consensus_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES helios_sessions(session_id) ON DELETE CASCADE UNIQUE,

  -- Consensus metrics
  achieved BOOLEAN NOT NULL,
  agreement_score DECIMAL(4,3),  -- 0.000-1.000
  kendall_w DECIMAL(4,3),
  rounds_required INTEGER DEFAULT 1,

  -- Final diagnosis
  primary_diagnosis JSONB NOT NULL,
  differential_diagnosis JSONB NOT NULL,  -- Array

  -- Urgency
  final_urgency JSONB NOT NULL,

  -- Plan
  plan_of_action JSONB NOT NULL,

  -- Dissent
  dissenting_opinions JSONB,

  -- Safety
  human_review_required BOOLEAN DEFAULT false,
  red_flags_identified TEXT[],

  -- Metrics
  processing_time_ms INTEGER,
  experts_consulted INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OLDCARTS tracking table (if not exists)
CREATE TABLE IF NOT EXISTS helios_oldcarts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES helios_sessions(session_id) ON DELETE CASCADE UNIQUE,

  onset JSONB DEFAULT '{"value": null, "complete": false}',
  location JSONB DEFAULT '{"value": null, "complete": false}',
  duration JSONB DEFAULT '{"value": null, "complete": false}',
  character JSONB DEFAULT '{"value": null, "complete": false}',
  aggravating JSONB DEFAULT '{"value": null, "complete": false}',
  relieving JSONB DEFAULT '{"value": null, "complete": false}',
  timing JSONB DEFAULT '{"value": null, "complete": false}',
  severity JSONB DEFAULT '{"value": null, "complete": false}',

  completeness_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    (
      (CASE WHEN (onset->>'complete')::boolean THEN 15 ELSE 0 END) +
      (CASE WHEN (location->>'complete')::boolean THEN 15 ELSE 0 END) +
      (CASE WHEN (severity->>'complete')::boolean THEN 15 ELSE 0 END) +
      (CASE WHEN (character->>'complete')::boolean THEN 12 ELSE 0 END) +
      (CASE WHEN (duration->>'complete')::boolean THEN 12 ELSE 0 END) +
      (CASE WHEN (timing->>'complete')::boolean THEN 12 ELSE 0 END) +
      (CASE WHEN (aggravating->>'complete')::boolean THEN 9.5 ELSE 0 END) +
      (CASE WHEN (relieving->>'complete')::boolean THEN 9.5 ELSE 0 END)
    )
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_opinions_session ON helios_agent_opinions(session_id);
CREATE INDEX IF NOT EXISTS idx_consensus_session ON helios_consensus_results(session_id);
CREATE INDEX IF NOT EXISTS idx_oldcarts_session ON helios_oldcarts(session_id);

-- RLS Policies
ALTER TABLE helios_agent_opinions ENABLE ROW LEVEL SECURITY;
ALTER TABLE helios_consensus_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE helios_oldcarts ENABLE ROW LEVEL SECURITY;

-- Users can view their own data
CREATE POLICY "Users view own agent opinions"
  ON helios_agent_opinions FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM helios_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users view own consensus results"
  ON helios_consensus_results FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM helios_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users view own oldcarts"
  ON helios_oldcarts FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM helios_sessions WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY "Service role full access to agent opinions"
  ON helios_agent_opinions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to consensus"
  ON helios_consensus_results FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to oldcarts"
  ON helios_oldcarts FOR ALL
  USING (auth.role() = 'service_role');
