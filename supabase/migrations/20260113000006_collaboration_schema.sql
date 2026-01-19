-- =============================================
-- COLLABORATION SCHEMA
-- Real-time collaboration with Yjs
-- =============================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS collaboration_edits CASCADE;
DROP TABLE IF EXISTS collaboration_invites CASCADE;
DROP TABLE IF EXISTS collaboration_participants CASCADE;
DROP TABLE IF EXISTS collaboration_sessions CASCADE;

-- =============================================
-- COLLABORATION SESSIONS
-- =============================================

CREATE TABLE collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session config
  name TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  -- Access control
  access_type TEXT NOT NULL DEFAULT 'private' CHECK (access_type IN ('private', 'link', 'public')),
  share_token TEXT UNIQUE,

  -- Yjs document
  yjs_document_id TEXT NOT NULL UNIQUE,
  yjs_state BYTEA, -- Serialized Yjs state for persistence

  -- Permissions
  allow_edit BOOLEAN DEFAULT TRUE,
  allow_execute BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collab_sessions_run_id ON collaboration_sessions(run_id);
CREATE INDEX IF NOT EXISTS idx_collab_sessions_owner_id ON collaboration_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_collab_sessions_share_token ON collaboration_sessions(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collab_sessions_yjs_doc ON collaboration_sessions(yjs_document_id);

-- =============================================
-- COLLABORATION PARTICIPANTS
-- =============================================

CREATE TABLE collaboration_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- For anonymous participants
  anonymous_id TEXT,
  display_name TEXT,

  -- Role
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),

  -- Presence
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  -- Cursor position (for presence)
  cursor_position JSONB,

  -- Metadata
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(session_id, user_id),
  UNIQUE(session_id, anonymous_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collab_participants_session ON collaboration_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_collab_participants_user ON collaboration_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_collab_participants_online ON collaboration_participants(session_id, is_online) WHERE is_online = TRUE;

-- =============================================
-- COLLABORATION INVITES
-- =============================================

CREATE TABLE collaboration_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,

  -- Invite details
  email TEXT,
  invite_token TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('editor', 'viewer')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collab_invites_session ON collaboration_invites(session_id);
CREATE INDEX IF NOT EXISTS idx_collab_invites_token ON collaboration_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_collab_invites_email ON collaboration_invites(email);

-- =============================================
-- COLLABORATION EDIT HISTORY
-- For audit and undo
-- =============================================

CREATE TABLE collaboration_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES collaboration_participants(id) ON DELETE CASCADE,

  -- Edit details
  edit_type TEXT NOT NULL CHECK (edit_type IN ('insert', 'delete', 'update', 'format')),
  edit_path TEXT[], -- JSON path to edited element
  old_value JSONB,
  new_value JSONB,

  -- Yjs update
  yjs_update BYTEA,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collab_edits_session ON collaboration_edits(session_id);
CREATE INDEX IF NOT EXISTS idx_collab_edits_participant ON collaboration_edits(participant_id);
CREATE INDEX IF NOT EXISTS idx_collab_edits_created_at ON collaboration_edits(created_at DESC);

-- Partition by month for edit history
-- Note: Implement partition management separately

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_edits ENABLE ROW LEVEL SECURITY;

-- collaboration_sessions
CREATE POLICY "Owners can manage sessions"
  ON collaboration_sessions FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Participants can view sessions"
  ON collaboration_sessions FOR SELECT
  USING (
    id IN (SELECT session_id FROM collaboration_participants WHERE user_id = auth.uid())
    OR access_type = 'public'
  );

CREATE POLICY "Service role has full access"
  ON collaboration_sessions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- collaboration_participants
CREATE POLICY "Session owners can manage participants"
  ON collaboration_participants FOR ALL
  USING (
    session_id IN (SELECT id FROM collaboration_sessions WHERE owner_id = auth.uid())
  );

CREATE POLICY "Participants can view other participants"
  ON collaboration_participants FOR SELECT
  USING (
    session_id IN (SELECT session_id FROM collaboration_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own presence"
  ON collaboration_participants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
  ON collaboration_participants FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- collaboration_invites
CREATE POLICY "Session owners can manage invites"
  ON collaboration_invites FOR ALL
  USING (
    session_id IN (SELECT id FROM collaboration_sessions WHERE owner_id = auth.uid())
  );

CREATE POLICY "Invitees can view and accept invites"
  ON collaboration_invites FOR SELECT
  USING (TRUE); -- Token-based access checked in application

CREATE POLICY "Service role has full access"
  ON collaboration_invites FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- collaboration_edits
CREATE POLICY "Participants can view edits"
  ON collaboration_edits FOR SELECT
  USING (
    session_id IN (SELECT session_id FROM collaboration_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role has full access"
  ON collaboration_edits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to generate share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to update presence
CREATE OR REPLACE FUNCTION update_participant_presence(
  p_session_id UUID,
  p_user_id UUID,
  p_cursor_position JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE collaboration_participants
  SET
    is_online = TRUE,
    last_seen_at = NOW(),
    cursor_position = COALESCE(p_cursor_position, cursor_position)
  WHERE session_id = p_session_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark offline (called by cleanup job)
CREATE OR REPLACE FUNCTION mark_stale_participants_offline()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE collaboration_participants
  SET is_online = FALSE
  WHERE is_online = TRUE
    AND last_seen_at < NOW() - INTERVAL '2 minutes';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
