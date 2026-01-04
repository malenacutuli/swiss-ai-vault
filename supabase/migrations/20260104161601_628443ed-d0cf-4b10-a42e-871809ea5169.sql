-- ===========================================
-- MULTI-MODEL COMPARISON SCHEMA
-- ===========================================

-- Store comparison sessions
CREATE TABLE IF NOT EXISTS ghost_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  models TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store individual model responses within a comparison
CREATE TABLE IF NOT EXISTS ghost_comparison_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id UUID REFERENCES ghost_comparisons(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  response TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'streaming', 'complete', 'error')),
  error_message TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_comparisons_user ON ghost_comparisons(user_id);
CREATE INDEX idx_comparison_responses ON ghost_comparison_responses(comparison_id);

-- RLS Policies
ALTER TABLE ghost_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_comparison_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own comparisons"
  ON ghost_comparisons FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own comparison responses"
  ON ghost_comparison_responses FOR ALL
  USING (
    comparison_id IN (
      SELECT id FROM ghost_comparisons WHERE user_id = auth.uid()
    )
  );