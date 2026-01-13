-- Create artifacts table for generated content
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Link to agent task (optional)
    task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    step_id UUID REFERENCES agent_task_steps(id) ON DELETE SET NULL,

    -- Artifact metadata
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'file', 'code', 'document', 'image', 'chart', 'website', 'slides'
    mime_type TEXT,

    -- Storage
    storage_path TEXT,
    storage_url TEXT,
    content_hash TEXT,
    size_bytes INTEGER,

    -- Content (for small artifacts like code snippets)
    content TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own artifacts
CREATE POLICY "Users can view own artifacts"
    ON artifacts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own artifacts"
    ON artifacts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own artifacts"
    ON artifacts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own artifacts"
    ON artifacts FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_task_id ON artifacts(task_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON artifacts(created_at DESC);

-- Update timestamp trigger
CREATE TRIGGER trigger_artifacts_updated_at
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

COMMENT ON TABLE artifacts IS 'Generated artifacts from agent tasks and user uploads';
