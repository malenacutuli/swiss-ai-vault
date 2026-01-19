-- Workspaces and Sharing for Collaboration
-- Enables multi-user workspaces with role-based permissions

-- Enable pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- WORKSPACES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Workspace details
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- emoji or icon name
  color TEXT, -- hex color

  -- Access settings
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  share_token TEXT UNIQUE,

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Limits
  max_members INTEGER DEFAULT 10,
  max_runs INTEGER DEFAULT 100,

  -- Stats
  member_count INTEGER DEFAULT 1,
  run_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_share_token ON workspaces(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspaces_visibility ON workspaces(visibility);

-- =============================================
-- WORKSPACE MEMBERS TABLE
-- =============================================

-- Roles:
-- owner: Full control, can delete workspace
-- admin: Can manage members, runs, and settings
-- editor: Can create and edit runs
-- prompter: Can send prompts to runs but not create
-- viewer: Read-only access

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'prompter', 'viewer')),

  -- Permissions (can override role defaults)
  permissions JSONB DEFAULT '{}',

  -- Invite info
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),

  -- Activity
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(workspace_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(workspace_id, role);
CREATE INDEX IF NOT EXISTS idx_workspace_members_status ON workspace_members(workspace_id, status);

-- =============================================
-- WORKSPACE INVITES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Invite details
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'prompter', 'viewer')),

  -- Token (use uuid as token source)
  invite_token TEXT UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),

  -- Creator
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Acceptance
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,

  -- Expiration
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Message
  message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_status ON workspace_invites(status);

