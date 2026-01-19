-- Migration: OT Collaboration System
-- Description: Creates tables for Operational Transformation real-time collaboration
-- Spec: CHARACTER_LEVEL_OT_IMPLEMENTATION.md

-- ============================================================================
-- Part 1: OT Documents Table
-- ============================================================================
-- Stores document content and version

CREATE TABLE IF NOT EXISTS ot_documents (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Workspace Reference
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Document Content
    content TEXT NOT NULL DEFAULT '',

    -- Version Tracking
    version INTEGER NOT NULL DEFAULT 0,
    content_hash VARCHAR(16) NOT NULL DEFAULT '',

    -- Metadata
    title VARCHAR(255),
    file_path VARCHAR(500),
    mime_type VARCHAR(100) DEFAULT 'text/plain',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT ot_documents_version_positive CHECK (version >= 0)
);

-- Indexes
CREATE INDEX idx_ot_documents_workspace ON ot_documents(workspace_id);
CREATE INDEX idx_ot_documents_file_path ON ot_documents(workspace_id, file_path);


-- ============================================================================
-- Part 2: Operation History Table
-- ============================================================================
-- Stores all operations for replay and undo

CREATE TABLE IF NOT EXISTS ot_operation_history (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Document Reference
    document_id UUID NOT NULL REFERENCES ot_documents(id) ON DELETE CASCADE,

    -- Batch Information
    batch_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Version (unique per document)
    version INTEGER NOT NULL,

    -- Operations (JSONB array)
    operations JSONB NOT NULL,

    -- Metadata
    source VARCHAR(20) NOT NULL DEFAULT 'user',
        -- 'user': Normal user edit
        -- 'undo': Undo operation
        -- 'redo': Redo operation
        -- 'server': Server-initiated change

    cursor_before INTEGER,
    cursor_after INTEGER,
    selection_before JSONB,  -- [start, end]
    selection_after JSONB,

    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT ot_operation_history_version_positive CHECK (version >= 0),
    CONSTRAINT ot_operation_history_unique_version UNIQUE (document_id, version),
    CONSTRAINT ot_operation_history_source CHECK (source IN ('user', 'undo', 'redo', 'server'))
);

-- Indexes
CREATE INDEX idx_ot_operation_history_document ON ot_operation_history(document_id);
CREATE INDEX idx_ot_operation_history_document_version ON ot_operation_history(document_id, version);
CREATE INDEX idx_ot_operation_history_user ON ot_operation_history(user_id);
CREATE INDEX idx_ot_operation_history_timestamp ON ot_operation_history(timestamp);
CREATE INDEX idx_ot_operation_history_batch ON ot_operation_history(batch_id);


-- ============================================================================
-- Part 3: Document Checkpoints Table
-- ============================================================================
-- Stores periodic snapshots for efficient history replay

CREATE TABLE IF NOT EXISTS ot_document_checkpoints (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Document Reference
    document_id UUID NOT NULL REFERENCES ot_documents(id) ON DELETE CASCADE,

    -- Checkpoint Version
    version INTEGER NOT NULL,

    -- Content Snapshot
    content TEXT NOT NULL,
    content_hash VARCHAR(16) NOT NULL,

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT ot_document_checkpoints_unique UNIQUE (document_id, version)
);

-- Indexes
CREATE INDEX idx_ot_document_checkpoints_document ON ot_document_checkpoints(document_id);
CREATE INDEX idx_ot_document_checkpoints_version ON ot_document_checkpoints(document_id, version DESC);


-- ============================================================================
-- Part 4: Active Cursors Table
-- ============================================================================
-- Tracks active user cursors (ephemeral presence data)

CREATE TABLE IF NOT EXISTS ot_active_cursors (
    -- Composite Primary Key
    user_id UUID NOT NULL,
    document_id UUID NOT NULL REFERENCES ot_documents(id) ON DELETE CASCADE,

    -- Cursor Position
    position INTEGER NOT NULL,

    -- Selection
    selection_start INTEGER,
    selection_end INTEGER,

    -- User Display Info
    user_name VARCHAR(100),
    user_color VARCHAR(7),  -- Hex color like #FF5733

    -- Last Update
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Primary Key
    PRIMARY KEY (user_id, document_id)
);

-- Indexes
CREATE INDEX idx_ot_active_cursors_document ON ot_active_cursors(document_id);

-- Auto-cleanup old cursors (consider using a scheduled job)
CREATE INDEX idx_ot_active_cursors_stale ON ot_active_cursors(updated_at)
    WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes';


