-- Email accounts (connected Gmail/Outlook)
CREATE TABLE IF NOT EXISTS vault_mail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  profile_picture TEXT,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  sync_enabled BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  sync_cursor TEXT,
  total_emails_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email_address)
);

-- Email threads
CREATE TABLE IF NOT EXISTS vault_mail_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES vault_mail_accounts(id) ON DELETE CASCADE NOT NULL,
  thread_id TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  category TEXT CHECK (category IN ('to-respond', 'fyi', 'marketing', 'meeting-update', 'automated', 'urgent', 'uncategorized')) DEFAULT 'uncategorized',
  category_confidence DECIMAL(3,2),
  category_set_by TEXT CHECK (category_set_by IN ('ai', 'user')) DEFAULT 'ai',
  suggested_action TEXT CHECK (suggested_action IN ('reply', 'archive', 'delegate', 'schedule', 'none')),
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_trashed BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  message_count INTEGER DEFAULT 1,
  labels TEXT[],
  first_message_at TIMESTAMPTZ,
  latest_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, thread_id)
);

-- Email messages
CREATE TABLE IF NOT EXISTS vault_mail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES vault_mail_threads(id) ON DELETE CASCADE NOT NULL,
  message_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses JSONB DEFAULT '[]',
  cc_addresses JSONB DEFAULT '[]',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  sent_at TIMESTAMPTZ,
  is_sent_by_user BOOLEAN DEFAULT false,
  in_reply_to TEXT,
  attachment_count INTEGER DEFAULT 0,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(thread_id, message_id)
);

-- AI-generated drafts
CREATE TABLE IF NOT EXISTS vault_mail_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES vault_mail_accounts(id) ON DELETE SET NULL,
  thread_id UUID REFERENCES vault_mail_threads(id) ON DELETE SET NULL,
  to_addresses JSONB DEFAULT '[]',
  cc_addresses JSONB DEFAULT '[]',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  user_intent TEXT,
  ai_model TEXT,
  tone TEXT CHECK (tone IN ('professional', 'friendly', 'formal', 'casual', 'brief')) DEFAULT 'professional',
  status TEXT CHECK (status IN ('draft', 'ready', 'sent', 'discarded')) DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User writing style profile  
CREATE TABLE IF NOT EXISTS vault_mail_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  greeting_patterns JSONB DEFAULT '[]',
  closing_patterns JSONB DEFAULT '[]',
  signature TEXT,
  tone_markers JSONB DEFAULT '{}',
  common_phrases JSONB DEFAULT '[]',
  average_length INTEGER,
  samples_analyzed INTEGER DEFAULT 0,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE vault_mail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_mail_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_mail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_mail_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_mail_style_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users manage own mail accounts" ON vault_mail_accounts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own threads" ON vault_mail_threads
  FOR ALL USING (account_id IN (SELECT id FROM vault_mail_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users view own messages" ON vault_mail_messages
  FOR ALL USING (thread_id IN (
    SELECT t.id FROM vault_mail_threads t
    JOIN vault_mail_accounts a ON t.account_id = a.id
    WHERE a.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own drafts" ON vault_mail_drafts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own style" ON vault_mail_style_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_threads_account ON vault_mail_threads(account_id);
CREATE INDEX idx_threads_category ON vault_mail_threads(category);
CREATE INDEX idx_threads_latest ON vault_mail_threads(latest_message_at DESC);
CREATE INDEX idx_messages_thread ON vault_mail_messages(thread_id);