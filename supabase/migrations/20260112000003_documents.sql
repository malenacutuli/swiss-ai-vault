-- supabase/migrations/20260112000003_documents.sql
-- SwissBrain Real-time Collaboration - Documents

-- ============================================================================
-- Documents Table for real-time collaboration
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  document_type TEXT DEFAULT 'text' CHECK (document_type IN ('text', 'markdown', 'code', 'canvas')),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- Document Collaborators
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id),
  UNIQUE(document_id, user_id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_doc ON document_collaborators(document_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_user ON document_collaborators(user_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_collaborators ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
DROP POLICY IF EXISTS "Owners have full access" ON documents;
CREATE POLICY "Owners have full access" ON documents
  FOR ALL USING (auth.uid() = owner_id);

-- Collaborators can view
DROP POLICY IF EXISTS "Collaborators can view" ON documents;
CREATE POLICY "Collaborators can view" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM document_collaborators
      WHERE document_id = id AND user_id = auth.uid()
    )
  );

-- Editors can update
DROP POLICY IF EXISTS "Editors can update" ON documents;
CREATE POLICY "Editors can update" ON documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM document_collaborators
      WHERE document_id = id AND user_id = auth.uid() AND role IN ('editor', 'admin')
    )
  );

-- Public documents
DROP POLICY IF EXISTS "Public documents are viewable" ON documents;
CREATE POLICY "Public documents are viewable" ON documents
  FOR SELECT USING (is_public = true);

-- Collaborator policies
DROP POLICY IF EXISTS "Users can view own collaborations" ON document_collaborators;
CREATE POLICY "Users can view own collaborations" ON document_collaborators
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Document owners can manage collaborators" ON document_collaborators;
CREATE POLICY "Document owners can manage collaborators" ON document_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM documents WHERE id = document_id AND owner_id = auth.uid()
    )
  );

-- Service role access
DROP POLICY IF EXISTS "Service role full access to documents" ON documents;
CREATE POLICY "Service role full access to documents" ON documents
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to collaborators" ON document_collaborators;
CREATE POLICY "Service role full access to collaborators" ON document_collaborators
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Enable Realtime for documents table
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE documents;
