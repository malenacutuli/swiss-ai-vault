-- =============================================
-- MIGRATION 1 (ADAPTED): EXTEND EXISTING ORGANIZATION TABLES
-- SwissVault Enterprise - January 2026
-- Adds new columns while preserving existing schema
-- =============================================

-- Add new columns to existing organizations table (if they don't exist)
DO $$ 
BEGIN
  -- Add residency_region if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'residency_region') THEN
    ALTER TABLE organizations ADD COLUMN residency_region TEXT DEFAULT 'europe-west6';
  END IF;

  -- Add policy_json if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'policy_json') THEN
    ALTER TABLE organizations ADD COLUMN policy_json JSONB DEFAULT '{
      "allowed_providers": ["google"],
      "privacy_tier": "vault",
      "allow_web_search": true,
      "allow_code_execution": true,
      "allow_openai": false
    }';
  END IF;

  -- Add billing_customer_id if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_customer_id') THEN
    ALTER TABLE organizations ADD COLUMN billing_customer_id TEXT;
  END IF;
END $$;

-- Create org_role_permissions table (new)
CREATE TABLE IF NOT EXISTS org_role_permissions (
  role TEXT PRIMARY KEY,
  permissions JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO org_role_permissions (role, permissions) VALUES
  ('owner', '{"all": true, "delete_org": true, "manage_billing": true}'),
  ('admin', '{"manage_members": true, "manage_settings": true, "create_notebooks": true, "create_tasks": true, "delete_notebooks": true}'),
  ('editor', '{"create_notebooks": true, "create_tasks": true, "edit_notebooks": true, "add_sources": true}'),
  ('viewer', '{"view_notebooks": true, "view_tasks": true, "chat": true}')
ON CONFLICT (role) DO NOTHING;

-- Helper function to get user's org IDs (uses existing column name)
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM organization_members WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Update timestamp trigger (safe to recreate)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;