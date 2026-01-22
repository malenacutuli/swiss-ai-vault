-- =============================================
-- DIRECT PROJECT MIGRATION
-- Consolidated schema for SwissVault.ai Direct Project (ghmmdochvlrnwbruyrqk)
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUM TYPES
-- =============================================

DO $$ BEGIN
  CREATE TYPE agent_run_status AS ENUM (
    'created', 'queued', 'planning', 'executing',
    'waiting_user', 'paused', 'completed', 'failed', 'cancelled', 'timeout'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agent_step_status AS ENUM (
    'pending', 'running', 'completed', 'failed', 'skipped', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tool_type AS ENUM (
    'shell', 'code', 'browser', 'file_read', 'file_write',
    'search', 'message', 'plan', 'generate', 'slides', 'connector', 'wide_research'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agent_mode AS ENUM (
    'chat', 'research', 'slides', 'website', 'document',
    'spreadsheet', 'image', 'video', 'audio', 'code', 'data_analysis', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 1. AGENT RUNS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  workspace_id UUID,

  -- Task definition
  prompt TEXT NOT NULL,
  mode agent_mode NOT NULL DEFAULT 'chat',
  task_type TEXT,
  config JSONB DEFAULT '{}',

  -- Status tracking
  status agent_run_status NOT NULL DEFAULT 'created',
  current_step_id UUID,

  -- Planning
  plan JSONB,
  plan_version INTEGER DEFAULT 1,

  -- Execution metrics
  total_steps INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  failed_steps INTEGER DEFAULT 0,

  -- Cost tracking
  total_tokens_used BIGINT DEFAULT 0,
  total_credits_used DECIMAL(10,4) DEFAULT 0,
  estimated_credits DECIMAL(10,4),
  credits_charged BIGINT DEFAULT 0,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,

  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_id ON agent_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_mode ON agent_runs(mode);

-- =============================================
-- 2. AGENT STEPS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES agent_steps(id),

  step_number INTEGER NOT NULL,
  tool_type tool_type NOT NULL,
  tool_name TEXT NOT NULL,
  tool_input JSONB NOT NULL DEFAULT '{}',

  status agent_step_status NOT NULL DEFAULT 'pending',
  tool_output JSONB,
  output_text TEXT,

  tokens_used INTEGER DEFAULT 0,
  credits_used DECIMAL(10,4) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,

  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_agent_steps_run_id ON agent_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_status ON agent_steps(status);

-- =============================================
-- 3. AGENT MESSAGES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_id UUID REFERENCES agent_steps(id) ON DELETE SET NULL,

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,

  tool_call_id TEXT,
  tool_name TEXT,
  attachments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_run_id ON agent_messages(run_id);

-- =============================================
-- 4. WORKSPACES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,

  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,

  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  share_token TEXT UNIQUE,
  settings JSONB DEFAULT '{}',

  max_members INTEGER DEFAULT 10,
  max_runs INTEGER DEFAULT 100,
  member_count INTEGER DEFAULT 1,
  run_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_share_token ON workspaces(share_token) WHERE share_token IS NOT NULL;

-- =============================================
-- 5. WORKSPACE MEMBERS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'prompter', 'viewer')),
  permissions JSONB DEFAULT '{}',

  invited_by UUID,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- =============================================
-- 6. WORKSPACE INVITES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'prompter', 'viewer')),

  invite_token TEXT UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),

  created_by UUID NOT NULL,
  accepted_by UUID,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(invite_token);

-- =============================================
-- 7. WORKSPACE ACTIVITY TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS workspace_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID,

  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'workspace_created', 'workspace_updated', 'workspace_archived',
    'member_invited', 'member_joined', 'member_left', 'member_removed', 'member_role_changed',
    'run_created', 'run_completed', 'run_failed',
    'document_created', 'document_updated', 'document_deleted',
    'comment_added', 'mention'
  )),

  target_type TEXT,
  target_id UUID,
  data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace ON workspace_activity(workspace_id);

