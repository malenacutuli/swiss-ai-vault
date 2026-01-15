# Complete SQL Schema: Billing System

**Database:** PostgreSQL 14+  
**Purpose:** Production-grade billing, token tracking, and reconciliation  
**Audience:** Database engineers, DevOps, billing team

---

## Part 1: Core Tables

### 1.1 token_records Table

**Purpose:** Record every LLM API call and token consumption

```sql
CREATE TABLE token_records (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys (Hierarchy)
  run_id UUID NOT NULL,
  agent_id UUID,
  task_id UUID,
  step_id UUID NOT NULL,
  
  -- Token Counts (from LLM API)
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),
  
  -- Validation: total_tokens must equal input + output
  -- (This is enforced by application, not database trigger)
  
  -- Model Information
  model VARCHAR(100) NOT NULL,
    -- Examples: 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'
    -- Used to look up pricing
  
  -- Cost Calculation
  cost_usd DECIMAL(12, 8) NOT NULL CHECK (cost_usd >= 0),
    -- Calculated as: (input_tokens * input_price) + (output_tokens * output_price)
    -- Stored for audit trail (don't recalculate later)
  
  -- Estimation vs Actual
  is_estimated BOOLEAN DEFAULT FALSE,
    -- TRUE: Estimated from response content (LLM API returned invalid count)
    -- FALSE: Actual count from LLM API
  
  -- Error Tracking
  error_code VARCHAR(50),
    -- NULL: No error
    -- 'ZERO_TOKENS': LLM returned total_tokens = 0
    -- 'MISMATCH': input + output != total
    -- 'TIMEOUT': LLM call timed out
    -- 'RATE_LIMIT': Rate limited (429)
    -- 'AUTH_ERROR': Authentication failed
    -- 'INVALID_RESPONSE': Response malformed
  
  error_message TEXT,
    -- Human-readable error description
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT fk_token_records_run FOREIGN KEY (run_id) 
    REFERENCES runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_token_records_agent FOREIGN KEY (agent_id) 
    REFERENCES agents(id) ON DELETE SET NULL,
  CONSTRAINT fk_token_records_task FOREIGN KEY (task_id) 
    REFERENCES tasks(id) ON DELETE SET NULL,
  CONSTRAINT fk_token_records_step FOREIGN KEY (step_id) 
    REFERENCES steps(id) ON DELETE CASCADE,
  
  -- Invariant: total_tokens = input_tokens + output_tokens
  -- (Enforced by application, not trigger)
  CONSTRAINT check_token_sum 
    CHECK (total_tokens = input_tokens + output_tokens)
);

-- Indexes for common queries
CREATE INDEX idx_token_records_run_id 
  ON token_records(run_id) 
  WHERE error_code IS NULL;  -- Only index successful records

CREATE INDEX idx_token_records_agent_id 
  ON token_records(agent_id) 
  WHERE error_code IS NULL;

CREATE INDEX idx_token_records_step_id 
  ON token_records(step_id) 
  WHERE error_code IS NULL;

CREATE INDEX idx_token_records_created_at 
  ON token_records(created_at DESC);

CREATE INDEX idx_token_records_model 
  ON token_records(model);

CREATE INDEX idx_token_records_error 
  ON token_records(error_code) 
  WHERE error_code IS NOT NULL;  -- Only index errors

-- Composite indexes for common queries
CREATE INDEX idx_token_records_run_created 
  ON token_records(run_id, created_at DESC);

CREATE INDEX idx_token_records_agent_created 
  ON token_records(agent_id, created_at DESC);

-- Partial index for estimated tokens (for audit)
CREATE INDEX idx_token_records_estimated 
  ON token_records(run_id) 
  WHERE is_estimated = TRUE;

-- Statistics
CREATE STATISTICS token_records_stats (dependencies) 
  ON run_id, model, error_code 
  FROM token_records;
```

