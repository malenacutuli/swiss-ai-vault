-- Source Citations System for Manus Parity
-- Provides structured citation tracking with verification

-- Table: source_citations - stores verified source citations
CREATE TABLE IF NOT EXISTS source_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID, -- Reference to agent run

  -- Source information
  source_url TEXT NOT NULL,
  source_title TEXT,
  source_domain TEXT,
  source_type TEXT DEFAULT 'web', -- 'web', 'academic', 'news', 'database', 'api'

  -- Citation metadata
  citation_key TEXT NOT NULL, -- e.g., "[1]", "[Smith2024]"
  access_date TIMESTAMPTZ DEFAULT NOW(),
  publication_date DATE,
  author TEXT,

  -- Content
  excerpt TEXT, -- Relevant excerpt from source
  full_content TEXT, -- Cached full content (optional)

  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verification_method TEXT, -- 'url_check', 'content_hash', 'manual'
  verification_date TIMESTAMPTZ,
  content_hash TEXT, -- SHA256 of content for change detection

  -- Quality scores
  relevance_score DECIMAL(3,2) DEFAULT 0.00,
  credibility_score DECIMAL(3,2) DEFAULT 0.00,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: citation_claims - tracks factual claims with their sources
CREATE TABLE IF NOT EXISTS citation_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID,
  citation_id UUID REFERENCES source_citations(id) ON DELETE CASCADE,

  -- Claim information
  claim_text TEXT NOT NULL,
  claim_type TEXT DEFAULT 'fact', -- 'fact', 'statistic', 'quote', 'opinion'

  -- Context
  context_before TEXT,
  context_after TEXT,
  position_in_output INTEGER, -- Character position in output

  -- Verification status
  verification_status TEXT DEFAULT 'unverified', -- 'unverified', 'verified', 'disputed', 'false'
  confidence_score DECIMAL(3,2) DEFAULT 0.00,

  -- Source matching
  source_excerpt TEXT, -- The part of the source that supports this claim
  match_quality TEXT, -- 'exact', 'paraphrase', 'inferred'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: citation_verification_logs - audit trail for verification attempts
CREATE TABLE IF NOT EXISTS citation_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citation_id UUID REFERENCES source_citations(id) ON DELETE CASCADE,

  -- Verification attempt
  verification_type TEXT NOT NULL, -- 'url_accessible', 'content_match', 'claim_check'
  verification_result BOOLEAN,
  verification_details JSONB DEFAULT '{}',

  -- Error handling
  error_message TEXT,
  http_status INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_source_citations_user ON source_citations(user_id);
CREATE INDEX IF NOT EXISTS idx_source_citations_run ON source_citations(run_id);
CREATE INDEX IF NOT EXISTS idx_source_citations_domain ON source_citations(source_domain);
CREATE INDEX IF NOT EXISTS idx_source_citations_verified ON source_citations(verified);
CREATE INDEX IF NOT EXISTS idx_citation_claims_citation ON citation_claims(citation_id);
CREATE INDEX IF NOT EXISTS idx_citation_claims_run ON citation_claims(run_id);
CREATE INDEX IF NOT EXISTS idx_citation_claims_status ON citation_claims(verification_status);
CREATE INDEX IF NOT EXISTS idx_citation_verification_logs_citation ON citation_verification_logs(citation_id);

-- Enable RLS
ALTER TABLE source_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_verification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own citations
CREATE POLICY "Users see own citations"
ON source_citations FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users insert own citations"
ON source_citations FOR INSERT
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users update own citations"
ON source_citations FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Service role full access citations"
ON source_citations FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Claims policies
CREATE POLICY "Users see own claims"
ON citation_claims FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users insert own claims"
ON citation_claims FOR INSERT
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Service role full access claims"
ON citation_claims FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Verification logs policies (read-only for users)
CREATE POLICY "Users see verification logs"
ON citation_verification_logs FOR SELECT
USING (
  citation_id IN (
    SELECT id FROM source_citations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role full access verification logs"
ON citation_verification_logs FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_citation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER source_citations_updated_at
  BEFORE UPDATE ON source_citations
  FOR EACH ROW
  EXECUTE FUNCTION update_citation_updated_at();

CREATE TRIGGER citation_claims_updated_at
  BEFORE UPDATE ON citation_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_citation_updated_at();

-- Comments
COMMENT ON TABLE source_citations IS 'Stores verified source citations for research outputs (Manus parity)';
COMMENT ON TABLE citation_claims IS 'Tracks factual claims and their supporting sources';
COMMENT ON TABLE citation_verification_logs IS 'Audit trail for citation verification attempts';
