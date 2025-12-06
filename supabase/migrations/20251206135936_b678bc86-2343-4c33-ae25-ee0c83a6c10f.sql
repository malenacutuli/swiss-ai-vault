-- Add deployment columns to models table
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS deployment_status TEXT DEFAULT 'not_deployed';
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS deployment_endpoint TEXT;
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ;