-- Add missing columns to document_chunks table
ALTER TABLE public.document_chunks 
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS token_count INTEGER;

-- Create IVFFlat index for fast similarity search (drop if exists to recreate with proper settings)
DROP INDEX IF EXISTS document_chunks_embedding_idx;
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create index for user + conversation queries
CREATE INDEX IF NOT EXISTS document_chunks_user_conversation_idx 
  ON public.document_chunks(user_id, conversation_id);

-- Enhanced function to search similar chunks with threshold
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  p_user_id UUID,
  p_conversation_id UUID DEFAULT NULL,
  p_embedding vector(1536) DEFAULT NULL,
  p_match_count INTEGER DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  filename TEXT,
  chunk_index INTEGER,
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
    dc.chunk_index,
    (1 - (dc.embedding <=> p_embedding))::FLOAT as similarity
  FROM public.document_chunks dc
  WHERE dc.user_id = p_user_id
    AND (p_conversation_id IS NULL OR dc.conversation_id = p_conversation_id)
    AND (1 - (dc.embedding <=> p_embedding)) > p_match_threshold
  ORDER BY dc.embedding <=> p_embedding
  LIMIT p_match_count;
END;
$$;

-- Function to clear conversation documents
CREATE OR REPLACE FUNCTION public.clear_conversation_documents(
  p_user_id UUID,
  p_conversation_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.document_chunks
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;