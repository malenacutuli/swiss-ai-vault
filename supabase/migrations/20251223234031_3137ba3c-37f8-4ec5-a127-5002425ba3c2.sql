-- ==============================================
-- FIX 3: Create ghost_folders table
-- ==============================================

CREATE TABLE IF NOT EXISTS ghost_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'New Folder',
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_ghost_folders_user ON ghost_folders(user_id);

-- RLS
ALTER TABLE ghost_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own folders" ON ghost_folders
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_ghost_folders_updated_at
  BEFORE UPDATE ON ghost_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();