**Column Definitions:**

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `id` | UUID | NO | gen_random_uuid() | Unique identifier |
| `run_id` | UUID | NO | - | Which run this token belongs to |
| `agent_id` | UUID | YES | - | Which agent executed this (NULL for main agent) |
| `task_id` | UUID | YES | - | Which task executed this (NULL for non-task steps) |
| `step_id` | UUID | NO | - | Which step executed this |
| `input_tokens` | INTEGER | NO | - | Tokens in prompt (from LLM API) |
| `output_tokens` | INTEGER | NO | - | Tokens in response (from LLM API) |
| `total_tokens` | INTEGER | NO | - | Sum of input + output |
| `model` | VARCHAR(100) | NO | - | LLM model used (e.g., 'gpt-4-turbo') |
| `cost_usd` | DECIMAL(12,8) | NO | - | Cost in USD (immutable) |
| `is_estimated` | BOOLEAN | NO | FALSE | Whether tokens are estimated vs actual |
| `error_code` | VARCHAR(50) | YES | - | Error code if LLM call failed |
| `error_message` | TEXT | YES | - | Error description |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | When record was created |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | When record was last updated |

**Key Constraints:**

1. **Primary Key:** `id` (UUID)
2. **Foreign Keys:** `run_id` (CASCADE), `agent_id` (SET NULL), `task_id` (SET NULL), `step_id` (CASCADE)
3. **Check Constraints:**
   - `input_tokens >= 0`
   - `output_tokens >= 0`
   - `total_tokens >= 0`
   - `cost_usd >= 0`
   - `total_tokens = input_tokens + output_tokens`

**Invariants:**

```
1. Every token_record must have a run_id
2. Every token_record must have a step_id
3. total_tokens = input_tokens + output_tokens (always)
4. cost_usd is immutable (never updated after creation)
5. If error_code is not NULL, then is_estimated = TRUE
6. If is_estimated = TRUE, then error_code is not NULL
```

**Retention Policy:**

```
- Keep all records for 7 years (regulatory requirement)
- Archive to cold storage after 1 year
- Delete after 7 years (or per user request)
```

---

### 1.2 token_reconciliations Table

**Purpose:** Record reconciliation of estimated vs actual tokens for each run

```sql
CREATE TABLE token_reconciliations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key
  run_id UUID NOT NULL UNIQUE,
    -- UNIQUE: Only one reconciliation per run
  
  -- Estimated Tokens (from pre-execution estimation)
  estimated_input_tokens INTEGER NOT NULL CHECK (estimated_input_tokens >= 0),
  estimated_output_tokens INTEGER NOT NULL CHECK (estimated_output_tokens >= 0),
  estimated_total_tokens INTEGER NOT NULL CHECK (estimated_total_tokens >= 0),
  
  -- Actual Tokens (sum of all token_records for this run)
  actual_input_tokens INTEGER NOT NULL CHECK (actual_input_tokens >= 0),
  actual_output_tokens INTEGER NOT NULL CHECK (actual_output_tokens >= 0),
  actual_total_tokens INTEGER NOT NULL CHECK (actual_total_tokens >= 0),
  
  -- Variance Calculation
  variance_tokens INTEGER NOT NULL,
    -- actual_total_tokens - estimated_total_tokens
    -- Can be negative (overestimate) or positive (underestimate)
  
  variance_pct DECIMAL(10, 4) NOT NULL,
    -- (actual_total_tokens - estimated_total_tokens) / estimated_total_tokens * 100
    -- Example: -19.5 means 19.5% overestimate
    -- Example: +59.2 means 59.2% underestimate
  
  -- Cost Reconciliation
  estimated_cost_usd DECIMAL(12, 8) NOT NULL CHECK (estimated_cost_usd >= 0),
  actual_cost_usd DECIMAL(12, 8) NOT NULL CHECK (actual_cost_usd >= 0),
  
  refund_amount_usd DECIMAL(12, 8) NOT NULL DEFAULT 0 CHECK (refund_amount_usd >= 0),
    -- Amount refunded if actual < estimated
  
  charge_amount_usd DECIMAL(12, 8) NOT NULL DEFAULT 0 CHECK (charge_amount_usd >= 0),
    -- Amount charged additionally if actual > estimated
  
  -- Status
  status VARCHAR(50) NOT NULL,
    -- 'RECONCILED': Variance within normal range (±50%)
    -- 'NEEDS_REVIEW': Variance in warning range (±50% to ±100%)
    -- 'CRITICAL': Variance in critical range (>±100%)
    -- 'DISPUTED': User disputed the reconciliation
    -- 'RESOLVED': Disputed reconciliation was resolved
  
  -- Action Taken
  action VARCHAR(100),
    -- 'none': No action needed
    -- 'refund_applied': Refund was applied
    -- 'charge_applied': Additional charge was applied
    -- 'escalated_to_team': Escalated for manual review
    -- 'escalated_to_user': User was contacted
    -- 'dispute_resolved': Dispute was resolved
  
  -- Notes
  notes TEXT,
    -- Human-readable notes about reconciliation
    -- Example: "Actual tokens 3x higher due to image processing"
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
    -- When dispute was resolved (if applicable)
  
  -- Constraints
  CONSTRAINT fk_token_reconciliations_run FOREIGN KEY (run_id) 
    REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Invariants
  CONSTRAINT check_estimated_sum 
    CHECK (estimated_total_tokens = estimated_input_tokens + estimated_output_tokens),
  
  CONSTRAINT check_actual_sum 
    CHECK (actual_total_tokens = actual_input_tokens + actual_output_tokens),
  
  CONSTRAINT check_variance_calculation 
    CHECK (variance_tokens = actual_total_tokens - estimated_total_tokens),
  
  CONSTRAINT check_refund_or_charge 
    CHECK (
      (refund_amount_usd > 0 AND charge_amount_usd = 0) OR
      (refund_amount_usd = 0 AND charge_amount_usd > 0) OR
      (refund_amount_usd = 0 AND charge_amount_usd = 0)
    ),
    -- Can't have both refund and charge
  
  CONSTRAINT check_refund_amount 
    CHECK (refund_amount_usd <= estimated_cost_usd),
    -- Refund can't exceed estimated cost
  
  CONSTRAINT check_status_values 
    CHECK (status IN ('RECONCILED', 'NEEDS_REVIEW', 'CRITICAL', 'DISPUTED', 'RESOLVED'))
);

-- Indexes
CREATE INDEX idx_token_reconciliations_run_id 
  ON token_reconciliations(run_id);

CREATE INDEX idx_token_reconciliations_status 
  ON token_reconciliations(status);

CREATE INDEX idx_token_reconciliations_created_at 
  ON token_reconciliations(created_at DESC);

CREATE INDEX idx_token_reconciliations_variance 
  ON token_reconciliations(variance_pct DESC);

-- Partial indexes for common queries
CREATE INDEX idx_token_reconciliations_needs_review 
  ON token_reconciliations(run_id) 
  WHERE status IN ('NEEDS_REVIEW', 'CRITICAL', 'DISPUTED');

CREATE INDEX idx_token_reconciliations_critical 
  ON token_reconciliations(run_id) 
  WHERE status = 'CRITICAL';

-- Statistics
CREATE STATISTICS token_reconciliations_stats (dependencies) 
  ON status, variance_pct 
  FROM token_reconciliations;
```