-- =============================================
-- 8. CUSTOM AGENTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS custom_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  avatar_url TEXT,

  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'claude-3-5-sonnet',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,

  enabled_tools TEXT[] DEFAULT '{}',
  tool_config JSONB DEFAULT '{}',

  context_instructions TEXT,
  memory_enabled BOOLEAN DEFAULT TRUE,
  memory_window INTEGER DEFAULT 20,

  input_schema JSONB,
  output_schema JSONB,
  output_format TEXT DEFAULT 'text',

  starter_prompts TEXT[] DEFAULT '{}',

  can_search_web BOOLEAN DEFAULT TRUE,
  can_execute_code BOOLEAN DEFAULT FALSE,
  can_browse_web BOOLEAN DEFAULT FALSE,
  can_generate_images BOOLEAN DEFAULT FALSE,
  can_access_files BOOLEAN DEFAULT FALSE,

  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'workspace', 'public')),
  is_featured BOOLEAN DEFAULT FALSE,
  share_token TEXT UNIQUE,

  run_count INTEGER DEFAULT 0,
  avg_satisfaction DECIMAL(3,2),
  last_used_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  UNIQUE(user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_custom_agents_user ON custom_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_agents_workspace ON custom_agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_agents_status ON custom_agents(status);

-- =============================================
-- 9. CUSTOM AGENT VERSIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS custom_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES custom_agents(id) ON DELETE CASCADE,

  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  system_prompt TEXT NOT NULL,
  model TEXT,
  temperature DECIMAL(3,2),
  enabled_tools TEXT[],
  tool_config JSONB,
  context_instructions TEXT,

  change_summary TEXT,
  changed_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON custom_agent_versions(agent_id);

-- =============================================
-- 10. AGENT TEMPLATES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,

  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'claude-3-5-sonnet',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  enabled_tools TEXT[] DEFAULT '{}',
  tool_config JSONB DEFAULT '{}',
  context_instructions TEXT,
  starter_prompts TEXT[] DEFAULT '{}',

  can_search_web BOOLEAN DEFAULT TRUE,
  can_execute_code BOOLEAN DEFAULT FALSE,
  can_browse_web BOOLEAN DEFAULT FALSE,

  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 100,

  use_count INTEGER DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_templates_slug ON agent_templates(slug);
CREATE INDEX IF NOT EXISTS idx_agent_templates_category ON agent_templates(category);

-- =============================================
-- 11. BILLING ACCOUNTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  org_id UUID,

  balance BIGINT DEFAULT 0,
  reserved_balance BIGINT DEFAULT 0,

  spending_limit BIGINT,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  rate_limit_per_day INTEGER DEFAULT 10000,

  plan_type TEXT DEFAULT 'free',
  plan_credits_monthly BIGINT DEFAULT 10000000,
  plan_reset_at TIMESTAMPTZ,

  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_user ON billing_accounts(user_id);

-- =============================================
-- 12. BILLING LEDGER TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES billing_accounts(id) ON DELETE CASCADE,
  user_id UUID,
  run_id UUID,

  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'charge', 'refund', 'purchase', 'bonus', 'plan_credit', 'adjustment'
  )),
  credits_amount BIGINT NOT NULL,

  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,

  description TEXT,
  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_ledger_account ON billing_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_run ON billing_ledger(run_id);