-- =============================================
-- WORKSPACE ACTIVITY TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS workspace_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'workspace_created', 'workspace_updated', 'workspace_archived',
    'member_invited', 'member_joined', 'member_left', 'member_removed', 'member_role_changed',
    'run_created', 'run_completed', 'run_failed',
    'document_created', 'document_updated', 'document_deleted',
    'comment_added', 'mention'
  )),

  -- Target (what the activity is about)
  target_type TEXT, -- 'run', 'document', 'member', etc.
  target_id UUID,

  -- Details
  data JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace ON workspace_activity(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_user ON workspace_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_type ON workspace_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_created ON workspace_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace_recent ON workspace_activity(workspace_id, created_at DESC);

-- =============================================
-- LINK AGENT_RUNS TO WORKSPACES
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_runs' AND column_name = 'workspace_id') THEN
    ALTER TABLE agent_runs ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace ON agent_runs(workspace_id);
  END IF;
END $$;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_activity ENABLE ROW LEVEL SECURITY;

-- workspaces
CREATE POLICY "Owners have full access to workspaces"
  ON workspaces FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Members can view workspaces"
  ON workspaces FOR SELECT
  USING (
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active')
    OR visibility = 'public'
  );

CREATE POLICY "Service role full access workspaces"
  ON workspaces FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- workspace_members
CREATE POLICY "Workspace admins can manage members"
  ON workspace_members FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

CREATE POLICY "Members can view other members"
  ON workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can view their own membership"
  ON workspace_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access members"
  ON workspace_members FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- workspace_invites
CREATE POLICY "Workspace admins can manage invites"
  ON workspace_invites FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

CREATE POLICY "Anyone can view invites by token"
  ON workspace_invites FOR SELECT
  USING (TRUE); -- Token-based access checked in application

CREATE POLICY "Service role full access invites"
  ON workspace_invites FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- workspace_activity
CREATE POLICY "Members can view activity"
  ON workspace_activity FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Service role full access activity"
  ON workspace_activity FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- FUNCTIONS
-- =============================================

-- Create workspace with owner as first member
CREATE OR REPLACE FUNCTION create_workspace(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT 'private'
) RETURNS JSONB AS $$
DECLARE
  v_workspace_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Create workspace
  INSERT INTO workspaces (owner_id, name, description, visibility)
  VALUES (v_user_id, p_name, p_description, p_visibility)
  RETURNING id INTO v_workspace_id;

  -- Add owner as member
  INSERT INTO workspace_members (workspace_id, user_id, role, status, accepted_at)
  VALUES (v_workspace_id, v_user_id, 'owner', 'active', NOW());

  -- Log activity
  INSERT INTO workspace_activity (workspace_id, user_id, activity_type)
  VALUES (v_workspace_id, v_user_id, 'workspace_created');

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', v_workspace_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invite member to workspace
CREATE OR REPLACE FUNCTION invite_workspace_member(
  p_workspace_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'viewer',
  p_message TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_invite_id UUID;
  v_invite_token TEXT;
BEGIN
  -- Check user has permission
  SELECT role INTO v_user_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = v_user_id AND status = 'active';

  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Create invite
  INSERT INTO workspace_invites (workspace_id, email, role, created_by, message)
  VALUES (p_workspace_id, p_email, p_role, v_user_id, p_message)
  RETURNING id, invite_token INTO v_invite_id, v_invite_token;

  -- Log activity
  INSERT INTO workspace_activity (workspace_id, user_id, activity_type, data)
  VALUES (p_workspace_id, v_user_id, 'member_invited', jsonb_build_object('email', p_email, 'role', p_role));

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'invite_token', v_invite_token
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept workspace invite
CREATE OR REPLACE FUNCTION accept_workspace_invite(
  p_invite_token TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get invite
  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE invite_token = p_invite_token AND status = 'pending' AND expires_at > NOW();

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Update invite
  UPDATE workspace_invites
  SET status = 'accepted', accepted_by = v_user_id, accepted_at = NOW()
  WHERE id = v_invite.id;

  -- Add member
  INSERT INTO workspace_members (workspace_id, user_id, role, invited_by, status, accepted_at)
  VALUES (v_invite.workspace_id, v_user_id, v_invite.role, v_invite.created_by, 'active', NOW())
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = 'active',
    accepted_at = NOW();

  -- Update member count
  UPDATE workspaces
  SET member_count = (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = v_invite.workspace_id AND status = 'active')
  WHERE id = v_invite.workspace_id;

  -- Log activity
  INSERT INTO workspace_activity (workspace_id, user_id, activity_type, data)
  VALUES (v_invite.workspace_id, v_user_id, 'member_joined', jsonb_build_object('role', v_invite.role));

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', v_invite.workspace_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update member role
CREATE OR REPLACE FUNCTION update_workspace_member_role(
  p_workspace_id UUID,
  p_member_user_id UUID,
  p_new_role TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_member_current_role TEXT;
BEGIN
  -- Check user has permission
  SELECT role INTO v_user_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = v_user_id AND status = 'active';

  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Can't change owner role
  SELECT role INTO v_member_current_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_member_user_id;

  IF v_member_current_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change owner role');
  END IF;

  -- Admins can't promote to owner
  IF v_user_role = 'admin' AND p_new_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only owner can transfer ownership');
  END IF;

  -- Update role
  UPDATE workspace_members
  SET role = p_new_role, updated_at = NOW()
  WHERE workspace_id = p_workspace_id AND user_id = p_member_user_id;

  -- Log activity
  INSERT INTO workspace_activity (workspace_id, user_id, activity_type, target_type, target_id, data)
  VALUES (p_workspace_id, v_user_id, 'member_role_changed', 'member', p_member_user_id,
    jsonb_build_object('from_role', v_member_current_role, 'to_role', p_new_role));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove member from workspace
CREATE OR REPLACE FUNCTION remove_workspace_member(
  p_workspace_id UUID,
  p_member_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_member_role TEXT;
BEGIN
  -- Check user has permission or is removing themselves
  SELECT role INTO v_user_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = v_user_id AND status = 'active';

  IF v_user_id != p_member_user_id AND (v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Can't remove owner
  SELECT role INTO v_member_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_member_user_id;

  IF v_member_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove workspace owner');
  END IF;

  -- Remove member
  UPDATE workspace_members
  SET status = 'removed', updated_at = NOW()
  WHERE workspace_id = p_workspace_id AND user_id = p_member_user_id;

  -- Update member count
  UPDATE workspaces
  SET member_count = (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = p_workspace_id AND status = 'active')
  WHERE id = p_workspace_id;

  -- Log activity
  INSERT INTO workspace_activity (workspace_id, user_id, activity_type, target_type, target_id)
  VALUES (p_workspace_id, v_user_id,
    CASE WHEN v_user_id = p_member_user_id THEN 'member_left' ELSE 'member_removed' END,
    'member', p_member_user_id);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get workspace activity feed
CREATE OR REPLACE FUNCTION get_workspace_activity(
  p_workspace_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_activities JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'activity_type', a.activity_type,
      'user_id', a.user_id,
      'target_type', a.target_type,
      'target_id', a.target_id,
      'data', a.data,
      'created_at', a.created_at
    ) ORDER BY a.created_at DESC
  ) INTO v_activities
  FROM (
    SELECT *
    FROM workspace_activity
    WHERE workspace_id = p_workspace_id
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) a;

  RETURN COALESCE(v_activities, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Check user permission in workspace
CREATE OR REPLACE FUNCTION check_workspace_permission(
  p_workspace_id UUID,
  p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = v_user_id AND status = 'active';

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Permission matrix
  RETURN CASE p_permission
    WHEN 'view' THEN TRUE
    WHEN 'prompt' THEN v_role IN ('owner', 'admin', 'editor', 'prompter')
    WHEN 'edit' THEN v_role IN ('owner', 'admin', 'editor')
    WHEN 'create_run' THEN v_role IN ('owner', 'admin', 'editor')
    WHEN 'manage_members' THEN v_role IN ('owner', 'admin')
    WHEN 'manage_settings' THEN v_role IN ('owner', 'admin')
    WHEN 'delete' THEN v_role = 'owner'
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE workspaces IS 'Collaborative workspaces for team projects';
COMMENT ON TABLE workspace_members IS 'Workspace membership with role-based access';
COMMENT ON TABLE workspace_invites IS 'Pending invitations to workspaces';
COMMENT ON TABLE workspace_activity IS 'Activity feed for workspace events';
COMMENT ON FUNCTION create_workspace(TEXT, TEXT, TEXT) IS 'Create a new workspace with the current user as owner';
COMMENT ON FUNCTION invite_workspace_member(UUID, TEXT, TEXT, TEXT) IS 'Invite a user to a workspace by email';
COMMENT ON FUNCTION accept_workspace_invite(TEXT) IS 'Accept a workspace invitation by token';
