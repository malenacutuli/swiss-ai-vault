-- Function to create a VaultChat-only test user
CREATE OR REPLACE FUNCTION setup_vaultchat_only_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update user settings with VaultChat-only access
  INSERT INTO user_settings (user_id, account_type, feature_access)
  VALUES (
    target_user_id,
    'vaultchat_only',
    '{
      "dashboard": false,
      "projects": false,
      "datasets": false,
      "fine_tuning": false,
      "templates": false,
      "evaluations": false,
      "models": false,
      "catalog": false,
      "playground": false,
      "vault_chat": true,
      "traces": false,
      "usage_stats": false,
      "compliance": false,
      "settings": true,
      "deep_research": true
    }'::jsonb
  )
  ON CONFLICT (user_id) DO UPDATE SET
    account_type = 'vaultchat_only',
    feature_access = '{
      "dashboard": false,
      "projects": false,
      "datasets": false,
      "fine_tuning": false,
      "templates": false,
      "evaluations": false,
      "models": false,
      "catalog": false,
      "playground": false,
      "vault_chat": true,
      "traces": false,
      "usage_stats": false,
      "compliance": false,
      "settings": true,
      "deep_research": true
    }'::jsonb,
    updated_at = NOW();
END;
$$;