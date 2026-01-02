-- Semantic cache table for AI response caching
CREATE TABLE IF NOT EXISTS public.semantic_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  embedding vector(768),
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast vector similarity search
CREATE INDEX IF NOT EXISTS semantic_cache_embedding_idx 
  ON public.semantic_cache USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for hash lookups
CREATE INDEX IF NOT EXISTS semantic_cache_hash_idx ON public.semantic_cache(prompt_hash);

-- Function to find semantically similar prompts
CREATE OR REPLACE FUNCTION public.match_semantic_cache(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.92,
  match_count int DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  prompt TEXT,
  response TEXT,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.prompt,
    sc.response,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM public.semantic_cache sc
  WHERE 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Usage stats table for monitoring
CREATE TABLE IF NOT EXISTS public.inference_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  cache_tier TEXT,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  user_id UUID,
  success BOOLEAN DEFAULT true
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS inference_stats_time_idx ON public.inference_stats(timestamp DESC);
CREATE INDEX IF NOT EXISTS inference_stats_model_idx ON public.inference_stats(model, provider);

-- RLS policies for semantic_cache (service role only - internal cache)
ALTER TABLE public.semantic_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages semantic cache"
  ON public.semantic_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS policies for inference_stats
ALTER TABLE public.inference_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages inference stats"
  ON public.inference_stats
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view own inference stats"
  ON public.inference_stats
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all inference stats"
  ON public.inference_stats
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));