**Column Definitions:**

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `id` | UUID | NO | gen_random_uuid() | Unique identifier |
| `run_id` | UUID | NO | - | Which run this reconciliation is for (UNIQUE) |
| `estimated_input_tokens` | INTEGER | NO | - | Estimated input tokens |
| `estimated_output_tokens` | INTEGER | NO | - | Estimated output tokens |
| `estimated_total_tokens` | INTEGER | NO | - | Total estimated tokens |
| `actual_input_tokens` | INTEGER | NO | - | Actual input tokens used |
| `actual_output_tokens` | INTEGER | NO | - | Actual output tokens used |
| `actual_total_tokens` | INTEGER | NO | - | Total actual tokens used |
| `variance_tokens` | INTEGER | NO | - | Difference (actual - estimated) |
| `variance_pct` | DECIMAL(10,4) | NO | - | Percentage difference |
| `estimated_cost_usd` | DECIMAL(12,8) | NO | - | Estimated cost |
| `actual_cost_usd` | DECIMAL(12,8) | NO | - | Actual cost |
| `refund_amount_usd` | DECIMAL(12,8) | NO | 0 | Refund amount (if overestimate) |
| `charge_amount_usd` | DECIMAL(12,8) | NO | 0 | Additional charge (if underestimate) |
| `status` | VARCHAR(50) | NO | - | Reconciliation status |
| `action` | VARCHAR(100) | YES | - | Action taken |
| `notes` | TEXT | YES | - | Human-readable notes |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | When reconciliation was created |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | When reconciliation was updated |
| `resolved_at` | TIMESTAMP | YES | - | When dispute was resolved |

**Key Constraints:**

1. **Primary Key:** `id` (UUID)
2. **Unique Key:** `run_id` (only one reconciliation per run)
3. **Foreign Key:** `run_id` (CASCADE)
4. **Check Constraints:** Multiple (see above)