-- =============================================
-- 13. CREDIT RESERVATIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES billing_accounts(id),
  user_id UUID,
  run_id UUID UNIQUE,

  credits_reserved BIGINT DEFAULT 0,
  credits_charged BIGINT DEFAULT 0,
  credits_refunded BIGINT DEFAULT 0,

  status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'partial', 'charged', 'refunded', 'expired')),

  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  charged_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_run ON credit_reservations(run_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_account ON credit_reservations(account_id);

-- =============================================
-- 14. CREDIT PRICING TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS credit_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT UNIQUE NOT NULL,

  base_cost BIGINT DEFAULT 1000,
  cost_per_token BIGINT DEFAULT 1,
  cost_per_second BIGINT DEFAULT 10,
  cost_per_step BIGINT DEFAULT 100,

  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing
INSERT INTO credit_pricing (task_type, base_cost, cost_per_token, cost_per_second, cost_per_step, description, is_active)
VALUES
  ('chat', 500, 1, 5, 50, 'Standard chat interaction', TRUE),
  ('research', 2000, 2, 10, 100, 'Deep research tasks', TRUE),
  ('code', 1500, 1, 8, 75, 'Code generation and execution', TRUE),
  ('slides', 3000, 2, 15, 150, 'Presentation creation', TRUE),
  ('document', 2500, 2, 12, 125, 'Document generation', TRUE)
ON CONFLICT (task_type) DO NOTHING;

-- =============================================
-- 15. RUN CHECKPOINTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS run_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_id UUID REFERENCES agent_steps(id),

  checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN (
    'auto', 'manual', 'milestone', 'rollback_point'
  )),

  label TEXT,
  description TEXT,

  state_snapshot JSONB NOT NULL DEFAULT '{}',
  step_number INTEGER NOT NULL,

  is_active BOOLEAN DEFAULT TRUE,
  restored_from_id UUID REFERENCES run_checkpoints(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_run_checkpoints_run ON run_checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_run_checkpoints_step ON run_checkpoints(step_id);

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_checkpoints ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - SERVICE ROLE ACCESS
-- =============================================

-- Service role needs full access to all tables for edge functions
CREATE POLICY "Service role full access agent_runs" ON agent_runs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access agent_steps" ON agent_steps FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access agent_messages" ON agent_messages FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access workspaces" ON workspaces FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access workspace_members" ON workspace_members FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access workspace_invites" ON workspace_invites FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access workspace_activity" ON workspace_activity FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access custom_agents" ON custom_agents FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access custom_agent_versions" ON custom_agent_versions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access agent_templates" ON agent_templates FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access billing_accounts" ON billing_accounts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access billing_ledger" ON billing_ledger FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access credit_reservations" ON credit_reservations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access credit_pricing" ON credit_pricing FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access run_checkpoints" ON run_checkpoints FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- WORKSPACE FUNCTIONS
-- =============================================

-- Create workspace with owner as first member
CREATE OR REPLACE FUNCTION create_workspace(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT 'private'
) RETURNS JSONB AS $$
DECLARE
  v_workspace_id UUID;
  v_user_id UUID;
BEGIN
  -- Get user_id from the JWT (set by service role)
  v_user_id := COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user_id', true)
  )::UUID;

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
  v_user_id UUID;
  v_user_role TEXT;
  v_invite_id UUID;
  v_invite_token TEXT;
BEGIN
  v_user_id := COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user_id', true)
  )::UUID;

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
  v_user_id UUID;
  v_invite RECORD;
BEGIN
  v_user_id := COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user_id', true)
  )::UUID;

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
  v_user_id UUID;
  v_user_role TEXT;
  v_member_current_role TEXT;
BEGIN
  v_user_id := COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user_id', true)
  )::UUID;

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
  v_user_id UUID;
  v_user_role TEXT;
  v_member_role TEXT;
BEGIN
  v_user_id := COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user_id', true)
  )::UUID;

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
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user_id', true)
  )::UUID;

  SELECT role INTO v_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = v_user_id AND status = 'active';

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

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

-- =============================================
-- BILLING FUNCTIONS
-- =============================================

-- Get or create billing account for user
CREATE OR REPLACE FUNCTION get_or_create_billing_account(p_user_id UUID)
RETURNS billing_accounts AS $$
DECLARE
  v_account billing_accounts;
BEGIN
  SELECT * INTO v_account FROM billing_accounts WHERE user_id = p_user_id;

  IF v_account IS NULL THEN
    INSERT INTO billing_accounts (user_id, balance, plan_type, plan_reset_at)
    VALUES (p_user_id, 10000000, 'free', DATE_TRUNC('month', NOW()) + INTERVAL '1 month')
    RETURNING * INTO v_account;
  END IF;

  RETURN v_account;
END;
$$ LANGUAGE plpgsql;

-- Reserve credits for a run
CREATE OR REPLACE FUNCTION reserve_credits(
  p_user_id UUID,
  p_run_id UUID,
  p_task_type TEXT,
  p_estimated_tokens INTEGER DEFAULT 1000
) RETURNS JSONB AS $$
DECLARE
  v_account billing_accounts;
  v_base_cost BIGINT := 1000;
  v_cost_per_token BIGINT := 1;
  v_credits_needed BIGINT;
  v_reservation credit_reservations;
