-- Add feature access control to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS feature_access JSONB DEFAULT '{
  "dashboard": true,
  "projects": true,
  "datasets": true,
  "fine_tuning": true,
  "templates": true,
  "evaluations": true,
  "models": true,
  "catalog": true,
  "playground": true,
  "vault_chat": true,
  "traces": true,
  "usage_stats": true,
  "compliance": true,
  "settings": true,
  "deep_research": true
}'::jsonb;

-- Add account_type for easy filtering
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'standard' 
CHECK (account_type IN ('standard', 'beta_tester', 'demo', 'vaultchat_only'));

-- Create index for querying
CREATE INDEX IF NOT EXISTS idx_user_settings_account_type 
ON user_settings(account_type);