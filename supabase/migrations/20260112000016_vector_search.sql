-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_document_chunks_user ON document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_org ON document_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON document_chunks(document_id);

-- RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chunks" ON document_chunks
  FOR SELECT USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "Service role full access chunks" ON document_chunks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Similarity search function
CREATE OR REPLACE FUNCTION search_documents(
  p_query_embedding vector(1536),
  p_user_id UUID,
  p_org_id UUID DEFAULT NULL,
  p_match_count INTEGER DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> p_query_embedding) as similarity,
    dc.metadata
  FROM document_chunks dc
  WHERE (dc.user_id = p_user_id OR dc.organization_id = p_org_id)
    AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Chunk document function
CREATE OR REPLACE FUNCTION chunk_document(
  p_document_id UUID,
  p_content TEXT,
  p_chunk_size INTEGER DEFAULT 1000,
  p_chunk_overlap INTEGER DEFAULT 200
)
RETURNS INTEGER AS $$
DECLARE
  v_chunks TEXT[];
  v_chunk TEXT;
  v_start INTEGER := 1;
  v_end INTEGER;
  v_index INTEGER := 0;
  v_doc RECORD;
BEGIN
  -- Get document info
  SELECT user_id, organization_id INTO v_doc FROM documents WHERE id = p_document_id;

  -- Delete existing chunks
  DELETE FROM document_chunks WHERE document_id = p_document_id;

  -- Create chunks with overlap
  WHILE v_start <= length(p_content) LOOP
    v_end := LEAST(v_start + p_chunk_size - 1, length(p_content));

    -- Try to break at sentence boundary
    IF v_end < length(p_content) THEN
      v_end := GREATEST(
        v_end,
        COALESCE(
          NULLIF(GREATEST(
            position('.' IN reverse(substring(p_content FROM v_start FOR p_chunk_size))),
            position('?' IN reverse(substring(p_content FROM v_start FOR p_chunk_size))),
            position('!' IN reverse(substring(p_content FROM v_start FOR p_chunk_size)))
          ), 0),
          p_chunk_size
        )
      );
    END IF;

    v_chunk := substring(p_content FROM v_start FOR v_end - v_start + 1);

    INSERT INTO document_chunks (document_id, user_id, organization_id, chunk_index, content, token_count)
    VALUES (p_document_id, v_doc.user_id, v_doc.organization_id, v_index, v_chunk, length(v_chunk) / 4);

    v_index := v_index + 1;
    v_start := v_end - p_chunk_overlap + 1;
  END LOOP;

  RETURN v_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