-- ============================================================================
-- Part 5: Collaboration Sessions Table (links to existing schema)
-- ============================================================================
-- Extends existing collaboration_sessions with OT-specific fields

ALTER TABLE collaboration_sessions
    ADD COLUMN IF NOT EXISTS ot_document_id UUID REFERENCES ot_documents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ot_enabled BOOLEAN DEFAULT FALSE;


-- ============================================================================
-- Part 6: Stored Procedures
-- ============================================================================

-- Function: Save Operation Batch (atomic operation)
CREATE OR REPLACE FUNCTION save_ot_operation_batch(
    p_document_id UUID,
    p_batch_id UUID,
    p_user_id UUID,
    p_version INTEGER,
    p_operations JSONB,
    p_new_content TEXT,
    p_source VARCHAR DEFAULT 'user'
) RETURNS TABLE (
    success BOOLEAN,
    new_version INTEGER,
    content_hash VARCHAR
) AS $$
DECLARE
    v_current_version INTEGER;
    v_content_hash VARCHAR(16);
BEGIN
    -- Lock document row for update
    SELECT version INTO v_current_version
    FROM ot_documents
    WHERE id = p_document_id
    FOR UPDATE;

    -- Verify version matches
    IF v_current_version != p_version THEN
        RETURN QUERY SELECT FALSE, v_current_version, NULL::VARCHAR;
        RETURN;
    END IF;

    -- Compute content hash
    v_content_hash := LEFT(encode(sha256(p_new_content::bytea), 'hex'), 16);

    -- Update document
    UPDATE ot_documents
    SET content = p_new_content,
        version = p_version + 1,
        content_hash = v_content_hash,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_document_id;

    -- Insert operation history
    INSERT INTO ot_operation_history (
        document_id, batch_id, user_id, version, operations, source
    ) VALUES (
        p_document_id, p_batch_id, p_user_id, p_version + 1, p_operations, p_source
    );

    -- Create checkpoint if needed (every 100 versions)
    IF (p_version + 1) % 100 = 0 THEN
        INSERT INTO ot_document_checkpoints (document_id, version, content, content_hash)
        VALUES (p_document_id, p_version + 1, p_new_content, v_content_hash)
        ON CONFLICT (document_id, version) DO NOTHING;
    END IF;

    RETURN QUERY SELECT TRUE, p_version + 1, v_content_hash;
END;
$$ LANGUAGE plpgsql;


-- Function: Get Document at Version (with checkpoint optimization)
CREATE OR REPLACE FUNCTION get_ot_document_at_version(
    p_document_id UUID,
    p_version INTEGER
) RETURNS TABLE (
    content TEXT,
    version INTEGER,
    content_hash VARCHAR
) AS $$
DECLARE
    v_checkpoint_version INTEGER;
    v_checkpoint_content TEXT;
    v_result_content TEXT;
    v_batch RECORD;
BEGIN
    -- Find nearest checkpoint at or before requested version
    SELECT c.version, c.content INTO v_checkpoint_version, v_checkpoint_content
    FROM ot_document_checkpoints c
    WHERE c.document_id = p_document_id
        AND c.version <= p_version
    ORDER BY c.version DESC
    LIMIT 1;

    -- If no checkpoint, start from empty
    IF v_checkpoint_version IS NULL THEN
        v_checkpoint_version := 0;
        v_checkpoint_content := '';
    END IF;

    -- Replay operations from checkpoint to requested version
    v_result_content := v_checkpoint_content;

    FOR v_batch IN
        SELECT oh.operations
        FROM ot_operation_history oh
        WHERE oh.document_id = p_document_id
            AND oh.version > v_checkpoint_version
            AND oh.version <= p_version
        ORDER BY oh.version
    LOOP
        -- Apply operations (simplified - in practice, use application code)
        -- This is a placeholder; actual replay should happen in application layer
        NULL;
    END LOOP;

    RETURN QUERY
    SELECT v_result_content, p_version, LEFT(encode(sha256(v_result_content::bytea), 'hex'), 16);
END;
$$ LANGUAGE plpgsql;


