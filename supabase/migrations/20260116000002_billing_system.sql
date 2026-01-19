-- Migration: Billing System Tables
-- Description: Creates billing ledger, token tracking, and credit balance tables
-- Spec: BILLING_SYSTEM_COMPLETE_SQL_SCHEMA.md

-- ============================================================================
-- Part 1: Token Records Table
-- ============================================================================
-- Tracks every LLM API call with token counts and costs

CREATE TABLE IF NOT EXISTS token_records (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization and Run Context
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    task_id UUID REFERENCES subtasks(id) ON DELETE SET NULL,
    step_id UUID,  -- Optional step reference within a task

    -- Idempotency (critical for preventing double-billing)
    idempotency_key VARCHAR(255) UNIQUE,

    -- Token Counts
    input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    total_tokens INTEGER NOT NULL GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

    -- Model Information
    model VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    provider VARCHAR(50) NOT NULL DEFAULT 'openai',
        -- 'openai', 'anthropic', 'google', 'azure'

    -- Cost
    cost_usd DECIMAL(12, 8) NOT NULL CHECK (cost_usd >= 0),
    input_cost_usd DECIMAL(12, 8) NOT NULL DEFAULT 0 CHECK (input_cost_usd >= 0),
    output_cost_usd DECIMAL(12, 8) NOT NULL DEFAULT 0 CHECK (output_cost_usd >= 0),

    -- Estimation vs Actual
    is_estimated BOOLEAN NOT NULL DEFAULT FALSE,
    estimation_method VARCHAR(50),
        -- 'tiktoken', 'character_ratio', 'model_estimate', NULL for actual

    -- Error Tracking
    error_code VARCHAR(50),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_cost_equals_sum
        CHECK (ABS(cost_usd - (input_cost_usd + output_cost_usd)) < 0.00000001),

    CONSTRAINT check_provider
        CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'local'))
);

