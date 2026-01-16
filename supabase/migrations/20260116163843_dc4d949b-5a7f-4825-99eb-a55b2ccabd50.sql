-- Create tables for storing source metadata and AI-generated guides

-- 1. SOURCES TABLE (if not exists)
CREATE TABLE IF NOT EXISTS public.sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT,
    file_url TEXT,
    file_size INTEGER,
    status TEXT DEFAULT 'processing',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SOURCE GUIDES TABLE (AI-generated metadata)
CREATE TABLE IF NOT EXISTS public.source_guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE,
    title TEXT,
    summary TEXT,
    key_topics TEXT[],
    suggested_questions JSONB,
    word_count INTEGER,
    page_count INTEGER,
    language TEXT DEFAULT 'en',
    confidence_score DECIMAL(3,2),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id)
);

-- 3. SOURCE CHUNKS TABLE (for RAG)
CREATE TABLE IF NOT EXISTS public.source_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER,
    section_title TEXT,
    token_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_sources_user ON public.sources(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_notebook ON public.sources(notebook_id);
CREATE INDEX IF NOT EXISTS idx_sources_status ON public.sources(status);
CREATE INDEX IF NOT EXISTS idx_source_guides_source ON public.source_guides(source_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_source ON public.source_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_index ON public.source_chunks(source_id, chunk_index);

-- 5. ROW LEVEL SECURITY
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_chunks ENABLE ROW LEVEL SECURITY;

-- Sources policies
CREATE POLICY "Users can view own sources" ON public.sources
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sources" ON public.sources
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sources" ON public.sources
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sources" ON public.sources
    FOR DELETE USING (auth.uid() = user_id);

-- Source guides policies
CREATE POLICY "Users can view own source guides" ON public.source_guides
    FOR SELECT USING (
        source_id IN (SELECT id FROM public.sources WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert own source guides" ON public.source_guides
    FOR INSERT WITH CHECK (
        source_id IN (SELECT id FROM public.sources WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update own source guides" ON public.source_guides
    FOR UPDATE USING (
        source_id IN (SELECT id FROM public.sources WHERE user_id = auth.uid())
    );

-- Source chunks policies
CREATE POLICY "Users can view own source chunks" ON public.source_chunks
    FOR SELECT USING (
        source_id IN (SELECT id FROM public.sources WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert own source chunks" ON public.source_chunks
    FOR INSERT WITH CHECK (
        source_id IN (SELECT id FROM public.sources WHERE user_id = auth.uid())
    );

-- Service role policies for edge functions
CREATE POLICY "Service role can manage source guides" ON public.source_guides
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage sources" ON public.sources
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage source chunks" ON public.source_chunks
    FOR ALL USING (auth.role() = 'service_role');

-- Helper function to get source with guide
CREATE OR REPLACE FUNCTION get_source_with_guide(p_source_id UUID)
RETURNS TABLE (
    source_id UUID,
    filename TEXT,
    file_type TEXT,
    status TEXT,
    guide_title TEXT,
    guide_summary TEXT,
    key_topics TEXT[],
    suggested_questions JSONB,
    confidence_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as source_id,
        s.filename,
        s.file_type,
        s.status,
        g.title as guide_title,
        g.summary as guide_summary,
        g.key_topics,
        g.suggested_questions,
        g.confidence_score
    FROM public.sources s
    LEFT JOIN public.source_guides g ON s.id = g.source_id
    WHERE s.id = p_source_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;