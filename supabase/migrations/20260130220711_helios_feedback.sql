-- HELIOS Feedback Collection
-- Stores user feedback on AI assessment quality for continuous improvement

-- User feedback on assessments
CREATE TABLE IF NOT EXISTS helios_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES helios_sessions(session_id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating VARCHAR(20) NOT NULL CHECK (rating IN ('not-helpful', 'so-so', 'helpful')),
  comment TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX idx_helios_feedback_rating ON helios_feedback(rating);
CREATE INDEX idx_helios_feedback_created ON helios_feedback(created_at);
CREATE INDEX idx_helios_feedback_session ON helios_feedback(session_id);

-- RLS
ALTER TABLE helios_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback (or anonymous feedback)
CREATE POLICY "Users can insert own feedback"
  ON helios_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON helios_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Service role has full access for analytics
CREATE POLICY "Service role full access"
  ON helios_feedback FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment for table documentation
COMMENT ON TABLE helios_feedback IS 'User feedback on HELIOS AI assessment quality';
COMMENT ON COLUMN helios_feedback.rating IS 'User rating: not-helpful, so-so, or helpful';
COMMENT ON COLUMN helios_feedback.context IS 'Additional context like ESI level, consensus score, etc.';