BEGIN
  -- Get account
  v_account := get_or_create_billing_account(p_user_id);

  -- Check if active
  IF NOT v_account.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  -- Try to get pricing for task type
  SELECT base_cost, cost_per_token INTO v_base_cost, v_cost_per_token
  FROM credit_pricing WHERE task_type = p_task_type AND is_active = TRUE
  LIMIT 1;

  -- Calculate estimated credits
  v_credits_needed := COALESCE(v_base_cost, 1000) + (p_estimated_tokens * COALESCE(v_cost_per_token, 1));

  -- Check balance
  IF (v_account.balance - v_account.reserved_balance) < v_credits_needed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'balance', v_account.balance,
      'reserved', v_account.reserved_balance,
      'needed', v_credits_needed
    );
  END IF;

  -- Create reservation
  INSERT INTO credit_reservations (account_id, run_id, user_id, credits_reserved, expires_at)
  VALUES (v_account.id, p_run_id, p_user_id, v_credits_needed, NOW() + INTERVAL '1 hour')
  ON CONFLICT (run_id) DO UPDATE SET
    credits_reserved = EXCLUDED.credits_reserved,
    status = 'reserved',
    expires_at = EXCLUDED.expires_at
  RETURNING * INTO v_reservation;

  -- Update reserved balance
  UPDATE billing_accounts
  SET reserved_balance = reserved_balance + v_credits_needed
  WHERE id = v_account.id;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation.id,
    'credits_reserved', v_credits_needed,
    'balance_remaining', v_account.balance - v_account.reserved_balance - v_credits_needed
  );
END;
$$ LANGUAGE plpgsql;

-- Charge credits for a completed run
CREATE OR REPLACE FUNCTION charge_credits(
  p_run_id UUID,
  p_actual_tokens INTEGER DEFAULT 0,
  p_execution_seconds INTEGER DEFAULT 0,
  p_step_count INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_reservation credit_reservations;
  v_account billing_accounts;
  v_base_cost BIGINT := 1000;
  v_cost_per_token BIGINT := 1;
  v_cost_per_second BIGINT := 10;
  v_cost_per_step BIGINT := 100;
  v_actual_cost BIGINT;
  v_refund_amount BIGINT;
  v_task_type TEXT;
BEGIN
  -- Get reservation
  SELECT * INTO v_reservation FROM credit_reservations WHERE run_id = p_run_id;
  IF v_reservation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No reservation found');
  END IF;

  IF v_reservation.status NOT IN ('reserved', 'partial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation already processed');
  END IF;

  -- Get account
  SELECT * INTO v_account FROM billing_accounts WHERE id = v_reservation.account_id;

  -- Get task type from run
  SELECT task_type INTO v_task_type FROM agent_runs WHERE id = p_run_id;

  -- Try to get pricing
  SELECT base_cost, cost_per_token, cost_per_second, cost_per_step
  INTO v_base_cost, v_cost_per_token, v_cost_per_second, v_cost_per_step
  FROM credit_pricing WHERE task_type = v_task_type AND is_active = TRUE
  LIMIT 1;

  -- Calculate actual cost
  v_actual_cost := COALESCE(v_base_cost, 1000)
    + (p_actual_tokens * COALESCE(v_cost_per_token, 1))
    + (p_execution_seconds * COALESCE(v_cost_per_second, 10))
    + (p_step_count * COALESCE(v_cost_per_step, 100));

  -- Cap at reserved amount
  IF v_actual_cost > v_reservation.credits_reserved THEN
    v_actual_cost := v_reservation.credits_reserved;
  END IF;

  -- Calculate refund
  v_refund_amount := v_reservation.credits_reserved - v_actual_cost;

  -- Update account balance
  UPDATE billing_accounts
  SET
    balance = balance - v_actual_cost,
    reserved_balance = reserved_balance - v_reservation.credits_reserved,
    updated_at = NOW()
  WHERE id = v_account.id;

  -- Update reservation
  UPDATE credit_reservations
  SET
    credits_charged = v_actual_cost,
    credits_refunded = v_refund_amount,
    status = 'charged',
    charged_at = NOW()
  WHERE id = v_reservation.id;

  -- Record in ledger
  INSERT INTO billing_ledger (account_id, user_id, run_id, transaction_type, credits_amount, balance_before, balance_after, description, metadata)
  VALUES (
    v_account.id,
    v_reservation.user_id,
    p_run_id,
    'charge',
    -v_actual_cost,
    v_account.balance,
    v_account.balance - v_actual_cost,
    format('Charge for %s run', COALESCE(v_task_type, 'unknown')),
    jsonb_build_object(
      'tokens', p_actual_tokens,
      'seconds', p_execution_seconds,
      'steps', p_step_count,
      'reserved', v_reservation.credits_reserved,
      'refunded', v_refund_amount
    )
  );

  -- Update run with credits charged
  UPDATE agent_runs SET credits_charged = v_actual_cost WHERE id = p_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'credits_charged', v_actual_cost,
    'credits_refunded', v_refund_amount,
    'new_balance', v_account.balance - v_actual_cost
  );
