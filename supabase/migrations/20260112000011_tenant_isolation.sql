-- Organizations (tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  domain VARCHAR(255),
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  subscription_tier VARCHAR(20) DEFAULT 'free',
  max_members INTEGER DEFAULT 5,
  max_storage_gb INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain);

-- Organization members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- Organization invites
CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  token VARCHAR(64) UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON organization_invites(email);

-- Add organization_id to existing tables
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE connector_credentials ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Indexes for organization filtering
CREATE INDEX IF NOT EXISTS idx_agent_tasks_org ON agent_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_org ON prompt_templates(organization_id);

-- RLS for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Organization policies
CREATE POLICY "Members can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Owners and admins can update organizations" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

CREATE POLICY "Service role full access organizations" ON organizations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Member policies
CREATE POLICY "Members can view org members" ON organization_members
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Admins can manage members" ON organization_members
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

CREATE POLICY "Service role full access members" ON organization_members
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Invite policies
CREATE POLICY "Admins can manage invites" ON organization_invites
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

CREATE POLICY "Service role full access invites" ON organization_invites
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Update agent_tasks RLS to include organization isolation
DROP POLICY IF EXISTS "Users can view own tasks" ON agent_tasks;
CREATE POLICY "Users can view own and org tasks" ON agent_tasks
  FOR SELECT USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR,
  role VARCHAR,
  is_owner BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    om.role,
    om.role = 'owner'
  FROM organizations o
  JOIN organization_members om ON o.id = om.organization_id
  WHERE om.user_id = p_user_id AND om.is_active = TRUE AND o.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_organization_members(p_org_id UUID)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  role VARCHAR,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Check if caller is member
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid() AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT
    om.user_id,
    p.email,
    om.role,
    om.joined_at
  FROM organization_members om
  JOIN profiles p ON om.user_id = p.id
  WHERE om.organization_id = p_org_id AND om.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_organization(
  p_name VARCHAR,
  p_slug VARCHAR,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Create organization
  INSERT INTO organizations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_org_id;

  -- Add creator as owner
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner');

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION invite_to_organization(
  p_org_id UUID,
  p_email VARCHAR,
  p_role VARCHAR,
  p_invited_by UUID
)
RETURNS VARCHAR AS $$
DECLARE
  v_token VARCHAR;
BEGIN
  -- Check if inviter is admin
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_invited_by
      AND role IN ('owner', 'admin')
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Not authorized to invite members';
  END IF;

  -- Generate token
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Create invite
  INSERT INTO organization_invites (organization_id, email, role, token, invited_by, expires_at)
  VALUES (p_org_id, p_email, p_role, v_token, p_invited_by, NOW() + INTERVAL '7 days');

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION accept_organization_invite(p_token VARCHAR, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Get and validate invite
  SELECT * INTO v_invite
  FROM organization_invites
  WHERE token = p_token AND expires_at > NOW() AND accepted_at IS NULL;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  -- Add member
  INSERT INTO organization_members (organization_id, user_id, role, invited_by, invited_at)
  VALUES (v_invite.organization_id, p_user_id, v_invite.role, v_invite.invited_by, v_invite.created_at)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = TRUE;

  -- Mark invite as accepted
  UPDATE organization_invites SET accepted_at = NOW() WHERE id = v_invite.id;

  RETURN v_invite.organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
