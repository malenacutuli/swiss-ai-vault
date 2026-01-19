-- =============================================
-- HEALTHCARE WORKFLOW MANAGEMENT
-- Prior Auths, Claims, Appeals with State Machine
-- =============================================

-- Prior Authorization Requests
CREATE TABLE IF NOT EXISTS healthcare_prior_auths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Patient (reference only - no PHI stored)
  patient_reference TEXT, -- External ID or encrypted reference

  -- Request Details
  service_type TEXT NOT NULL CHECK (service_type IN (
    'procedure', 'surgery', 'imaging', 'medication', 'dme',
    'therapy', 'admission', 'skilled_nursing', 'home_health', 'other'
  )),

  -- Codes
  cpt_codes TEXT[] NOT NULL DEFAULT '{}',
  icd10_codes TEXT[] NOT NULL DEFAULT '{}',
  hcpcs_codes TEXT[] DEFAULT '{}',
  ndc_codes TEXT[] DEFAULT '{}', -- For medications

  -- Provider
  ordering_provider_npi TEXT,
  ordering_provider_name TEXT,
  rendering_provider_npi TEXT,
  facility_npi TEXT,

  -- Payer
  payer_name TEXT NOT NULL,
  payer_id TEXT,
  plan_name TEXT,
  member_id TEXT,
  group_number TEXT,

  -- Service Dates
  service_date_start DATE,
  service_date_end DATE,

  -- Urgency
  urgency TEXT DEFAULT 'standard' CHECK (urgency IN (
    'standard',    -- 14 business days
    'expedited',   -- 72 hours
    'urgent',      -- 24 hours
    'emergency'    -- Concurrent review
  )),

  -- Status (State Machine)
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',              -- Being prepared
    'pending_ai_review',  -- AI is analyzing
    'ai_reviewed',        -- AI recommendation ready
    'pending_submission', -- Ready to submit
    'submitted',          -- Sent to payer
    'in_review',          -- Payer is reviewing
    'info_requested',     -- Payer needs more info
    'approved',           -- Approved
    'partially_approved', -- Approved with modifications
    'denied',             -- Denied
    'appealed',           -- Appeal submitted
    'appeal_approved',    -- Appeal won
    'appeal_denied',      -- Appeal lost
    'expired',            -- Auth expired unused
    'cancelled'           -- Cancelled by user
  )),

  -- AI Analysis (from Phase 2)
  ai_recommendation TEXT CHECK (ai_recommendation IN (
    'likely_approve', 'needs_documentation', 'likely_deny', 'uncertain', NULL
  )),
  ai_confidence FLOAT,
  ai_analysis JSONB, -- Full analysis from Claude
  ai_missing_items TEXT[], -- Documentation gaps identified
  ai_reviewed_at TIMESTAMPTZ,

  -- Outcome
  auth_number TEXT, -- Payer-assigned auth number
  approved_units INTEGER,
  approved_until DATE,
  decision_date DATE,
  decision_reason TEXT,

  -- Tracking
  reference_number TEXT, -- Internal tracking number
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prior Auth Status History (for audit trail)
CREATE TABLE IF NOT EXISTS healthcare_prior_auth_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prior_auth_id UUID NOT NULL REFERENCES healthcare_prior_auths(id) ON DELETE CASCADE,

  -- Status Change
  from_status TEXT,
  to_status TEXT NOT NULL,

  -- Who/What changed it
  changed_by UUID REFERENCES auth.users(id),
  changed_by_system BOOLEAN DEFAULT false, -- True if AI or automation

  -- Details
  notes TEXT,
  ai_triggered BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims
CREATE TABLE IF NOT EXISTS healthcare_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prior_auth_id UUID REFERENCES healthcare_prior_auths(id),

  -- Identifiers
  claim_number TEXT,
  payer_claim_id TEXT,

  -- Claim Type
  claim_type TEXT NOT NULL CHECK (claim_type IN (
    'professional', -- CMS-1500
    'institutional', -- UB-04
    'dental',
    'pharmacy'
  )),

  -- Codes
  cpt_codes TEXT[] DEFAULT '{}',
  icd10_codes TEXT[] DEFAULT '{}',

  -- Amounts
  billed_amount DECIMAL(10,2),
  allowed_amount DECIMAL(10,2),
  paid_amount DECIMAL(10,2),
  patient_responsibility DECIMAL(10,2),
  adjustment_amount DECIMAL(10,2),

  -- Provider/Payer
  provider_npi TEXT,
  payer_name TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'acknowledged', 'in_adjudication',
    'paid', 'denied', 'partial_pay', 'appealed', 'written_off'
  )),

  -- Dates
  service_date DATE,
  submitted_at TIMESTAMPTZ,
  adjudicated_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Denial Info
  denial_codes TEXT[],
  denial_reasons TEXT[],

  -- AI Analysis
  ai_appeal_recommended BOOLEAN,
  ai_appeal_strength TEXT CHECK (ai_appeal_strength IN ('strong', 'moderate', 'weak', NULL)),
  ai_analysis JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appeals
CREATE TABLE IF NOT EXISTS healthcare_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES healthcare_claims(id),
  prior_auth_id UUID REFERENCES healthcare_prior_auths(id),

  -- Appeal Details
  appeal_level INTEGER DEFAULT 1, -- 1st, 2nd, 3rd level
  appeal_type TEXT CHECK (appeal_type IN (
    'clinical', 'administrative', 'coding', 'timely_filing', 'other'
  )),

  -- What We're Appealing
  original_denial_codes TEXT[],
  original_denial_reasons TEXT[],

  -- Appeal Content (AI-generated in Phase 2)
  appeal_letter_text TEXT,
  ai_generated BOOLEAN DEFAULT false,
  ai_evidence_mapping JSONB, -- denial reason -> evidence
  ai_success_prediction FLOAT,

  -- Supporting Documents
  supporting_document_ids UUID[], -- References to healthcare_workflow_documents

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_review', 'submitted', 'in_review',
    'approved', 'partially_approved', 'denied', 'escalated'
  )),

  -- Outcome
  decision_date DATE,
  outcome TEXT,
  additional_payment DECIMAL(10,2),

  -- Deadline
  deadline DATE NOT NULL,
  submitted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supporting Documents for Workflows
CREATE TABLE IF NOT EXISTS healthcare_workflow_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Link to workflow
  prior_auth_id UUID REFERENCES healthcare_prior_auths(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES healthcare_claims(id) ON DELETE SET NULL,
  appeal_id UUID REFERENCES healthcare_appeals(id) ON DELETE SET NULL,

  -- Document Type
  document_type TEXT NOT NULL CHECK (document_type IN (
    'clinical_notes', 'lab_results', 'imaging_report', 'referral',
    'letter_of_medical_necessity', 'peer_to_peer_notes', 'eob',
    'denial_letter', 'appeal_letter', 'supporting_literature', 'other'
  )),

  -- Document Info
  filename TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes INTEGER,

  -- Storage reference (not content - use Supabase Storage)
  storage_path TEXT,

  -- AI Processing
  ai_summary TEXT,
  ai_extracted_data JSONB, -- Structured data extracted by AI

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (for workflow management)
CREATE TABLE IF NOT EXISTS healthcare_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Task Type
  task_type TEXT NOT NULL CHECK (task_type IN (
    'prior_auth_review', 'prior_auth_submit', 'prior_auth_follow_up',
    'claim_submit', 'denial_review', 'appeal_draft', 'appeal_submit',
    'document_upload', 'peer_to_peer_schedule', 'deadline_reminder',
    'ai_review_needed', 'manual_action_required'
  )),

  -- Link to workflow
  prior_auth_id UUID REFERENCES healthcare_prior_auths(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES healthcare_claims(id) ON DELETE CASCADE,
  appeal_id UUID REFERENCES healthcare_appeals(id) ON DELETE CASCADE,

  -- Task Details
  title TEXT NOT NULL,
  description TEXT,

  -- Priority
  priority TEXT DEFAULT 'normal' CHECK (priority IN (
    'urgent', 'high', 'normal', 'low'
  )),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'blocked', 'completed', 'cancelled'
  )),

  -- Dates
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- AI
  ai_generated BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prior_auths_user ON healthcare_prior_auths(user_id);
