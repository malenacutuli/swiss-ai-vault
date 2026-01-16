-- Fix function search path security warning
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;