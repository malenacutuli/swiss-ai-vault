-- Create documents table for document sync
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Document metadata
    title TEXT NOT NULL,
    content TEXT,
    type TEXT NOT NULL DEFAULT 'markdown', -- 'markdown', 'html', 'plain'

    -- Sync metadata
    local_version INTEGER DEFAULT 1,
    remote_version INTEGER DEFAULT 1,
    last_synced_at TIMESTAMPTZ,

    -- Collaboration
    is_shared BOOLEAN DEFAULT false,
    shared_with UUID[],

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
    ON documents FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = ANY(shared_with));

CREATE POLICY "Users can insert own documents"
    ON documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
    ON documents FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
    ON documents FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);

COMMENT ON TABLE documents IS 'User documents with sync support';