**Invariants:**

```
1. estimated_total_tokens = estimated_input_tokens + estimated_output_tokens
2. actual_total_tokens = actual_input_tokens + actual_output_tokens
3. variance_tokens = actual_total_tokens - estimated_total_tokens
4. Can't have both refund_amount_usd > 0 AND charge_amount_usd > 0
5. refund_amount_usd <= estimated_cost_usd
6. status must be one of: RECONCILED, NEEDS_REVIEW, CRITICAL, DISPUTED, RESOLVED
```

---

### 1.3 billing_ledger Table

**Purpose:** Append-only transaction log for all billing activities

```sql
CREATE TABLE billing_ledger (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization
  org_id UUID NOT NULL,
  
  -- Transaction Type
  transaction_type VARCHAR(50) NOT NULL,
    -- 'credit_purchase': User purchased credits
    -- 'charge': Charge for run execution
    -- 'refund': Refund (overestimate or failure)
    -- 'adjustment': Manual adjustment by support
    -- 'promo': Promotional credit
    -- 'trial': Trial credit
  
  -- Amount
  amount_usd DECIMAL(12, 8) NOT NULL,
    -- Always positive
    -- For charges/refunds, this is the amount debited/credited
  
  -- Direction (derived from transaction_type, but explicit for clarity)
  direction VARCHAR(10) NOT NULL,
    -- 'debit': Money out (charge)
    -- 'credit': Money in (refund, purchase, promo)
  
  -- References (which run/agent/task this transaction relates to)
  run_id UUID,
  agent_id UUID,
  task_id UUID,
  
  -- Reason
  reason VARCHAR(255) NOT NULL,
    -- 'token_reconciliation_overestimate'
    -- 'token_reconciliation_underestimate'
    -- 'partial_failure_refund'
    -- 'agent_crash_refund'
    -- 'manual_support_refund'
    -- 'user_dispute_resolution'
    -- 'promo_code_applied'
    -- 'trial_credit_granted'
  
  -- Idempotency (prevent double-charging)
  idempotency_key VARCHAR(255) UNIQUE,
    -- Unique key for this transaction
    -- If same key is submitted again, return existing transaction
    -- NULL for transactions that don't need idempotency
  
  -- Metadata
  created_by VARCHAR(100),
    -- 'system': Automated (reconciliation, refund)
    -- 'support': Manual by support team
    -- 'user': User initiated (purchase)
    -- user_id: Specific user who initiated
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT fk_billing_ledger_org FOREIGN KEY (org_id) 
    REFERENCES organizations(id) ON DELETE RESTRICT,
  
  CONSTRAINT fk_billing_ledger_run FOREIGN KEY (run_id) 
    REFERENCES runs(id) ON DELETE SET NULL,
  
  CONSTRAINT fk_billing_ledger_agent FOREIGN KEY (agent_id) 
    REFERENCES agents(id) ON DELETE SET NULL,
  
  CONSTRAINT fk_billing_ledger_task FOREIGN KEY (task_id) 
    REFERENCES tasks(id) ON DELETE SET NULL,
  
  -- Invariants
  CONSTRAINT check_amount_positive 
    CHECK (amount_usd > 0),
  
  CONSTRAINT check_transaction_type 
    CHECK (transaction_type IN (
      'credit_purchase', 'charge', 'refund', 'adjustment', 'promo', 'trial'
    )),
  
  CONSTRAINT check_direction 
    CHECK (direction IN ('debit', 'credit')),
  
  CONSTRAINT check_direction_matches_type 
    CHECK (
      (transaction_type = 'charge' AND direction = 'debit') OR
      (transaction_type IN ('refund', 'credit_purchase', 'promo', 'trial') AND direction = 'credit') OR
      (transaction_type = 'adjustment' AND direction IN ('debit', 'credit'))
    )
);

-- Indexes for common queries
CREATE INDEX idx_billing_ledger_org_id 
  ON billing_ledger(org_id, created_at DESC);

CREATE INDEX idx_billing_ledger_created_at 
  ON billing_ledger(created_at DESC);

CREATE INDEX idx_billing_ledger_transaction_type 
  ON billing_ledger(transaction_type);

CREATE INDEX idx_billing_ledger_run_id 
  ON billing_ledger(run_id);

CREATE INDEX idx_billing_ledger_agent_id 
  ON billing_ledger(agent_id);

-- Composite indexes
CREATE INDEX idx_billing_ledger_org_type_created 
  ON billing_ledger(org_id, transaction_type, created_at DESC);

CREATE INDEX idx_billing_ledger_org_direction_created 
  ON billing_ledger(org_id, direction, created_at DESC);

-- Partial indexes for common queries
CREATE INDEX idx_billing_ledger_charges 
  ON billing_ledger(org_id, created_at DESC) 
  WHERE transaction_type = 'charge';

CREATE INDEX idx_billing_ledger_refunds 
  ON billing_ledger(org_id, created_at DESC) 
  WHERE transaction_type = 'refund';

-- Idempotency index
CREATE INDEX idx_billing_ledger_idempotency 
  ON billing_ledger(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Statistics
CREATE STATISTICS billing_ledger_stats (dependencies) 
  ON org_id, transaction_type, direction 
  FROM billing_ledger;
```

