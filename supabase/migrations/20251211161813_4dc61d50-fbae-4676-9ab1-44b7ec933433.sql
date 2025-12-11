-- Add columns to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS feature_access JSONB DEFAULT '{
  "dashboard": true, "projects": true, "datasets": true,
  "fine_tuning": true, "templates": true, "evaluations": true,
  "models": true, "catalog": true, "playground": true,
  "vault_chat": true, "traces": true, "usage_stats": true,
  "compliance": true, "settings": true, "deep_research": true
}'::jsonb;

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'standard';

-- Add beta_tester tier to research_quotas
INSERT INTO research_quotas (tier, monthly_queries, models_allowed, deep_research_enabled)
VALUES ('beta_tester', 20, ARRAY['sonar', 'sonar-reasoning-pro'], true)
ON CONFLICT (tier) DO NOTHING;

-- Create helper function for setting up vaultchat-only users
CREATE OR REPLACE FUNCTION public.setup_vaultchat_only_user(target_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO user_settings (user_id, account_type, feature_access)
  VALUES (target_user_id, 'vaultchat_only', '{
    "dashboard": false, "projects": false, "datasets": false,
    "fine_tuning": false, "templates": false, "evaluations": false,
    "models": false, "catalog": false, "playground": false,
    "vault_chat": true, "traces": false, "usage_stats": false,
    "compliance": false, "settings": true, "deep_research": true
  }'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET
    account_type = 'vaultchat_only',
    feature_access = EXCLUDED.feature_access,
    updated_at = NOW();
END;
$$;