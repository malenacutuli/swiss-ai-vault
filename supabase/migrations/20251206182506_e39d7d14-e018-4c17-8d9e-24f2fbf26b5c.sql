-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document chunks table
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID,
  filename TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for similarity search
CREATE INDEX idx_document_chunks_embedding ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS policies
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chunks"
  ON document_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunks"
  ON document_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks"
  ON document_chunks FOR DELETE
  USING (auth.uid() = user_id);

-- Function to search similar chunks
CREATE OR REPLACE FUNCTION search_similar_chunks(
  p_user_id UUID,
  p_embedding vector(1536),
  p_limit INTEGER DEFAULT 5,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  filename TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.content,
    dc.filename,
    1 - (dc.embedding <=> p_embedding) as similarity
  FROM document_chunks dc
  WHERE dc.user_id = p_user_id
    AND (p_conversation_id IS NULL OR dc.conversation_id = p_conversation_id)
  ORDER BY dc.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;