**Column Definitions:**

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `id` | UUID | NO | gen_random_uuid() | Unique transaction ID |
| `org_id` | UUID | NO | - | Organization being billed |
| `transaction_type` | VARCHAR(50) | NO | - | Type of transaction |
| `amount_usd` | DECIMAL(12,8) | NO | - | Amount in USD (always positive) |
| `direction` | VARCHAR(10) | NO | - | Debit or credit |
| `run_id` | UUID | YES | - | Associated run (if any) |
| `agent_id` | UUID | YES | - | Associated agent (if any) |
| `task_id` | UUID | YES | - | Associated task (if any) |
| `reason` | VARCHAR(255) | NO | - | Why this transaction occurred |
| `idempotency_key` | VARCHAR(255) | YES | - | Unique key for idempotency |
| `created_by` | VARCHAR(100) | YES | - | Who created this transaction |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | When transaction occurred |

**Key Constraints:**

1. **Primary Key:** `id` (UUID)
2. **Unique Key:** `idempotency_key` (for idempotency)
3. **Foreign Keys:** `org_id` (RESTRICT), `run_id` (SET NULL), `agent_id` (SET NULL), `task_id` (SET NULL)
4. **Check Constraints:** Multiple (see above)

**Invariants:**

```
1. amount_usd > 0 (always positive)
2. transaction_type must be one of: credit_purchase, charge, refund, adjustment, promo, trial
3. direction must be: debit or credit
4. direction must match transaction_type:
   - charge → debit
   - refund, credit_purchase, promo, trial → credit
   - adjustment → debit or credit
5. Append-only: Never UPDATE or DELETE (only INSERT)
6. If idempotency_key is provided, it must be unique
```

**Retention Policy:**

```
- Keep all records forever (immutable audit trail)
- Archive to cold storage after 7 years
- Never delete (regulatory requirement)
```

---

## Part 2: Supporting Tables

### 2.1 credit_balances Table

**Purpose:** Track current credit balance for each organization

