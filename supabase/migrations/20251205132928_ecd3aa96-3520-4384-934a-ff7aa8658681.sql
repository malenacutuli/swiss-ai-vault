-- Drop the foreign key constraint first
ALTER TABLE public.evaluations 
  DROP CONSTRAINT evaluations_model_id_fkey;

-- Change model_id from UUID to TEXT to support base model string identifiers
ALTER TABLE public.evaluations 
  ALTER COLUMN model_id TYPE TEXT;