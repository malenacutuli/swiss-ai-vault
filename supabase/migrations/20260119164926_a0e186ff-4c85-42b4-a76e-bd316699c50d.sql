-- Table for source citations (used by useCitations hook)
CREATE TABLE IF NOT EXISTS public.source_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID,
  user_id UUID,
  source_url TEXT NOT NULL,
  source_title TEXT,
  source_domain TEXT,
  source_type TEXT CHECK (source_type IN ('web', 'academic', 'news', 'database', 'api')),
  citation_key TEXT NOT NULL,
  access_date TIMESTAMPTZ,
  publication_date TIMESTAMPTZ,
  author TEXT,
  excerpt TEXT,
  relevance_score NUMERIC(5,2),
  credibility_score NUMERIC(5,2),
  verified BOOLEAN DEFAULT FALSE,
  verification_method TEXT,
  verification_date TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for claims extracted from citations
CREATE TABLE IF NOT EXISTS public.citation_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID,
  citation_id UUID REFERENCES public.source_citations(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  claim_type TEXT CHECK (claim_type IN ('fact', 'statistic', 'quote', 'opinion')),
  verification_status TEXT CHECK (verification_status IN ('unverified', 'verified', 'disputed', 'false')) DEFAULT 'unverified',
  confidence_score NUMERIC(5,2),
  source_excerpt TEXT,
  match_quality TEXT CHECK (match_quality IN ('exact', 'paraphrase', 'inferred')),
  position_in_output INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.source_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citation_claims ENABLE ROW LEVEL SECURITY;

-- RLS policies for source_citations
CREATE POLICY "Users can view their own citations"
  ON public.source_citations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own citations"
  ON public.source_citations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own citations"
  ON public.source_citations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own citations"
  ON public.source_citations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS policies for citation_claims
CREATE POLICY "Users can view claims for their citations"
  ON public.citation_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.source_citations sc 
      WHERE sc.id = citation_claims.citation_id 
      AND sc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert claims for their citations"
  ON public.citation_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.source_citations sc 
      WHERE sc.id = citation_claims.citation_id 
      AND sc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update claims for their citations"
  ON public.citation_claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.source_citations sc 
      WHERE sc.id = citation_claims.citation_id 
      AND sc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete claims for their citations"
  ON public.citation_claims FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.source_citations sc 
      WHERE sc.id = citation_claims.citation_id 
      AND sc.user_id = auth.uid()
    )
  );

-- Indexes for efficient lookups
CREATE INDEX idx_source_citations_run_id ON public.source_citations(run_id);
CREATE INDEX idx_source_citations_user_id ON public.source_citations(user_id);
CREATE INDEX idx_citation_claims_run_id ON public.citation_claims(run_id);
CREATE INDEX idx_citation_claims_citation_id ON public.citation_claims(citation_id);