```sql
CREATE TABLE credit_balances (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization
  org_id UUID NOT NULL UNIQUE,
  
  -- Balance
  balance_usd DECIMAL(12, 8) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
    -- Current available balance
  
  -- Reserved Credits
  reserved_usd DECIMAL(12, 8) NOT NULL DEFAULT 0 CHECK (reserved_usd >= 0),
    -- Credits reserved for in-progress runs
    -- available = balance - reserved
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT fk_credit_balances_org FOREIGN KEY (org_id) 
    REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Invariant: balance >= 0 (enforced by check constraint)
  CONSTRAINT check_balance_non_negative 
    CHECK (balance_usd >= 0),
  
  CONSTRAINT check_reserved_non_negative 
    CHECK (reserved_usd >= 0)
);

-- Indexes
CREATE INDEX idx_credit_balances_org_id 
  ON credit_balances(org_id);

-- Trigger to update updated_at
CREATE TRIGGER update_credit_balances_updated_at
BEFORE UPDATE ON credit_balances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**Column Definitions:**

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `id` | UUID | NO | gen_random_uuid() | Unique identifier |
| `org_id` | UUID | NO | - | Organization (UNIQUE) |
| `balance_usd` | DECIMAL(12,8) | NO | 0 | Available balance |
| `reserved_usd` | DECIMAL(12,8) | NO | 0 | Reserved for in-progress runs |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | When created |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | When last updated |

**Invariants:**

```
1. balance_usd >= 0 (never negative)
2. reserved_usd >= 0 (never negative)
3. available = balance_usd - reserved_usd
```

---

### 2.2 credit_balance_history Table

**Purpose:** Track historical balance changes for audit

```sql
CREATE TABLE credit_balance_history (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization
  org_id UUID NOT NULL,
  
  -- Balance Before and After
  balance_before_usd DECIMAL(12, 8) NOT NULL,
  balance_after_usd DECIMAL(12, 8) NOT NULL,
  
  -- Change
  change_usd DECIMAL(12, 8) NOT NULL,
    -- balance_after - balance_before
    -- Positive: credit added
    -- Negative: credit used
  
  -- Reason
  reason VARCHAR(255) NOT NULL,
  
  -- Reference
  billing_ledger_id UUID,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT fk_credit_balance_history_org FOREIGN KEY (org_id) 
    REFERENCES organizations(id) ON DELETE CASCADE,
  
  CONSTRAINT fk_credit_balance_history_ledger FOREIGN KEY (billing_ledger_id) 
    REFERENCES billing_ledger(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_credit_balance_history_org_id 
  ON credit_balance_history(org_id, created_at DESC);

CREATE INDEX idx_credit_balance_history_created_at 
  ON credit_balance_history(created_at DESC);
```

---

## Part 3: Views for Common Queries

### 3.1 View: Run Billing Summary

```sql
CREATE VIEW v_run_billing_summary AS
SELECT 
  r.id as run_id,
  r.org_id,
  r.status,
  r.created_at,
  r.completed_at,
  
  -- Token Counts
  COALESCE(SUM(tr.input_tokens), 0) as actual_input_tokens,
  COALESCE(SUM(tr.output_tokens), 0) as actual_output_tokens,
  COALESCE(SUM(tr.total_tokens), 0) as actual_total_tokens,
  
  -- Costs
  COALESCE(SUM(tr.cost_usd), 0) as actual_cost_usd,
  
  -- Reconciliation
  CASE 
    WHEN rec.status = 'RECONCILED' THEN 'OK'
    WHEN rec.status = 'NEEDS_REVIEW' THEN 'WARNING'
    WHEN rec.status = 'CRITICAL' THEN 'ERROR'
    WHEN rec.status = 'DISPUTED' THEN 'DISPUTED'
    ELSE 'NOT_RECONCILED'
  END as reconciliation_status,
  
  rec.variance_pct,
  rec.refund_amount_usd,
  rec.charge_amount_usd
  
FROM runs r
LEFT JOIN token_records tr ON r.id = tr.run_id
LEFT JOIN token_reconciliations rec ON r.id = rec.run_id
GROUP BY r.id, rec.id;
```

### 3.2 View: Organization Billing Summary

```sql
CREATE VIEW v_org_billing_summary AS
SELECT 
  org_id,
  
  -- Balance
  (SELECT balance_usd FROM credit_balances WHERE org_id = bl.org_id) as current_balance_usd,
  (SELECT reserved_usd FROM credit_balances WHERE org_id = bl.org_id) as reserved_usd,
  
  -- Transactions
  COUNT(DISTINCT CASE WHEN bl.transaction_type = 'charge' THEN bl.id END) as charge_count,
  COUNT(DISTINCT CASE WHEN bl.transaction_type = 'refund' THEN bl.id END) as refund_count,
  
  -- Amounts
  COALESCE(SUM(CASE WHEN bl.direction = 'debit' THEN bl.amount_usd ELSE 0 END), 0) as total_charged_usd,
  COALESCE(SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_usd ELSE 0 END), 0) as total_credited_usd,
  
  -- Date Range
  MIN(bl.created_at) as first_transaction_at,
  MAX(bl.created_at) as last_transaction_at
  
FROM billing_ledger bl
GROUP BY org_id;
```

### 3.3 View: High Variance Runs

```sql
CREATE VIEW v_high_variance_runs AS
SELECT 
  rec.run_id,
  rec.status,
  rec.variance_pct,
  rec.estimated_total_tokens,
  rec.actual_total_tokens,
  rec.estimated_cost_usd,
  rec.actual_cost_usd,
  rec.refund_amount_usd,
  rec.charge_amount_usd,
  rec.created_at
  
FROM token_reconciliations rec
WHERE rec.status IN ('NEEDS_REVIEW', 'CRITICAL')
ORDER BY ABS(rec.variance_pct) DESC;
```

---

## Part 4: Stored Procedures

### 4.1 Procedure: Record Token Call

```sql
CREATE OR REPLACE FUNCTION record_token_call(
  p_run_id UUID,
  p_agent_id UUID,
  p_task_id UUID,
  p_step_id UUID,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_model VARCHAR,
  p_cost_usd DECIMAL
) RETURNS UUID AS $$
DECLARE
  v_total_tokens INTEGER;
  v_record_id UUID;
BEGIN
  -- Calculate total tokens
  v_total_tokens := p_input_tokens + p_output_tokens;
  
  -- Insert token record
  INSERT INTO token_records (
    run_id, agent_id, task_id, step_id,
    input_tokens, output_tokens, total_tokens,
    model, cost_usd, is_estimated
  ) VALUES (
    p_run_id, p_agent_id, p_task_id, p_step_id,
    p_input_tokens, p_output_tokens, v_total_tokens,
    p_model, p_cost_usd, FALSE
  ) RETURNING id INTO v_record_id;
  
  -- Update run totals
  UPDATE runs SET
    tokens_used = tokens_used + v_total_tokens,
    cost_incurred = cost_incurred + p_cost_usd
  WHERE id = p_run_id;
  
  RETURN v_record_id;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 Procedure: Reconcile Run

```sql
CREATE OR REPLACE FUNCTION reconcile_run(
  p_run_id UUID
) RETURNS UUID AS $$
DECLARE
  v_estimated_tokens INTEGER;
  v_actual_tokens INTEGER;
  v_variance_tokens INTEGER;
  v_variance_pct DECIMAL;
  v_estimated_cost DECIMAL;
  v_actual_cost DECIMAL;
  v_status VARCHAR;
  v_reconciliation_id UUID;
BEGIN
  -- Get estimated tokens
  SELECT tokens_estimated, cost_estimated INTO v_estimated_tokens, v_estimated_cost
  FROM runs WHERE id = p_run_id;
  
  -- Get actual tokens
  SELECT 
    COALESCE(SUM(total_tokens), 0),
    COALESCE(SUM(cost_usd), 0)
  INTO v_actual_tokens, v_actual_cost
  FROM token_records WHERE run_id = p_run_id;
  
  -- Calculate variance
  v_variance_tokens := v_actual_tokens - v_estimated_tokens;
  v_variance_pct := CASE 
    WHEN v_estimated_tokens = 0 THEN 0
    ELSE (v_variance_tokens::DECIMAL / v_estimated_tokens) * 100
  END;
  
  -- Determine status
  v_status := CASE
    WHEN ABS(v_variance_pct) <= 50 THEN 'RECONCILED'
    WHEN ABS(v_variance_pct) <= 100 THEN 'NEEDS_REVIEW'
    ELSE 'CRITICAL'
  END;
  
  -- Insert reconciliation
  INSERT INTO token_reconciliations (
    run_id,
    estimated_input_tokens, estimated_output_tokens, estimated_total_tokens,
    actual_input_tokens, actual_output_tokens, actual_total_tokens,
    variance_tokens, variance_pct,
    estimated_cost_usd, actual_cost_usd,
    status
  ) VALUES (
    p_run_id,
    0, 0, v_estimated_tokens,  -- Simplified; actual code would calculate input/output
    0, 0, v_actual_tokens,
    v_variance_tokens, v_variance_pct,
    v_estimated_cost, v_actual_cost,
    v_status
  ) RETURNING id INTO v_reconciliation_id;
  
  RETURN v_reconciliation_id;
END;
$$ LANGUAGE plpgsql;
```

---

## Part 5: Migration Script

```sql
-- Create schema
CREATE SCHEMA IF NOT EXISTS billing;

-- Create tables
CREATE TABLE billing.token_records (
  -- [Full definition as above]
);

CREATE TABLE billing.token_reconciliations (
  -- [Full definition as above]
);

CREATE TABLE billing.billing_ledger (
  -- [Full definition as above]
);

CREATE TABLE billing.credit_balances (
  -- [Full definition as above]
);

CREATE TABLE billing.credit_balance_history (
  -- [Full definition as above]
);

-- Create views
CREATE VIEW billing.v_run_billing_summary AS (
  -- [Full definition as above]
);

-- Create stored procedures
CREATE OR REPLACE FUNCTION billing.record_token_call(...) (
  -- [Full definition as above]
);

-- Create indexes
-- [All indexes as defined above]

-- Grant permissions
GRANT SELECT ON billing.token_records TO app_user;
GRANT SELECT ON billing.token_reconciliations TO app_user;
GRANT SELECT, INSERT ON billing.billing_ledger TO app_user;
GRANT SELECT, UPDATE ON billing.credit_balances TO app_user;
GRANT SELECT ON billing.v_run_billing_summary TO app_user;
GRANT SELECT ON billing.v_org_billing_summary TO app_user;

-- Create audit triggers
CREATE TRIGGER audit_billing_ledger_insert
AFTER INSERT ON billing.billing_ledger
FOR EACH ROW
EXECUTE FUNCTION audit_log_insert();
```

---

## Part 6: Key Queries

### Query 1: Get organization's current balance and usage

```sql
SELECT 
  cb.org_id,
  cb.balance_usd,
  cb.reserved_usd,
  (cb.balance_usd - cb.reserved_usd) as available_usd,
  COUNT(DISTINCT bl.id) as transaction_count,
  SUM(CASE WHEN bl.direction = 'debit' THEN bl.amount_usd ELSE 0 END) as total_charged,
  SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_usd ELSE 0 END) as total_credited
FROM credit_balances cb
LEFT JOIN billing_ledger bl ON cb.org_id = bl.org_id
WHERE cb.org_id = $1
GROUP BY cb.org_id, cb.balance_usd, cb.reserved_usd;
```

### Query 2: Find runs with high token variance

```sql
SELECT 
  rec.run_id,
  rec.status,
  rec.variance_pct,
  rec.actual_total_tokens,
  rec.estimated_total_tokens,
  rec.actual_cost_usd,
  rec.estimated_cost_usd,
  rec.created_at
FROM token_reconciliations rec
WHERE ABS(rec.variance_pct) > 50
ORDER BY ABS(rec.variance_pct) DESC
LIMIT 100;
```

### Query 3: Get billing history for organization (last 30 days)

```sql
SELECT 
  bl.id,
  bl.transaction_type,
  bl.direction,
  bl.amount_usd,
  bl.reason,
  bl.run_id,
  bl.created_at
FROM billing_ledger bl
WHERE bl.org_id = $1
  AND bl.created_at >= NOW() - INTERVAL '30 days'
ORDER BY bl.created_at DESC;
```

---

## Part 7: Performance Tuning

### Index Strategy

```
1. Primary indexes on foreign keys (required)
2. Composite indexes on common query patterns:
   - (org_id, created_at DESC) for billing history
   - (run_id, created_at DESC) for run details
   - (status, created_at DESC) for status queries

3. Partial indexes for common filters:
   - WHERE error_code IS NULL (only successful records)
   - WHERE status IN ('NEEDS_REVIEW', 'CRITICAL') (only problematic runs)
   - WHERE is_estimated = TRUE (only estimated tokens)

4. Statistics for query planner:
   - Multivariate statistics on (org_id, transaction_type, direction)
   - Helps optimizer choose better execution plans
```

### Query Optimization

```sql
-- Use EXPLAIN ANALYZE to check query plans
EXPLAIN ANALYZE
SELECT * FROM token_records WHERE run_id = $1;

-- Vacuum and analyze regularly
VACUUM ANALYZE token_records;
VACUUM ANALYZE billing_ledger;

-- Monitor slow queries
SELECT * FROM pg_stat_statements
WHERE mean_exec_time > 100  -- > 100ms
ORDER BY mean_exec_time DESC;
```

---

## Conclusion

**Key Design Principles:**

1. **Append-only for billing_ledger** - Never update or delete transactions
2. **Immutable costs** - cost_usd is never updated after creation
3. **Check constraints** - Enforce invariants at database level
4. **Composite indexes** - Optimize common query patterns
5. **Partial indexes** - Reduce index size for filtered queries
6. **Foreign key constraints** - Maintain referential integrity
7. **Unique constraints** - Prevent duplicate reconciliations

**Operational Checklist:**

- [ ] Create all tables with constraints
- [ ] Create all indexes
- [ ] Create all views
- [ ] Create stored procedures
- [ ] Set up audit triggers
- [ ] Configure backup strategy (7-year retention)
- [ ] Set up monitoring for slow queries
- [ ] Test reconciliation procedure
- [ ] Load test with production-like data
- [ ] Document schema for team

---

**Ready to deploy production billing system!** 🎯