-- Function: Update Cursor Position
CREATE OR REPLACE FUNCTION update_ot_cursor(
    p_user_id UUID,
    p_document_id UUID,
    p_position INTEGER,
    p_selection_start INTEGER DEFAULT NULL,
    p_selection_end INTEGER DEFAULT NULL,
    p_user_name VARCHAR DEFAULT NULL,
    p_user_color VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO ot_active_cursors (
        user_id, document_id, position, selection_start, selection_end, user_name, user_color, updated_at
    ) VALUES (
        p_user_id, p_document_id, p_position, p_selection_start, p_selection_end, p_user_name, p_user_color, CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id, document_id) DO UPDATE SET
        position = EXCLUDED.position,
        selection_start = EXCLUDED.selection_start,
        selection_end = EXCLUDED.selection_end,
        user_name = COALESCE(EXCLUDED.user_name, ot_active_cursors.user_name),
        user_color = COALESCE(EXCLUDED.user_color, ot_active_cursors.user_color),
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;


-- Function: Remove Cursor
CREATE OR REPLACE FUNCTION remove_ot_cursor(
    p_user_id UUID,
    p_document_id UUID
) RETURNS VOID AS $$
BEGIN
    DELETE FROM ot_active_cursors
    WHERE user_id = p_user_id AND document_id = p_document_id;
END;
$$ LANGUAGE plpgsql;


-- Function: Cleanup Stale Cursors (run periodically)
CREATE OR REPLACE FUNCTION cleanup_stale_ot_cursors(
    p_stale_threshold INTERVAL DEFAULT '5 minutes'
) RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM ot_active_cursors
    WHERE updated_at < CURRENT_TIMESTAMP - p_stale_threshold;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Part 7: Views
-- ============================================================================

-- View: Document with Active Collaborators
CREATE OR REPLACE VIEW v_ot_document_collaborators AS
SELECT
    d.id as document_id,
    d.workspace_id,
    d.title,
    d.version,
    d.updated_at,
    COUNT(DISTINCT c.user_id) as active_collaborators,
    array_agg(DISTINCT c.user_id) FILTER (WHERE c.user_id IS NOT NULL) as collaborator_ids
FROM ot_documents d
LEFT JOIN ot_active_cursors c ON d.id = c.document_id
    AND c.updated_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
GROUP BY d.id;


-- View: Recent Document Activity
CREATE OR REPLACE VIEW v_ot_recent_activity AS
SELECT
    oh.document_id,
    d.title,
    oh.user_id,
    oh.version,
    oh.source,
    oh.timestamp,
    jsonb_array_length(oh.operations) as operation_count
FROM ot_operation_history oh
JOIN ot_documents d ON oh.document_id = d.id
WHERE oh.timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY oh.timestamp DESC;


-- ============================================================================
-- Part 8: Triggers
-- ============================================================================

-- Trigger: Update document updated_at
CREATE OR REPLACE FUNCTION update_ot_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ot_document_updated
    BEFORE UPDATE ON ot_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_ot_document_timestamp();


-- ============================================================================
-- Part 9: Row Level Security
-- ============================================================================

-- Enable RLS
ALTER TABLE ot_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_operation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_document_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_active_cursors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can access documents in their workspaces
CREATE POLICY "Users can access workspace documents"
    ON ot_documents FOR ALL
    USING (
        workspace_id IN (
            SELECT ws.id FROM workspaces ws
            JOIN workspace_members wm ON ws.id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );

-- Policy: Users can view operation history for accessible documents
CREATE POLICY "Users can view operation history"
    ON ot_operation_history FOR SELECT
    USING (
        document_id IN (
            SELECT id FROM ot_documents WHERE workspace_id IN (
                SELECT ws.id FROM workspaces ws
                JOIN workspace_members wm ON ws.id = wm.workspace_id
                WHERE wm.user_id = auth.uid()
            )
        )
    );

-- Policy: Users can insert operations for accessible documents
CREATE POLICY "Users can insert operations"
    ON ot_operation_history FOR INSERT
    WITH CHECK (
        document_id IN (
            SELECT id FROM ot_documents WHERE workspace_id IN (
                SELECT ws.id FROM workspaces ws
                JOIN workspace_members wm ON ws.id = wm.workspace_id
                WHERE wm.user_id = auth.uid()
            )
        )
    );

-- Policy: Users can manage their own cursors
CREATE POLICY "Users can manage own cursors"
    ON ot_active_cursors FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can view cursors in accessible documents
CREATE POLICY "Users can view document cursors"
    ON ot_active_cursors FOR SELECT
    USING (
        document_id IN (
            SELECT id FROM ot_documents WHERE workspace_id IN (
                SELECT ws.id FROM workspaces ws
                JOIN workspace_members wm ON ws.id = wm.workspace_id
                WHERE wm.user_id = auth.uid()
            )
        )
    );


-- ============================================================================
-- Done
-- ============================================================================
