-- Drop and recreate template_summary view with SECURITY INVOKER (default)
-- This ensures RLS policies of the querying user are applied, not the view creator

DROP VIEW IF EXISTS public.template_summary;

CREATE VIEW public.template_summary 
WITH (security_invoker = true) AS
SELECT 
    id,
    name,
    slug,
    description,
    language,
    language_code,
    domain,
    icon,
    recommended_model,
    difficulty,
    estimated_time,
    use_cases,
    is_active
FROM public.finetuning_templates
WHERE is_active = true;