-- Indexes for common queries
CREATE INDEX idx_token_records_org_id ON token_records(org_id, created_at DESC);
CREATE INDEX idx_token_records_run_id ON token_records(run_id, created_at DESC);
CREATE INDEX idx_token_records_agent_id ON token_records(agent_id);
CREATE INDEX idx_token_records_model ON token_records(model);
CREATE INDEX idx_token_records_created_at ON token_records(created_at DESC);
CREATE INDEX idx_token_records_idempotency ON token_records(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Partial index for estimated tokens (for reconciliation)
CREATE INDEX idx_token_records_estimated ON token_records(run_id, created_at DESC) WHERE is_estimated = TRUE;

-- Partial index for errors
CREATE INDEX idx_token_records_errors ON token_records(org_id, created_at DESC) WHERE error_code IS NOT NULL;


-- ============================================================================
-- Part 2: Token Reconciliations Table
-- ============================================================================
-- Reconciles estimated vs actual tokens for billing accuracy

CREATE TABLE IF NOT EXISTS token_reconciliations (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Run Reference (unique per run)
    run_id UUID NOT NULL UNIQUE REFERENCES agent_runs(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

    -- Estimated Tokens (from pre-run estimation)
    estimated_input_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_output_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_total_tokens INTEGER NOT NULL GENERATED ALWAYS AS (estimated_input_tokens + estimated_output_tokens) STORED,

    -- Actual Tokens (from token_records)
    actual_input_tokens INTEGER NOT NULL DEFAULT 0,
    actual_output_tokens INTEGER NOT NULL DEFAULT 0,
    actual_total_tokens INTEGER NOT NULL GENERATED ALWAYS AS (actual_input_tokens + actual_output_tokens) STORED,

    -- Variance
    variance_tokens INTEGER NOT NULL GENERATED ALWAYS AS
        ((actual_input_tokens + actual_output_tokens) - (estimated_input_tokens + estimated_output_tokens)) STORED,
    variance_pct DECIMAL(8, 2) NOT NULL DEFAULT 0,

    -- Costs
    estimated_cost_usd DECIMAL(12, 8) NOT NULL DEFAULT 0,
    actual_cost_usd DECIMAL(12, 8) NOT NULL DEFAULT 0,

    -- Reconciliation Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        -- 'PENDING': Not yet reconciled
        -- 'RECONCILED': Within tolerance (|variance_pct| <= 50%)
        -- 'NEEDS_REVIEW': Above tolerance (50% < |variance_pct| <= 100%)
        -- 'CRITICAL': Far above tolerance (|variance_pct| > 100%)
        -- 'DISPUTED': User disputed the charges

    -- Resolution
    refund_amount_usd DECIMAL(12, 8) DEFAULT 0,
    charge_amount_usd DECIMAL(12, 8) DEFAULT 0,
    resolution_notes TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_reconciliation_status
        CHECK (status IN ('PENDING', 'RECONCILED', 'NEEDS_REVIEW', 'CRITICAL', 'DISPUTED'))
);

-- Indexes
CREATE INDEX idx_token_reconciliations_org_id ON token_reconciliations(org_id, created_at DESC);
CREATE INDEX idx_token_reconciliations_status ON token_reconciliations(status) WHERE status != 'RECONCILED';
CREATE INDEX idx_token_reconciliations_variance ON token_reconciliations(variance_pct DESC) WHERE ABS(variance_pct) > 50;


-- ============================================================================
-- Part 3: Billing Ledger Table (Append-Only)
-- ============================================================================
-- Immutable transaction log for all billing events

CREATE TABLE IF NOT EXISTS billing_ledger (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

    -- Transaction Type
    transaction_type VARCHAR(50) NOT NULL,
        -- 'credit_purchase': User bought credits
        -- 'charge': Deducted for API usage
        -- 'refund': Refunded for overcharge or error
        -- 'adjustment': Manual adjustment by support
        -- 'promo': Promotional credit
        -- 'trial': Trial credit

    -- Amount (always positive, direction determines sign)
    amount_usd DECIMAL(12, 8) NOT NULL CHECK (amount_usd > 0),

    -- Direction
    direction VARCHAR(10) NOT NULL,
        -- 'debit': Decreases balance (charges)
        -- 'credit': Increases balance (purchases, refunds)

    -- Context References
    run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    task_id UUID REFERENCES subtasks(id) ON DELETE SET NULL,
    token_record_id UUID REFERENCES token_records(id) ON DELETE SET NULL,

    -- Description
    reason VARCHAR(255) NOT NULL,

    -- Idempotency
    idempotency_key VARCHAR(255) UNIQUE,

    -- Metadata
    created_by VARCHAR(100),
        -- 'system': Automated
        -- 'support': Manual by support team
        -- 'user': User initiated
        -- user_id: Specific user

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_transaction_type
        CHECK (transaction_type IN ('credit_purchase', 'charge', 'refund', 'adjustment', 'promo', 'trial')),

    CONSTRAINT check_direction
        CHECK (direction IN ('debit', 'credit')),

    CONSTRAINT check_direction_matches_type
        CHECK (
            (transaction_type = 'charge' AND direction = 'debit') OR
            (transaction_type IN ('refund', 'credit_purchase', 'promo', 'trial') AND direction = 'credit') OR
            (transaction_type = 'adjustment' AND direction IN ('debit', 'credit'))
        )
);

-- Indexes for billing_ledger
CREATE INDEX idx_billing_ledger_org_id ON billing_ledger(org_id, created_at DESC);
CREATE INDEX idx_billing_ledger_created_at ON billing_ledger(created_at DESC);
CREATE INDEX idx_billing_ledger_transaction_type ON billing_ledger(transaction_type);
CREATE INDEX idx_billing_ledger_run_id ON billing_ledger(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX idx_billing_ledger_idempotency ON billing_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Partial indexes for common queries
CREATE INDEX idx_billing_ledger_charges ON billing_ledger(org_id, created_at DESC) WHERE transaction_type = 'charge';
CREATE INDEX idx_billing_ledger_refunds ON billing_ledger(org_id, created_at DESC) WHERE transaction_type = 'refund';


-- ============================================================================
-- Part 4: Credit Balances Table
-- ============================================================================
-- Current credit balance per organization

CREATE TABLE IF NOT EXISTS credit_balances (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization (one balance per org)
    org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

    -- Balance
    balance_usd DECIMAL(12, 8) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),

    -- Reserved Credits (for in-progress runs)
    reserved_usd DECIMAL(12, 8) NOT NULL DEFAULT 0 CHECK (reserved_usd >= 0),

    -- Low Balance Warning Threshold
    low_balance_threshold_usd DECIMAL(12, 8) NOT NULL DEFAULT 10.00,

    -- Auto-recharge Settings
    auto_recharge_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    auto_recharge_amount_usd DECIMAL(12, 8),
    auto_recharge_threshold_usd DECIMAL(12, 8),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX idx_credit_balances_org_id ON credit_balances(org_id);
CREATE INDEX idx_credit_balances_low_balance ON credit_balances(org_id)
    WHERE balance_usd < low_balance_threshold_usd;


-- ============================================================================
-- Part 5: Credit Balance History Table
-- ============================================================================
-- Historical balance changes for audit

CREATE TABLE IF NOT EXISTS credit_balance_history (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Balance Before and After
    balance_before_usd DECIMAL(12, 8) NOT NULL,
    balance_after_usd DECIMAL(12, 8) NOT NULL,

    -- Change
    change_usd DECIMAL(12, 8) NOT NULL,

    -- Reason
    reason VARCHAR(255) NOT NULL,

    -- Reference to billing ledger entry
    billing_ledger_id UUID REFERENCES billing_ledger(id) ON DELETE SET NULL,

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_credit_balance_history_org_id ON credit_balance_history(org_id, created_at DESC);


-- ============================================================================
-- Part 6: Model Pricing Table
-- ============================================================================
-- Pricing per model and provider

CREATE TABLE IF NOT EXISTS model_pricing (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Model Identification
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,

    -- Pricing (per 1M tokens)
    input_price_per_million DECIMAL(12, 6) NOT NULL,
    output_price_per_million DECIMAL(12, 6) NOT NULL,

    -- Effective Date Range
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP WITH TIME ZONE,  -- NULL means currently active

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_model_provider_effective
        UNIQUE (model, provider, effective_from)
);

-- Index for pricing lookup
CREATE INDEX idx_model_pricing_lookup ON model_pricing(model, provider, effective_from DESC);

-- Insert default pricing for common models
INSERT INTO model_pricing (model, provider, input_price_per_million, output_price_per_million) VALUES
    -- OpenAI GPT-4 series
    ('gpt-4o', 'openai', 2.50, 10.00),
    ('gpt-4o-mini', 'openai', 0.15, 0.60),
    ('gpt-4-turbo', 'openai', 10.00, 30.00),
    ('gpt-4', 'openai', 30.00, 60.00),
    ('gpt-3.5-turbo', 'openai', 0.50, 1.50),

    -- Anthropic Claude series
    ('claude-3-5-sonnet-20241022', 'anthropic', 3.00, 15.00),
    ('claude-3-5-haiku-20241022', 'anthropic', 0.80, 4.00),
    ('claude-3-opus-20240229', 'anthropic', 15.00, 75.00),
    ('claude-3-sonnet-20240229', 'anthropic', 3.00, 15.00),
    ('claude-3-haiku-20240307', 'anthropic', 0.25, 1.25),

    -- Google Gemini series
    ('gemini-1.5-pro', 'google', 1.25, 5.00),
    ('gemini-1.5-flash', 'google', 0.075, 0.30),
    ('gemini-1.0-pro', 'google', 0.50, 1.50)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Part 7: Rate Limiting Table
-- ============================================================================
-- Track API usage for rate limiting

CREATE TABLE IF NOT EXISTS rate_limit_counters (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Time Window
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Counters
    request_count INTEGER NOT NULL DEFAULT 0,
    token_count BIGINT NOT NULL DEFAULT 0,

    -- Limits
    request_limit INTEGER NOT NULL DEFAULT 1000,  -- Per minute
    token_limit BIGINT NOT NULL DEFAULT 100000,   -- Per minute

    -- Unique per org per window
    CONSTRAINT unique_org_window UNIQUE (org_id, window_start)
);

-- Index for cleanup
CREATE INDEX idx_rate_limit_counters_window ON rate_limit_counters(window_end);


-- ============================================================================
-- Part 8: Stored Procedures
-- ============================================================================

-- Function: Record Token Call (Main billing function)
CREATE OR REPLACE FUNCTION record_token_call(
    p_org_id UUID,
    p_run_id UUID,
    p_agent_id UUID,
    p_task_id UUID,
    p_step_id UUID,
    p_idempotency_key VARCHAR(255),
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_model VARCHAR(100),
    p_provider VARCHAR(50),
    p_is_estimated BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
    success BOOLEAN,
    token_record_id UUID,
    cost_usd DECIMAL(12, 8),
    new_balance_usd DECIMAL(12, 8),
    error_code VARCHAR(50),
    error_message TEXT
) AS $$
DECLARE
    v_input_price DECIMAL(12, 6);
    v_output_price DECIMAL(12, 6);
    v_input_cost DECIMAL(12, 8);
    v_output_cost DECIMAL(12, 8);
    v_total_cost DECIMAL(12, 8);
    v_token_record_id UUID;
    v_ledger_id UUID;
    v_current_balance DECIMAL(12, 8);
    v_new_balance DECIMAL(12, 8);
    v_existing_record UUID;
BEGIN
    -- Phase 1: Check idempotency
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_record
        FROM token_records
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_record IS NOT NULL THEN
            -- Return existing record (idempotent replay)
            RETURN QUERY
            SELECT
                TRUE,
                tr.id,
                tr.cost_usd,
                cb.balance_usd,
                NULL::VARCHAR(50),
                NULL::TEXT
            FROM token_records tr
            JOIN credit_balances cb ON cb.org_id = tr.org_id
            WHERE tr.id = v_existing_record;
            RETURN;
        END IF;
    END IF;

    -- Phase 2: Get pricing
    SELECT input_price_per_million, output_price_per_million
    INTO v_input_price, v_output_price
    FROM model_pricing
    WHERE model = p_model
        AND provider = COALESCE(p_provider, 'openai')
        AND effective_from <= CURRENT_TIMESTAMP
        AND (effective_until IS NULL OR effective_until > CURRENT_TIMESTAMP)
    ORDER BY effective_from DESC
    LIMIT 1;

    -- Fallback pricing if model not found
    IF v_input_price IS NULL THEN
        v_input_price := 5.00;  -- Conservative fallback
        v_output_price := 15.00;
    END IF;

    -- Phase 3: Calculate cost
    v_input_cost := (p_input_tokens::DECIMAL / 1000000) * v_input_price;
    v_output_cost := (p_output_tokens::DECIMAL / 1000000) * v_output_price;
    v_total_cost := v_input_cost + v_output_cost;

    -- Phase 4: Check balance (with row lock)
    SELECT balance_usd INTO v_current_balance
    FROM credit_balances
    WHERE org_id = p_org_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        -- Create balance record if doesn't exist
        INSERT INTO credit_balances (org_id, balance_usd)
        VALUES (p_org_id, 0)
        ON CONFLICT (org_id) DO NOTHING
        RETURNING balance_usd INTO v_current_balance;

        IF v_current_balance IS NULL THEN
            SELECT balance_usd INTO v_current_balance
            FROM credit_balances WHERE org_id = p_org_id FOR UPDATE;
        END IF;
    END IF;

    -- Check sufficient balance (allow negative for now, will flag for review)
    v_new_balance := v_current_balance - v_total_cost;

    -- Phase 5: Insert token record
    INSERT INTO token_records (
        org_id, run_id, agent_id, task_id, step_id,
        idempotency_key,
        input_tokens, output_tokens,
        model, provider,
        cost_usd, input_cost_usd, output_cost_usd,
        is_estimated
    ) VALUES (
        p_org_id, p_run_id, p_agent_id, p_task_id, p_step_id,
        p_idempotency_key,
        p_input_tokens, p_output_tokens,
        p_model, COALESCE(p_provider, 'openai'),
        v_total_cost, v_input_cost, v_output_cost,
        p_is_estimated
    ) RETURNING id INTO v_token_record_id;

    -- Phase 6: Insert billing ledger entry
    INSERT INTO billing_ledger (
        org_id,
        transaction_type,
        amount_usd,
        direction,
        run_id,
        agent_id,
        task_id,
        token_record_id,
        reason,
        idempotency_key,
        created_by
    ) VALUES (
        p_org_id,
        'charge',
        v_total_cost,
        'debit',
        p_run_id,
        p_agent_id,
        p_task_id,
        v_token_record_id,
        'LLM API call: ' || p_model || ' (' || p_input_tokens || ' in / ' || p_output_tokens || ' out)',
        'charge:' || COALESCE(p_idempotency_key, v_token_record_id::TEXT),
        'system'
    ) RETURNING id INTO v_ledger_id;

    -- Phase 7: Update balance
    UPDATE credit_balances
    SET
        balance_usd = v_new_balance,
        updated_at = CURRENT_TIMESTAMP
    WHERE org_id = p_org_id;

    -- Phase 8: Record balance history
    INSERT INTO credit_balance_history (
        org_id,
        balance_before_usd,
        balance_after_usd,
        change_usd,
        reason,
        billing_ledger_id
    ) VALUES (
        p_org_id,
        v_current_balance,
        v_new_balance,
        -v_total_cost,
        'LLM API charge',
        v_ledger_id
    );

    -- Return success
    RETURN QUERY
    SELECT
        TRUE,
        v_token_record_id,
        v_total_cost,
        v_new_balance,
        NULL::VARCHAR(50),
        NULL::TEXT;

EXCEPTION
    WHEN unique_violation THEN
        -- Handle race condition on idempotency key
        RETURN QUERY
        SELECT
            TRUE,
            tr.id,
            tr.cost_usd,
            cb.balance_usd,
            NULL::VARCHAR(50),
            NULL::TEXT
        FROM token_records tr
        JOIN credit_balances cb ON cb.org_id = tr.org_id
        WHERE tr.idempotency_key = p_idempotency_key;

    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            FALSE,
            NULL::UUID,
            NULL::DECIMAL(12, 8),
            NULL::DECIMAL(12, 8),
            SQLSTATE,
            SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- Function: Add Credits
CREATE OR REPLACE FUNCTION add_credits(
    p_org_id UUID,
    p_amount_usd DECIMAL(12, 8),
    p_transaction_type VARCHAR(50),
    p_reason VARCHAR(255),
    p_idempotency_key VARCHAR(255) DEFAULT NULL,
    p_created_by VARCHAR(100) DEFAULT 'system'
) RETURNS TABLE (
    success BOOLEAN,
    ledger_id UUID,
    new_balance_usd DECIMAL(12, 8),
    error_message TEXT
) AS $$
DECLARE
    v_ledger_id UUID;
    v_current_balance DECIMAL(12, 8);
    v_new_balance DECIMAL(12, 8);
    v_existing_ledger UUID;
BEGIN
    -- Validate transaction type allows credit direction
    IF p_transaction_type NOT IN ('credit_purchase', 'refund', 'promo', 'trial', 'adjustment') THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::DECIMAL(12, 8), 'Invalid transaction type for credit';
        RETURN;
    END IF;

    -- Check idempotency
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_ledger
        FROM billing_ledger
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_ledger IS NOT NULL THEN
            RETURN QUERY
            SELECT
                TRUE,
                v_existing_ledger,
                cb.balance_usd,
                NULL::TEXT
            FROM credit_balances cb
            WHERE cb.org_id = p_org_id;
            RETURN;
        END IF;
    END IF;

    -- Get current balance with lock
    SELECT balance_usd INTO v_current_balance
    FROM credit_balances
    WHERE org_id = p_org_id
    FOR UPDATE;

    -- Create balance if doesn't exist
    IF v_current_balance IS NULL THEN
        INSERT INTO credit_balances (org_id, balance_usd)
        VALUES (p_org_id, 0)
        ON CONFLICT (org_id) DO NOTHING;
        v_current_balance := 0;
    END IF;

    v_new_balance := v_current_balance + p_amount_usd;

    -- Insert ledger entry
    INSERT INTO billing_ledger (
        org_id,
        transaction_type,
        amount_usd,
        direction,
        reason,
        idempotency_key,
        created_by
    ) VALUES (
        p_org_id,
        p_transaction_type,
        p_amount_usd,
        'credit',
        p_reason,
        p_idempotency_key,
        p_created_by
    ) RETURNING id INTO v_ledger_id;

    -- Update balance
    UPDATE credit_balances
    SET
        balance_usd = v_new_balance,
        updated_at = CURRENT_TIMESTAMP
    WHERE org_id = p_org_id;

    -- Record history
    INSERT INTO credit_balance_history (
        org_id,
        balance_before_usd,
        balance_after_usd,
        change_usd,
        reason,
        billing_ledger_id
    ) VALUES (
        p_org_id,
        v_current_balance,
        v_new_balance,
        p_amount_usd,
        p_reason,
        v_ledger_id
    );

    RETURN QUERY SELECT TRUE, v_ledger_id, v_new_balance, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::DECIMAL(12, 8), SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- Function: Get Organization Balance
CREATE OR REPLACE FUNCTION get_org_balance(p_org_id UUID)
RETURNS TABLE (
    balance_usd DECIMAL(12, 8),
    reserved_usd DECIMAL(12, 8),
    available_usd DECIMAL(12, 8)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cb.balance_usd,
        cb.reserved_usd,
        (cb.balance_usd - cb.reserved_usd) as available_usd
    FROM credit_balances cb
    WHERE cb.org_id = p_org_id;
END;
$$ LANGUAGE plpgsql;


-- Function: Reconcile Run
CREATE OR REPLACE FUNCTION reconcile_run(p_run_id UUID)
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
    v_estimated_input INTEGER;
    v_estimated_output INTEGER;
    v_actual_input INTEGER;
    v_actual_output INTEGER;
    v_estimated_cost DECIMAL(12, 8);
    v_actual_cost DECIMAL(12, 8);
    v_variance_pct DECIMAL(8, 2);
    v_status VARCHAR(20);
    v_reconciliation_id UUID;
BEGIN
    -- Get run's org
    SELECT organization_id INTO v_org_id
    FROM agent_runs WHERE id = p_run_id;

    -- Get estimated tokens (from estimated records)
    SELECT
        COALESCE(SUM(input_tokens), 0),
        COALESCE(SUM(output_tokens), 0),
        COALESCE(SUM(cost_usd), 0)
    INTO v_estimated_input, v_estimated_output, v_estimated_cost
    FROM token_records
    WHERE run_id = p_run_id AND is_estimated = TRUE;

    -- Get actual tokens
    SELECT
        COALESCE(SUM(input_tokens), 0),
        COALESCE(SUM(output_tokens), 0),
        COALESCE(SUM(cost_usd), 0)
    INTO v_actual_input, v_actual_output, v_actual_cost
    FROM token_records
    WHERE run_id = p_run_id AND is_estimated = FALSE;

    -- Calculate variance
    IF (v_estimated_input + v_estimated_output) > 0 THEN
        v_variance_pct := (((v_actual_input + v_actual_output) - (v_estimated_input + v_estimated_output))::DECIMAL
            / (v_estimated_input + v_estimated_output)) * 100;
    ELSE
        v_variance_pct := 0;
    END IF;

    -- Determine status
    v_status := CASE
        WHEN ABS(v_variance_pct) <= 50 THEN 'RECONCILED'
        WHEN ABS(v_variance_pct) <= 100 THEN 'NEEDS_REVIEW'
        ELSE 'CRITICAL'
    END;

    -- Insert reconciliation
    INSERT INTO token_reconciliations (
        run_id,
        org_id,
        estimated_input_tokens,
        estimated_output_tokens,
        actual_input_tokens,
        actual_output_tokens,
        variance_pct,
        estimated_cost_usd,
        actual_cost_usd,
        status
    ) VALUES (
        p_run_id,
        v_org_id,
        v_estimated_input,
        v_estimated_output,
        v_actual_input,
        v_actual_output,
        v_variance_pct,
        v_estimated_cost,
        v_actual_cost,
        v_status
    )
    ON CONFLICT (run_id) DO UPDATE SET
        actual_input_tokens = EXCLUDED.actual_input_tokens,
        actual_output_tokens = EXCLUDED.actual_output_tokens,
        variance_pct = EXCLUDED.variance_pct,
        actual_cost_usd = EXCLUDED.actual_cost_usd,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_reconciliation_id;

    RETURN v_reconciliation_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Part 9: Views
-- ============================================================================

-- View: Run Billing Summary
CREATE OR REPLACE VIEW v_run_billing_summary AS
SELECT
    r.id as run_id,
    r.organization_id as org_id,
    r.status,
    r.created_at,
    r.completed_at,

    -- Token Counts
    COALESCE(SUM(tr.input_tokens) FILTER (WHERE NOT tr.is_estimated), 0) as actual_input_tokens,
    COALESCE(SUM(tr.output_tokens) FILTER (WHERE NOT tr.is_estimated), 0) as actual_output_tokens,
    COALESCE(SUM(tr.input_tokens + tr.output_tokens) FILTER (WHERE NOT tr.is_estimated), 0) as actual_total_tokens,

    -- Costs
    COALESCE(SUM(tr.cost_usd) FILTER (WHERE NOT tr.is_estimated), 0) as actual_cost_usd,

    -- Reconciliation
    rec.status as reconciliation_status,
    rec.variance_pct

FROM agent_runs r
LEFT JOIN token_records tr ON r.id = tr.run_id
LEFT JOIN token_reconciliations rec ON r.id = rec.run_id
GROUP BY r.id, rec.id;


-- View: Organization Billing Summary
CREATE OR REPLACE VIEW v_org_billing_summary AS
SELECT
    cb.org_id,
    cb.balance_usd as current_balance_usd,
    cb.reserved_usd,
    (cb.balance_usd - cb.reserved_usd) as available_usd,

    -- Transaction counts
    COUNT(DISTINCT bl.id) FILTER (WHERE bl.transaction_type = 'charge') as charge_count,
    COUNT(DISTINCT bl.id) FILTER (WHERE bl.transaction_type = 'refund') as refund_count,

    -- Amounts
    COALESCE(SUM(bl.amount_usd) FILTER (WHERE bl.direction = 'debit'), 0) as total_charged_usd,
    COALESCE(SUM(bl.amount_usd) FILTER (WHERE bl.direction = 'credit'), 0) as total_credited_usd,

    -- Date Range
    MIN(bl.created_at) as first_transaction_at,
    MAX(bl.created_at) as last_transaction_at

FROM credit_balances cb
LEFT JOIN billing_ledger bl ON cb.org_id = bl.org_id
GROUP BY cb.org_id, cb.balance_usd, cb.reserved_usd;


-- ============================================================================
-- Part 10: Triggers
-- ============================================================================

-- Trigger: Update updated_at on credit_balances
CREATE OR REPLACE FUNCTION update_credit_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_credit_balances_updated_at
    BEFORE UPDATE ON credit_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_balances_updated_at();

-- Trigger: Update updated_at on token_reconciliations
CREATE TRIGGER trigger_token_reconciliations_updated_at
    BEFORE UPDATE ON token_reconciliations
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_balances_updated_at();


-- ============================================================================
-- Part 11: Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all billing tables
ALTER TABLE token_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balance_history ENABLE ROW LEVEL SECURITY;

-- Policies for token_records
CREATE POLICY "Users can view own org token records"
    ON token_records FOR SELECT
    USING (org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Policies for billing_ledger
CREATE POLICY "Users can view own org billing ledger"
    ON billing_ledger FOR SELECT
    USING (org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Policies for credit_balances
CREATE POLICY "Users can view own org balance"
    ON credit_balances FOR SELECT
    USING (org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Policies for credit_balance_history
CREATE POLICY "Users can view own org balance history"
    ON credit_balance_history FOR SELECT
    USING (org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));


-- ============================================================================
-- Done
-- ============================================================================