CREATE INDEX IF NOT EXISTS idx_prior_auths_status ON healthcare_prior_auths(status);
CREATE INDEX IF NOT EXISTS idx_prior_auths_urgency ON healthcare_prior_auths(urgency) WHERE status IN ('draft', 'submitted', 'in_review');
CREATE INDEX IF NOT EXISTS idx_prior_auths_reference ON healthcare_prior_auths(reference_number);

CREATE INDEX IF NOT EXISTS idx_prior_auth_history_pa ON healthcare_prior_auth_history(prior_auth_id);

CREATE INDEX IF NOT EXISTS idx_claims_user ON healthcare_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON healthcare_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_denied ON healthcare_claims(user_id) WHERE status = 'denied';
CREATE INDEX IF NOT EXISTS idx_claims_number ON healthcare_claims(claim_number);

CREATE INDEX IF NOT EXISTS idx_appeals_user ON healthcare_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_appeals_deadline ON healthcare_appeals(deadline) WHERE status NOT IN ('approved', 'denied');
CREATE INDEX IF NOT EXISTS idx_appeals_claim ON healthcare_appeals(claim_id);

CREATE INDEX IF NOT EXISTS idx_workflow_docs_user ON healthcare_workflow_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_docs_pa ON healthcare_workflow_documents(prior_auth_id);
CREATE INDEX IF NOT EXISTS idx_workflow_docs_claim ON healthcare_workflow_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_workflow_docs_appeal ON healthcare_workflow_documents(appeal_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON healthcare_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON healthcare_tasks(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON healthcare_tasks(priority, due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_pa ON healthcare_tasks(prior_auth_id);
CREATE INDEX IF NOT EXISTS idx_tasks_claim ON healthcare_tasks(claim_id);
CREATE INDEX IF NOT EXISTS idx_tasks_appeal ON healthcare_tasks(appeal_id);

-- RLS
ALTER TABLE healthcare_prior_auths ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_prior_auth_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_workflow_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users manage own prior auths" ON healthcare_prior_auths;
DROP POLICY IF EXISTS "Users view own prior auth history" ON healthcare_prior_auth_history;
DROP POLICY IF EXISTS "Service can insert prior auth history" ON healthcare_prior_auth_history;
DROP POLICY IF EXISTS "Users manage own claims" ON healthcare_claims;
DROP POLICY IF EXISTS "Users manage own appeals" ON healthcare_appeals;
DROP POLICY IF EXISTS "Users manage own workflow docs" ON healthcare_workflow_documents;
DROP POLICY IF EXISTS "Users manage own tasks" ON healthcare_tasks;

-- Create policies
CREATE POLICY "Users manage own prior auths" ON healthcare_prior_auths
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own prior auth history" ON healthcare_prior_auth_history
  FOR SELECT USING (
    prior_auth_id IN (SELECT id FROM healthcare_prior_auths WHERE user_id = auth.uid())
  );

CREATE POLICY "Service can insert prior auth history" ON healthcare_prior_auth_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users manage own claims" ON healthcare_claims
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own appeals" ON healthcare_appeals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own workflow docs" ON healthcare_workflow_documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own tasks" ON healthcare_tasks
  FOR ALL USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON healthcare_prior_auths TO authenticated;
GRANT ALL ON healthcare_prior_auth_history TO authenticated;
GRANT INSERT ON healthcare_prior_auth_history TO service_role;
GRANT ALL ON healthcare_claims TO authenticated;
GRANT ALL ON healthcare_appeals TO authenticated;
GRANT ALL ON healthcare_workflow_documents TO authenticated;
GRANT ALL ON healthcare_tasks TO authenticated;

-- Trigger to track prior auth status changes
CREATE OR REPLACE FUNCTION track_prior_auth_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO healthcare_prior_auth_history (
      prior_auth_id, from_status, to_status, changed_by
    ) VALUES (
      NEW.id, OLD.status, NEW.status, auth.uid()
    );
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prior_auth_status_tracker ON healthcare_prior_auths;
CREATE TRIGGER prior_auth_status_tracker
  BEFORE UPDATE ON healthcare_prior_auths
  FOR EACH ROW EXECUTE FUNCTION track_prior_auth_status_change();

-- Function to auto-create tasks when prior auth status changes
CREATE OR REPLACE FUNCTION create_prior_auth_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- When AI review is complete, create task to review
  IF NEW.status = 'ai_reviewed' AND OLD.status = 'pending_ai_review' THEN
    INSERT INTO healthcare_tasks (
      user_id, task_type, prior_auth_id, title, description, priority, ai_generated
    ) VALUES (
      NEW.user_id, 'prior_auth_review', NEW.id,
      'Review AI analysis for PA ' || NEW.reference_number,
      'AI has completed analysis. Review recommendations and proceed with submission.',
      CASE WHEN NEW.urgency IN ('urgent', 'emergency') THEN 'urgent' ELSE 'normal' END,
      true
    );
  END IF;

  -- When info requested, create urgent task
  IF NEW.status = 'info_requested' THEN
    INSERT INTO healthcare_tasks (
      user_id, task_type, prior_auth_id, title, description, priority, ai_generated
    ) VALUES (
      NEW.user_id, 'prior_auth_follow_up', NEW.id,
      'Additional info requested for PA ' || NEW.reference_number,
      'Payer has requested additional information. Respond promptly to avoid delays.',
      'high',
      true
    );
  END IF;

  -- When denied, create task to consider appeal
  IF NEW.status = 'denied' THEN
    INSERT INTO healthcare_tasks (
      user_id, task_type, prior_auth_id, title, description, priority, ai_generated,
      due_date
    ) VALUES (
      NEW.user_id, 'denial_review', NEW.id,
      'Review denial for PA ' || NEW.reference_number,
      'Prior authorization was denied. Review denial reason and consider appeal options.',
      'high',
      true,
      NOW() + INTERVAL '7 days'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prior_auth_task_creator ON healthcare_prior_auths;
CREATE TRIGGER prior_auth_task_creator
  AFTER UPDATE ON healthcare_prior_auths
  FOR EACH ROW EXECUTE FUNCTION create_prior_auth_tasks();

-- Function to auto-create tasks for claim denials
CREATE OR REPLACE FUNCTION create_claim_denial_tasks()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'denied' AND (OLD.status IS NULL OR OLD.status != 'denied') THEN
    INSERT INTO healthcare_tasks (
      user_id, task_type, claim_id, title, description, priority, ai_generated,
      due_date
    ) VALUES (
      NEW.user_id, 'denial_review', NEW.id,
      'Review denial for Claim ' || COALESCE(NEW.claim_number, NEW.id::text),
      'Claim was denied. Review denial codes and consider appeal. Denial reasons: ' ||
        COALESCE(array_to_string(NEW.denial_reasons, ', '), 'Not specified'),
      'high',
      true,
      NOW() + INTERVAL '30 days' -- Typical first-level appeal deadline
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS claim_denial_task_creator ON healthcare_claims;
CREATE TRIGGER claim_denial_task_creator
  AFTER INSERT OR UPDATE ON healthcare_claims
  FOR EACH ROW EXECUTE FUNCTION create_claim_denial_tasks();

-- Function to create deadline reminder tasks for appeals
CREATE OR REPLACE FUNCTION create_appeal_deadline_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Create reminder task 14 days before deadline
  INSERT INTO healthcare_tasks (
    user_id, task_type, appeal_id, title, description, priority, ai_generated,
    due_date
  ) VALUES (
    NEW.user_id, 'deadline_reminder', NEW.id,
    'Appeal deadline approaching',
    'Appeal deadline is ' || NEW.deadline::text || '. Ensure submission is complete.',
    'urgent',
    true,
    NEW.deadline - INTERVAL '14 days'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS appeal_deadline_task_creator ON healthcare_appeals;
CREATE TRIGGER appeal_deadline_task_creator
  AFTER INSERT ON healthcare_appeals
  FOR EACH ROW EXECUTE FUNCTION create_appeal_deadline_tasks();