END;
$$ LANGUAGE plpgsql;

-- Refund credits for a failed/cancelled run
CREATE OR REPLACE FUNCTION refund_credits(p_run_id UUID, p_reason TEXT DEFAULT 'run_failed')
RETURNS JSONB AS $$
DECLARE
  v_reservation credit_reservations;
  v_account billing_accounts;
BEGIN
  -- Get reservation
  SELECT * INTO v_reservation FROM credit_reservations WHERE run_id = p_run_id;
  IF v_reservation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No reservation found');
  END IF;

  IF v_reservation.status NOT IN ('reserved', 'partial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation already processed');
  END IF;

  -- Get account
  SELECT * INTO v_account FROM billing_accounts WHERE id = v_reservation.account_id;

  -- Release reserved credits
  UPDATE billing_accounts
  SET
    reserved_balance = reserved_balance - v_reservation.credits_reserved,
    updated_at = NOW()
  WHERE id = v_account.id;

  -- Update reservation
  UPDATE credit_reservations
  SET
    credits_refunded = v_reservation.credits_reserved - COALESCE(v_reservation.credits_charged, 0),
    status = 'refunded',
    refunded_at = NOW()
  WHERE id = v_reservation.id;

  -- Record in ledger if any credits were charged
  IF COALESCE(v_reservation.credits_charged, 0) > 0 THEN
    INSERT INTO billing_ledger (account_id, user_id, run_id, transaction_type, credits_amount, balance_before, balance_after, description)
    VALUES (
      v_account.id,
      v_reservation.user_id,
      p_run_id,
      'refund',
      v_reservation.credits_charged,
      v_account.balance,
      v_account.balance + v_reservation.credits_charged,
      format('Refund: %s', p_reason)
    );

    UPDATE billing_accounts SET balance = balance + v_reservation.credits_charged WHERE id = v_account.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'credits_refunded', v_reservation.credits_reserved - COALESCE(v_reservation.credits_charged, 0),
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SEED AGENT TEMPLATES
-- =============================================

INSERT INTO agent_templates (name, slug, description, icon, category, system_prompt, model, enabled_tools, starter_prompts, display_order, status)
VALUES
  ('Research Assistant', 'research-assistant', 'Comprehensive research with citations', 'search', 'Research',
   'You are a thorough research assistant. Provide well-sourced answers with citations. Use web search to find current information.',
   'claude-3-5-sonnet', ARRAY['deep_research', 'search_web'], ARRAY['Research the latest trends in...', 'Find academic papers about...'], 10, 'active'),

  ('Code Helper', 'code-helper', 'Debug and write code', 'code', 'Development',
   'You are a coding assistant. Help debug code, write functions, and explain programming concepts. Provide working code examples.',
   'claude-3-5-sonnet', ARRAY['code_execution'], ARRAY['Help me debug this code...', 'Write a function that...'], 20, 'active'),

  ('Document Writer', 'document-writer', 'Create professional documents', 'file-text', 'Productivity',
   'You are a professional writer. Create clear, well-structured documents, reports, and proposals.',
   'claude-3-5-sonnet', ARRAY['generate_document'], ARRAY['Write a report about...', 'Create a proposal for...'], 30, 'active'),

  ('Data Analyst', 'data-analyst', 'Analyze data and create visualizations', 'bar-chart', 'Analytics',
   'You are a data analyst. Analyze datasets, identify trends, and create insightful visualizations.',
   'claude-3-5-sonnet', ARRAY['code_execution', 'data_analysis'], ARRAY['Analyze this dataset...', 'Create a visualization for...'], 40, 'active'),

  ('Presentation Creator', 'presentation-creator', 'Build engaging presentations', 'presentation', 'Productivity',
   'You are a presentation expert. Create engaging slide decks with clear messaging and visual appeal.',
   'claude-3-5-sonnet', ARRAY['slides', 'generate_images'], ARRAY['Create a presentation about...', 'Make slides for my pitch on...'], 50, 'active')
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- DONE
-- =============================================

SELECT 'Migration completed successfully!' as status;
