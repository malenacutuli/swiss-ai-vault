-- Claude-style Knowledge Projects (different from VaultLab projects)
CREATE TABLE knowledge_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,  -- Project-specific system prompt
  color TEXT DEFAULT '#10b981',
  icon TEXT DEFAULT 'folder',
  is_archived BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project files (links documents to projects)
CREATE TABLE knowledge_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES knowledge_projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  chunk_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project conversations
CREATE TABLE knowledge_project_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES knowledge_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT,
  model TEXT NOT NULL,
  messages JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project memory (project-specific insights)
CREATE TABLE knowledge_project_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES knowledge_projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT,
  source_type TEXT,
  source_id UUID,
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_knowledge_projects_user ON knowledge_projects(user_id, is_archived);
CREATE INDEX idx_knowledge_project_files_project ON knowledge_project_files(project_id);
CREATE INDEX idx_knowledge_project_conversations_project ON knowledge_project_conversations(project_id);
CREATE INDEX idx_knowledge_project_memory_project ON knowledge_project_memory(project_id);

-- RLS
ALTER TABLE knowledge_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_project_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_project_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own knowledge projects" ON knowledge_projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own knowledge project files" ON knowledge_project_files
  FOR ALL USING (
    project_id IN (SELECT id FROM knowledge_projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own knowledge project conversations" ON knowledge_project_conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own knowledge project memory" ON knowledge_project_memory
  FOR ALL USING (
    project_id IN (SELECT id FROM knowledge_projects WHERE user_id = auth.uid())
  );

-- Update triggers
CREATE TRIGGER knowledge_projects_updated_at
  BEFORE UPDATE ON knowledge_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER knowledge_project_conversations_updated_at
  BEFORE UPDATE ON knowledge_project_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();