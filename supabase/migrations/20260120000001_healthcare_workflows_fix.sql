-- Fix healthcare_tasks table - add missing columns
-- This handles the case where healthcare_tasks was created with a different schema

-- Add missing columns if they don't exist
ALTER TABLE IF EXISTS healthcare_tasks
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS prior_auth_id UUID,
  ADD COLUMN IF NOT EXISTS claim_id UUID,
  ADD COLUMN IF NOT EXISTS appeal_id UUID;

-- Add check constraint for priority if column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'healthcare_tasks_priority_check'
  ) THEN
    ALTER TABLE healthcare_tasks
    ADD CONSTRAINT healthcare_tasks_priority_check
    CHECK (priority IN ('urgent', 'high', 'normal', 'low'));
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Add foreign keys if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'healthcare_tasks_prior_auth_id_fkey'
  ) THEN
    ALTER TABLE healthcare_tasks
    ADD CONSTRAINT healthcare_tasks_prior_auth_id_fkey
    FOREIGN KEY (prior_auth_id) REFERENCES healthcare_prior_auths(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'healthcare_tasks_claim_id_fkey'
  ) THEN
    ALTER TABLE healthcare_tasks
    ADD CONSTRAINT healthcare_tasks_claim_id_fkey
    FOREIGN KEY (claim_id) REFERENCES healthcare_claims(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'healthcare_tasks_appeal_id_fkey'
  ) THEN
    ALTER TABLE healthcare_tasks
    ADD CONSTRAINT healthcare_tasks_appeal_id_fkey
    FOREIGN KEY (appeal_id) REFERENCES healthcare_appeals(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Create indexes that may have failed
CREATE INDEX IF NOT EXISTS idx_tasks_due ON healthcare_tasks(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON healthcare_tasks(priority, due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_pa ON healthcare_tasks(prior_auth_id);
CREATE INDEX IF NOT EXISTS idx_tasks_claim ON healthcare_tasks(claim_id);
CREATE INDEX IF NOT EXISTS idx_tasks_appeal ON healthcare_tasks(appeal_id);
