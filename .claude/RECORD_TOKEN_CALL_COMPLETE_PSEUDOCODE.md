# `record_token_call()` Complete 8-Phase Pseudocode

**From:** Manus Billing Engineering  
**Purpose:** Full implementation pseudocode with error handling and fallback logic  
**Audience:** Database engineers implementing billing system

---

## Function Signature

```sql
CREATE OR REPLACE FUNCTION billing.record_token_call(
  -- Required Parameters
  p_run_id UUID,
  p_step_id UUID,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_model VARCHAR(100),
  p_org_id UUID,
  
  -- Optional Parameters
  p_agent_id UUID DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_idempotency_key VARCHAR(255) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS TABLE (
  record_id UUID,
  total_tokens INTEGER,
  cost_usd DECIMAL(12, 8),
  status VARCHAR(50),
  error_code VARCHAR(50),
  error_message TEXT,
  pricing_source VARCHAR(50),
  balance_remaining DECIMAL(12, 8)
) AS $$
```

---

## Phase 0: Variable Declarations

```sql
DECLARE
  -- Token calculations
  v_total_tokens INTEGER;
  
  -- Pricing
  v_input_price DECIMAL(10, 8);
  v_output_price DECIMAL(10, 8);
  v_pricing_source VARCHAR(50);  -- 'cache', 'database', 'fallback'
  v_pricing_effective_date DATE;
  
  -- Cost calculations
  v_base_cost DECIMAL(12, 8);
  v_surcharge_cost DECIMAL(12, 8);
  v_total_cost DECIMAL(12, 8);
  
  -- Balance
  v_current_balance DECIMAL(12, 8);
  v_reserved_balance DECIMAL(12, 8);
  v_available_balance DECIMAL(12, 8);
  v_balance_after DECIMAL(12, 8);
  
  -- Record
  v_record_id UUID;
  v_existing_record_id UUID;
  
  -- Status
  v_status VARCHAR(50);
  v_error_code VARCHAR(50);
  v_error_message TEXT;
  
  -- Rate limiting
  v_rate_limit_allowed BOOLEAN;
  v_rate_limit_retry_after INTEGER;
  
  -- Surcharges
  v_surcharge RECORD;
  
  -- Timing
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_execution_time_ms INTEGER;
  
  -- Constants
  c_fallback_input_price CONSTANT DECIMAL := 0.001;
  c_fallback_output_price CONSTANT DECIMAL := 0.003;
  c_max_cost_per_call CONSTANT DECIMAL := 100.00;  -- $100 max per call
  c_min_balance_threshold CONSTANT DECIMAL := 0.01;  -- $0.01 minimum
  
BEGIN
  -- Record start time for metrics
  v_start_time := clock_timestamp();
  
  -- Initialize status
  v_status := 'PENDING';
  v_error_code := NULL;
  v_error_message := NULL;
  v_pricing_source := 'unknown';
```

---

## Phase 1: Validation

```sql
  -- ================================================================
  -- PHASE 1: VALIDATION
  -- ================================================================
  -- Purpose: Validate all inputs before any database operations
  -- Failure Mode: Return immediately with error status
  -- ================================================================
  
  -- 1.1: Validate input_tokens
  IF p_input_tokens IS NULL THEN
    v_status := 'ERROR';
    v_error_code := 'NULL_INPUT_TOKENS';
    v_error_message := 'input_tokens cannot be NULL';
    
    -- Log validation error
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'input_tokens', NULL, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  IF p_input_tokens < 0 THEN
    v_status := 'ERROR';
    v_error_code := 'NEGATIVE_INPUT_TOKENS';
    v_error_message := 'input_tokens cannot be negative: ' || p_input_tokens;
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'input_tokens', p_input_tokens::TEXT, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 1.2: Validate output_tokens
  IF p_output_tokens IS NULL THEN
    v_status := 'ERROR';
    v_error_code := 'NULL_OUTPUT_TOKENS';
    v_error_message := 'output_tokens cannot be NULL';
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'output_tokens', NULL, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  IF p_output_tokens < 0 THEN
    v_status := 'ERROR';
    v_error_code := 'NEGATIVE_OUTPUT_TOKENS';
    v_error_message := 'output_tokens cannot be negative: ' || p_output_tokens;
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'output_tokens', p_output_tokens::TEXT, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 1.3: Validate model
  IF p_model IS NULL OR TRIM(p_model) = '' THEN
    v_status := 'ERROR';
    v_error_code := 'NULL_MODEL';
    v_error_message := 'model cannot be NULL or empty';
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'model', p_model, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 1.4: Validate run_id exists
  IF NOT EXISTS (SELECT 1 FROM runs WHERE id = p_run_id) THEN
    v_status := 'ERROR';
    v_error_code := 'RUN_NOT_FOUND';
    v_error_message := 'run_id not found: ' || p_run_id;
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'run_id', p_run_id::TEXT, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 1.5: Validate step_id exists
  IF NOT EXISTS (SELECT 1 FROM steps WHERE id = p_step_id) THEN
    v_status := 'ERROR';
    v_error_code := 'STEP_NOT_FOUND';
    v_error_message := 'step_id not found: ' || p_step_id;
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'step_id', p_step_id::TEXT, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 1.6: Validate org_id exists
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id) THEN
    v_status := 'ERROR';
    v_error_code := 'ORG_NOT_FOUND';
    v_error_message := 'org_id not found: ' || p_org_id;
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'org_id', p_org_id::TEXT, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 1.7: Validate agent_id if provided
  IF p_agent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id) THEN
    v_status := 'ERROR';
    v_error_code := 'AGENT_NOT_FOUND';
    v_error_message := 'agent_id not found: ' || p_agent_id;
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'agent_id', p_agent_id::TEXT, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 1.8: Validate task_id if provided
  IF p_task_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tasks WHERE id = p_task_id) THEN
    v_status := 'ERROR';
    v_error_code := 'TASK_NOT_FOUND';
    v_error_message := 'task_id not found: ' || p_task_id;
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'task_id', p_task_id::TEXT, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 1.9: Check idempotency key (if provided)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_record_id
    FROM billing.token_records
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_record_id IS NOT NULL THEN
      -- Return existing record (idempotent)
      RETURN QUERY SELECT 
        tr.id,
        tr.total_tokens,
        tr.cost_usd,
        'IDEMPOTENT'::VARCHAR,
        NULL::VARCHAR,
        'Returning existing record for idempotency_key'::TEXT,
        'cached'::VARCHAR,
        (SELECT balance_usd - reserved_usd FROM billing.credit_balances WHERE org_id = p_org_id)
      FROM billing.token_records tr
      WHERE tr.id = v_existing_record_id;
      RETURN;
    END IF;
  END IF;
  
  -- Calculate total tokens
  v_total_tokens := p_input_tokens + p_output_tokens;
  
  -- 1.10: Validate total tokens is reasonable
  IF v_total_tokens > 10000000 THEN  -- 10M tokens max per call
    v_status := 'ERROR';
    v_error_code := 'EXCESSIVE_TOKENS';
    v_error_message := 'total_tokens exceeds maximum: ' || v_total_tokens || ' > 10000000';
    
    INSERT INTO billing.validation_errors (
      procedure_name, parameter_name, parameter_value, error_code, error_message
    ) VALUES (
      'record_token_call', 'total_tokens', v_total_tokens::TEXT, v_error_code, v_error_message
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, v_total_tokens, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
```

---

## Phase 2: Rate Limiting

```sql
  -- ================================================================
  -- PHASE 2: RATE LIMITING
  -- ================================================================
  -- Purpose: Check and enforce rate limits before processing
  -- Failure Mode: Return with rate limit error and retry_after
  -- ================================================================
  
  -- 2.1: Check rate limit
  SELECT allowed, retry_after_seconds
  INTO v_rate_limit_allowed, v_rate_limit_retry_after
  FROM billing.check_rate_limit(p_org_id, v_total_tokens);
  
  IF NOT v_rate_limit_allowed THEN
    v_status := 'RATE_LIMITED';
    v_error_code := 'RATE_LIMIT_EXCEEDED';
    v_error_message := 'Rate limit exceeded. Retry after ' || v_rate_limit_retry_after || ' seconds';
    
    -- Log rate limit hit
    INSERT INTO billing.rate_limit_events (
      org_id, tokens_requested, retry_after_seconds
    ) VALUES (
      p_org_id, v_total_tokens, v_rate_limit_retry_after
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, v_total_tokens, 0::DECIMAL(12,8), v_status, v_error_code, v_error_message,
      NULL::VARCHAR, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 2.2: Update rate limit counters
  INSERT INTO billing.token_call_rate_limit (
    org_id, time_window, call_count, token_count, window_start, window_end
  ) VALUES (
    p_org_id, '1s', 1, v_total_tokens, 
    date_trunc('second', CURRENT_TIMESTAMP),
    date_trunc('second', CURRENT_TIMESTAMP) + INTERVAL '1 second'
  )
  ON CONFLICT (org_id, time_window, window_start) DO UPDATE SET
    call_count = billing.token_call_rate_limit.call_count + 1,
    token_count = billing.token_call_rate_limit.token_count + v_total_tokens;
```

---

## Phase 3: Fetch Pricing

```sql
  -- ================================================================
  -- PHASE 3: FETCH PRICING
  -- ================================================================
  -- Purpose: Get current pricing for the model
  -- Fallback: Use default pricing if model not found
  -- ================================================================
  
  -- 3.1: Try to get pricing from database
  SELECT 
    input_price_per_1k_tokens,
    output_price_per_1k_tokens,
    effective_date
  INTO 
    v_input_price,
    v_output_price,
    v_pricing_effective_date
  FROM billing.model_pricing
  WHERE model_name = p_model
    AND effective_date <= CURRENT_DATE
    AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
  ORDER BY effective_date DESC
  LIMIT 1;
  
  -- 3.2: Check if pricing was found
  IF v_input_price IS NOT NULL THEN
    v_pricing_source := 'database';
  ELSE
    -- 3.3: Try normalized model name (remove version suffixes)
    SELECT 
      input_price_per_1k_tokens,
      output_price_per_1k_tokens,
      effective_date
    INTO 
      v_input_price,
      v_output_price,
      v_pricing_effective_date
    FROM billing.model_pricing
    WHERE model_name = REGEXP_REPLACE(p_model, '-\d{4}-\d{2}-\d{2}$', '')  -- Remove date suffix
      AND effective_date <= CURRENT_DATE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    ORDER BY effective_date DESC
    LIMIT 1;
    
    IF v_input_price IS NOT NULL THEN
      v_pricing_source := 'database_normalized';
    END IF;
  END IF;
  
  -- 3.4: Try model family fallback (e.g., gpt-4-turbo -> gpt-4)
  IF v_input_price IS NULL THEN
    SELECT 
      input_price_per_1k_tokens,
      output_price_per_1k_tokens,
      effective_date
    INTO 
      v_input_price,
      v_output_price,
      v_pricing_effective_date
    FROM billing.model_pricing
    WHERE p_model LIKE model_name || '%'  -- Model starts with known model
      AND effective_date <= CURRENT_DATE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    ORDER BY LENGTH(model_name) DESC, effective_date DESC  -- Longest match first
    LIMIT 1;
    
    IF v_input_price IS NOT NULL THEN
      v_pricing_source := 'database_family';
    END IF;
  END IF;
  
  -- 3.5: Use fallback pricing if still not found
  IF v_input_price IS NULL THEN
    v_input_price := c_fallback_input_price;
    v_output_price := c_fallback_output_price;
    v_pricing_source := 'fallback';
    v_pricing_effective_date := CURRENT_DATE;
    
    -- Log pricing lookup failure
    INSERT INTO billing.pricing_lookup_errors (
      model_name, lookup_date, error_reason, fallback_used
    ) VALUES (
      p_model, CURRENT_DATE, 'pricing_not_found', TRUE
    );
    
    -- Set warning in error_message (but don't fail)
    v_error_message := 'WARNING: Using fallback pricing for unknown model: ' || p_model;
  END IF;
  
  -- 3.6: Log pricing lookup for audit
  INSERT INTO billing.pricing_lookups (
    model_name, lookup_date, input_price, output_price, source, effective_date
  ) VALUES (
    p_model, CURRENT_DATE, v_input_price, v_output_price, v_pricing_source, v_pricing_effective_date
  );
```

---

## Phase 4: Calculate Cost

```sql
  -- ================================================================
  -- PHASE 4: CALCULATE COST
  -- ================================================================
  -- Purpose: Calculate total cost including surcharges
  -- Precision: DECIMAL(12, 8) - 8 decimal places
  -- ================================================================
  
  -- 4.1: Calculate base cost
  v_base_cost := ROUND(
    (p_input_tokens::DECIMAL / 1000.0) * v_input_price +
    (p_output_tokens::DECIMAL / 1000.0) * v_output_price,
    8
  );
  
  -- 4.2: Initialize surcharge cost
  v_surcharge_cost := 0;
  
  -- 4.3: Apply percentage surcharges
  FOR v_surcharge IN (
    SELECT 
      surcharge_name,
      surcharge_value
    FROM billing.cost_surcharges
    WHERE surcharge_type = 'percentage'
      AND (model_name IS NULL OR model_name = p_model)
      AND (org_id IS NULL OR org_id = p_org_id)
      AND effective_date <= CURRENT_DATE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
  ) LOOP
    v_surcharge_cost := v_surcharge_cost + ROUND(v_base_cost * v_surcharge.surcharge_value, 8);
    
    -- Log surcharge application
    INSERT INTO billing.surcharge_applications (
      run_id, step_id, surcharge_name, surcharge_type, base_cost, surcharge_amount
    ) VALUES (
      p_run_id, p_step_id, v_surcharge.surcharge_name, 'percentage', v_base_cost,
      ROUND(v_base_cost * v_surcharge.surcharge_value, 8)
    );
  END LOOP;
  
  -- 4.4: Apply fixed surcharges (per token)
  FOR v_surcharge IN (
    SELECT 
      surcharge_name,
      surcharge_value
    FROM billing.cost_surcharges
    WHERE surcharge_type = 'fixed'
      AND (model_name IS NULL OR model_name = p_model)
      AND (org_id IS NULL OR org_id = p_org_id)
      AND effective_date <= CURRENT_DATE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
  ) LOOP
    v_surcharge_cost := v_surcharge_cost + ROUND(v_total_tokens::DECIMAL * v_surcharge.surcharge_value, 8);
    
    -- Log surcharge application
    INSERT INTO billing.surcharge_applications (
      run_id, step_id, surcharge_name, surcharge_type, base_cost, surcharge_amount
    ) VALUES (
      p_run_id, p_step_id, v_surcharge.surcharge_name, 'fixed', v_base_cost,
      ROUND(v_total_tokens::DECIMAL * v_surcharge.surcharge_value, 8)
    );
  END LOOP;
  
  -- 4.5: Apply tiered surcharges (based on volume)
  FOR v_surcharge IN (
    SELECT 
      surcharge_name,
      surcharge_value,
      tier_threshold
    FROM billing.cost_surcharges_tiered
    WHERE (model_name IS NULL OR model_name = p_model)
      AND (org_id IS NULL OR org_id = p_org_id)
      AND v_total_tokens >= tier_threshold
      AND effective_date <= CURRENT_DATE
      AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    ORDER BY tier_threshold DESC
    LIMIT 1  -- Apply highest applicable tier
  ) LOOP
    v_surcharge_cost := v_surcharge_cost + ROUND(v_base_cost * v_surcharge.surcharge_value, 8);
    
    -- Log surcharge application
    INSERT INTO billing.surcharge_applications (
      run_id, step_id, surcharge_name, surcharge_type, base_cost, surcharge_amount
    ) VALUES (
      p_run_id, p_step_id, v_surcharge.surcharge_name, 'tiered', v_base_cost,
      ROUND(v_base_cost * v_surcharge.surcharge_value, 8)
    );
  END LOOP;
  
  -- 4.6: Calculate total cost
  v_total_cost := v_base_cost + v_surcharge_cost;
  
  -- 4.7: Apply minimum cost (floor)
  IF v_total_cost < 0.00000001 AND v_total_tokens > 0 THEN
    v_total_cost := 0.00000001;  -- Minimum cost of $0.00000001
  END IF;
  
  -- 4.8: Apply maximum cost (ceiling)
  IF v_total_cost > c_max_cost_per_call THEN
    v_status := 'ERROR';
    v_error_code := 'EXCESSIVE_COST';
    v_error_message := 'Calculated cost exceeds maximum: $' || v_total_cost || ' > $' || c_max_cost_per_call;
    
    INSERT INTO billing.cost_calculation_errors (
      run_id, step_id, model, input_tokens, output_tokens, calculated_cost, error_reason
    ) VALUES (
      p_run_id, p_step_id, p_model, p_input_tokens, p_output_tokens, v_total_cost, 'excessive_cost'
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, v_total_tokens, v_total_cost, v_status, v_error_code, v_error_message,
      v_pricing_source, NULL::DECIMAL(12,8);
    RETURN;
  END IF;
  
  -- 4.9: Log cost calculation for audit
  INSERT INTO billing.cost_calculations (
    run_id, step_id, model, input_tokens, output_tokens, total_tokens,
    input_price, output_price, base_cost, surcharge_cost, total_cost, pricing_source
  ) VALUES (
    p_run_id, p_step_id, p_model, p_input_tokens, p_output_tokens, v_total_tokens,
    v_input_price, v_output_price, v_base_cost, v_surcharge_cost, v_total_cost, v_pricing_source
  );
```

---

## Phase 5: Check Credit Balance

```sql
  -- ================================================================
  -- PHASE 5: CHECK CREDIT BALANCE
  -- ================================================================
  -- Purpose: Verify org has sufficient credits
  -- Locking: Row-level lock on credit_balances to prevent race conditions
  -- ================================================================
  
  -- 5.1: Get current balance with row-level lock
  SELECT 
    balance_usd,
    reserved_usd
  INTO 
    v_current_balance,
    v_reserved_balance
  FROM billing.credit_balances
  WHERE org_id = p_org_id
  FOR UPDATE;  -- Row-level lock
  
  -- 5.2: Handle org not found in credit_balances
  IF v_current_balance IS NULL THEN
    -- Create credit balance record with zero balance
    INSERT INTO billing.credit_balances (org_id, balance_usd, reserved_usd)
    VALUES (p_org_id, 0, 0)
    ON CONFLICT (org_id) DO NOTHING;
    
    v_current_balance := 0;
    v_reserved_balance := 0;
  END IF;
  
  -- 5.3: Calculate available balance
  v_available_balance := v_current_balance - v_reserved_balance;
  
  -- 5.4: Check sufficient balance
  IF v_available_balance < v_total_cost THEN
    v_status := 'ERROR';
    v_error_code := 'INSUFFICIENT_CREDITS';
    v_error_message := 'Insufficient credits. Available: $' || v_available_balance || 
                       ', Required: $' || v_total_cost ||
                       ', Shortfall: $' || (v_total_cost - v_available_balance);
    
    -- Log insufficient credits
    INSERT INTO billing.insufficient_credit_events (
      org_id, run_id, step_id, available_balance, required_amount, shortfall
    ) VALUES (
      p_org_id, p_run_id, p_step_id, v_available_balance, v_total_cost, 
      v_total_cost - v_available_balance
    );
    
    -- Notify (async)
    PERFORM pg_notify('insufficient_credits', json_build_object(
      'org_id', p_org_id,
      'run_id', p_run_id,
      'shortfall', v_total_cost - v_available_balance
    )::TEXT);
    
    RETURN QUERY SELECT 
      NULL::UUID, v_total_tokens, v_total_cost, v_status, v_error_code, v_error_message,
      v_pricing_source, v_available_balance;
    RETURN;
  END IF;
  
  -- 5.5: Check minimum balance threshold
  v_balance_after := v_available_balance - v_total_cost;
  
  IF v_balance_after < c_min_balance_threshold AND v_balance_after > 0 THEN
    -- Log low balance warning (but don't fail)
    INSERT INTO billing.low_balance_warnings (
      org_id, current_balance, balance_after, threshold
    ) VALUES (
      p_org_id, v_available_balance, v_balance_after, c_min_balance_threshold
    );
    
    -- Notify (async)
    PERFORM pg_notify('low_balance_warning', json_build_object(
      'org_id', p_org_id,
      'balance_after', v_balance_after
    )::TEXT);
  END IF;
```

---

## Phase 6: Insert Token Record

```sql
  -- ================================================================
  -- PHASE 6: INSERT TOKEN RECORD
  -- ================================================================
  -- Purpose: Create immutable token record
  -- Idempotency: Use idempotency_key if provided
  -- ================================================================
  
  -- 6.1: Generate record ID
  v_record_id := gen_random_uuid();
  
  -- 6.2: Insert token record
  INSERT INTO billing.token_records (
    id,
    run_id,
    agent_id,
    task_id,
    step_id,
    input_tokens,
    output_tokens,
    total_tokens,
    model,
    cost_usd,
    is_estimated,
    idempotency_key,
    pricing_source,
    pricing_effective_date,
    base_cost,
    surcharge_cost,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    v_record_id,
    p_run_id,
    p_agent_id,
    p_task_id,
    p_step_id,
    p_input_tokens,
    p_output_tokens,
    v_total_tokens,
    p_model,
    v_total_cost,
    FALSE,  -- Not estimated (actual from LLM API)
    p_idempotency_key,
    v_pricing_source,
    v_pricing_effective_date,
    v_base_cost,
    v_surcharge_cost,
    p_metadata,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
  
  -- 6.3: Log record creation
  INSERT INTO billing.token_record_audit (
    record_id, action, actor, details
  ) VALUES (
    v_record_id, 'CREATE', 'system', json_build_object(
      'run_id', p_run_id,
      'model', p_model,
      'tokens', v_total_tokens,
      'cost', v_total_cost
    )
  );
```

---

## Phase 7: Update Balances and Totals

```sql
  -- ================================================================
  -- PHASE 7: UPDATE BALANCES AND TOTALS
  -- ================================================================
  -- Purpose: Deduct cost from balance and update run totals
  -- Atomicity: All updates in same transaction
  -- ================================================================
  
  -- 7.1: Deduct cost from credit balance
  UPDATE billing.credit_balances SET
    balance_usd = balance_usd - v_total_cost,
    updated_at = CURRENT_TIMESTAMP
  WHERE org_id = p_org_id;
  
  -- 7.2: Record balance change in history
  INSERT INTO billing.credit_balance_history (
    org_id,
    balance_before_usd,
    balance_after_usd,
    change_usd,
    reason,
    billing_ledger_id
  ) VALUES (
    p_org_id,
    v_current_balance,
    v_current_balance - v_total_cost,
    -v_total_cost,
    'token_usage_' || p_run_id::TEXT,
    NULL  -- Will be updated after ledger insert
  );
  
  -- 7.3: Insert billing ledger entry
  INSERT INTO billing.billing_ledger (
    org_id,
    transaction_type,
    direction,
    amount_usd,
    run_id,
    agent_id,
    task_id,
    reason,
    idempotency_key,
    created_by,
    created_at
  ) VALUES (
    p_org_id,
    'charge',
    'debit',
    v_total_cost,
    p_run_id,
    p_agent_id,
    p_task_id,
    'token_usage',
    COALESCE(p_idempotency_key, 'auto_' || v_record_id::TEXT),
    'system',
    CURRENT_TIMESTAMP
  );
  
  -- 7.4: Update run totals
  UPDATE runs SET
    tokens_used = COALESCE(tokens_used, 0) + v_total_tokens,
    cost_incurred = COALESCE(cost_incurred, 0) + v_total_cost,
    llm_call_count = COALESCE(llm_call_count, 0) + 1,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_run_id;
  
  -- 7.5: Update agent totals (if agent_id provided)
  IF p_agent_id IS NOT NULL THEN
    UPDATE agents SET
      tokens_used = COALESCE(tokens_used, 0) + v_total_tokens,
      cost_incurred = COALESCE(cost_incurred, 0) + v_total_cost,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_agent_id;
  END IF;
  
  -- 7.6: Update task totals (if task_id provided)
  IF p_task_id IS NOT NULL THEN
    UPDATE tasks SET
      tokens_used = COALESCE(tokens_used, 0) + v_total_tokens,
      cost_incurred = COALESCE(cost_incurred, 0) + v_total_cost,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_task_id;
  END IF;
  
  -- 7.7: Update step
  UPDATE steps SET
    tokens_used = v_total_tokens,
    cost_incurred = v_total_cost,
    token_record_id = v_record_id,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_step_id;
```

---

## Phase 8: Return Result

```sql
  -- ================================================================
  -- PHASE 8: RETURN RESULT
  -- ================================================================
  -- Purpose: Return success status with all relevant data
  -- Metrics: Record execution time
  -- ================================================================
  
  -- 8.1: Set success status
  v_status := 'SUCCESS';
  
  -- 8.2: Calculate execution time
  v_end_time := clock_timestamp();
  v_execution_time_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER;
  
  -- 8.3: Record metrics
  INSERT INTO billing.cost_calculation_metrics (
    timestamp,
    total_calls,
    avg_cost_usd,
    min_cost_usd,
    max_cost_usd,
    failed_calls,
    pricing_lookup_errors,
    balance_check_errors,
    models_processed,
    time_window,
    execution_time_ms
  ) VALUES (
    CURRENT_TIMESTAMP,
    1,
    v_total_cost,
    v_total_cost,
    v_total_cost,
    0,
    CASE WHEN v_pricing_source = 'fallback' THEN 1 ELSE 0 END,
    0,
    1,
    '1m',
    v_execution_time_ms
  )
  ON CONFLICT (timestamp, time_window) DO UPDATE SET
    total_calls = billing.cost_calculation_metrics.total_calls + 1,
    avg_cost_usd = (billing.cost_calculation_metrics.avg_cost_usd * billing.cost_calculation_metrics.total_calls + v_total_cost) / (billing.cost_calculation_metrics.total_calls + 1),
    min_cost_usd = LEAST(billing.cost_calculation_metrics.min_cost_usd, v_total_cost),
    max_cost_usd = GREATEST(billing.cost_calculation_metrics.max_cost_usd, v_total_cost);
  
  -- 8.4: Get updated balance
  SELECT balance_usd - reserved_usd
  INTO v_balance_after
  FROM billing.credit_balances
  WHERE org_id = p_org_id;
  
  -- 8.5: Return success
  RETURN QUERY SELECT 
    v_record_id,
    v_total_tokens,
    v_total_cost,
    v_status,
    v_error_code,
    v_error_message,
    v_pricing_source,
    v_balance_after;
  
  RETURN;
```

---

## Exception Handler

```sql
-- ================================================================
-- EXCEPTION HANDLER
-- ================================================================
-- Purpose: Catch and log any unexpected errors
-- Recovery: Return error status with details
-- ================================================================

EXCEPTION 
  WHEN unique_violation THEN
    -- Handle duplicate idempotency key (race condition)
    IF p_idempotency_key IS NOT NULL THEN
      -- Return existing record
      RETURN QUERY SELECT 
        tr.id,
        tr.total_tokens,
        tr.cost_usd,
        'IDEMPOTENT'::VARCHAR,
        NULL::VARCHAR,
        'Returning existing record (race condition resolved)'::TEXT,
        'cached'::VARCHAR,
        (SELECT balance_usd - reserved_usd FROM billing.credit_balances WHERE org_id = p_org_id)
      FROM billing.token_records tr
      WHERE tr.idempotency_key = p_idempotency_key;
      RETURN;
    END IF;
    
    -- Log error
    INSERT INTO billing.procedure_errors (
      procedure_name, error_code, error_message, context, stack_trace
    ) VALUES (
      'record_token_call', 'UNIQUE_VIOLATION', SQLERRM,
      json_build_object('run_id', p_run_id, 'step_id', p_step_id, 'model', p_model),
      pg_exception_context()
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 
      COALESCE(v_total_tokens, 0), 
      COALESCE(v_total_cost, 0::DECIMAL(12,8)), 
      'ERROR'::VARCHAR,
      'UNIQUE_VIOLATION'::VARCHAR,
      SQLERRM::TEXT,
      v_pricing_source,
      NULL::DECIMAL(12,8);
    
  WHEN foreign_key_violation THEN
    -- Log error
    INSERT INTO billing.procedure_errors (
      procedure_name, error_code, error_message, context, stack_trace
    ) VALUES (
      'record_token_call', 'FOREIGN_KEY_VIOLATION', SQLERRM,
      json_build_object('run_id', p_run_id, 'step_id', p_step_id, 'model', p_model),
      pg_exception_context()
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 
      COALESCE(v_total_tokens, 0), 
      COALESCE(v_total_cost, 0::DECIMAL(12,8)), 
      'ERROR'::VARCHAR,
      'FOREIGN_KEY_VIOLATION'::VARCHAR,
      SQLERRM::TEXT,
      v_pricing_source,
      NULL::DECIMAL(12,8);
    
  WHEN check_violation THEN
    -- Log error
    INSERT INTO billing.procedure_errors (
      procedure_name, error_code, error_message, context, stack_trace
    ) VALUES (
      'record_token_call', 'CHECK_VIOLATION', SQLERRM,
      json_build_object('run_id', p_run_id, 'step_id', p_step_id, 'model', p_model),
      pg_exception_context()
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 
      COALESCE(v_total_tokens, 0), 
      COALESCE(v_total_cost, 0::DECIMAL(12,8)), 
      'ERROR'::VARCHAR,
      'CHECK_VIOLATION'::VARCHAR,
      SQLERRM::TEXT,
      v_pricing_source,
      NULL::DECIMAL(12,8);
    
  WHEN deadlock_detected THEN
    -- Log error and suggest retry
    INSERT INTO billing.procedure_errors (
      procedure_name, error_code, error_message, context, stack_trace
    ) VALUES (
      'record_token_call', 'DEADLOCK_DETECTED', SQLERRM,
      json_build_object('run_id', p_run_id, 'step_id', p_step_id, 'model', p_model),
      pg_exception_context()
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 
      COALESCE(v_total_tokens, 0), 
      COALESCE(v_total_cost, 0::DECIMAL(12,8)), 
      'RETRY'::VARCHAR,
      'DEADLOCK_DETECTED'::VARCHAR,
      'Deadlock detected. Please retry.'::TEXT,
      v_pricing_source,
      NULL::DECIMAL(12,8);
    
  WHEN OTHERS THEN
    -- Log unexpected error
    INSERT INTO billing.procedure_errors (
      procedure_name, error_code, error_message, context, stack_trace
    ) VALUES (
      'record_token_call', SQLSTATE, SQLERRM,
      json_build_object(
        'run_id', p_run_id, 
        'step_id', p_step_id, 
        'model', p_model,
        'input_tokens', p_input_tokens,
        'output_tokens', p_output_tokens
      ),
      pg_exception_context()
    );
    
    RETURN QUERY SELECT 
      NULL::UUID, 
      COALESCE(v_total_tokens, 0), 
      COALESCE(v_total_cost, 0::DECIMAL(12,8)), 
      'ERROR'::VARCHAR,
      SQLSTATE::VARCHAR,
      SQLERRM::TEXT,
      v_pricing_source,
      NULL::DECIMAL(12,8);

END;
$$ LANGUAGE plpgsql;
```

---

## Supporting Functions

### Rate Limit Check Function

```sql
CREATE OR REPLACE FUNCTION billing.check_rate_limit(
  p_org_id UUID,
  p_tokens INTEGER
) RETURNS TABLE (
  allowed BOOLEAN,
  retry_after_seconds INTEGER
) AS $$
DECLARE
  v_calls_per_second INTEGER;
  v_tokens_per_second INTEGER;
  v_current_calls INTEGER;
  v_current_tokens INTEGER;
BEGIN
  -- Get rate limit thresholds for org
  SELECT 
    COALESCE(calls_per_second, 100),
    COALESCE(tokens_per_second, 1000000)
  INTO 
    v_calls_per_second,
    v_tokens_per_second
  FROM billing.rate_limit_thresholds
  WHERE org_id = p_org_id OR org_id IS NULL
  ORDER BY org_id NULLS LAST
  LIMIT 1;
  
  -- Default values if no thresholds found
  IF v_calls_per_second IS NULL THEN
    v_calls_per_second := 100;
    v_tokens_per_second := 1000000;
  END IF;
  
  -- Get current usage in last second
  SELECT 
    COALESCE(SUM(call_count), 0),
    COALESCE(SUM(token_count), 0)
  INTO 
    v_current_calls,
    v_current_tokens
  FROM billing.token_call_rate_limit
  WHERE org_id = p_org_id
    AND time_window = '1s'
    AND window_end > CURRENT_TIMESTAMP;
  
  -- Check rate limits
  IF v_current_calls >= v_calls_per_second THEN
    RETURN QUERY SELECT FALSE, 1;
    RETURN;
  END IF;
  
  IF (v_current_tokens + p_tokens) > v_tokens_per_second THEN
    RETURN QUERY SELECT FALSE, 1;
    RETURN;
  END IF;
  
  -- Allowed
  RETURN QUERY SELECT TRUE, 0;
END;
$$ LANGUAGE plpgsql;
```

---

## Usage Examples

### Example 1: Basic Call

```sql
SELECT * FROM billing.record_token_call(
  p_run_id := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::UUID,
  p_step_id := 'b2c3d4e5-f6a7-8901-bcde-f12345678901'::UUID,
  p_input_tokens := 500,
  p_output_tokens := 200,
  p_model := 'gpt-4-turbo',
  p_org_id := 'c3d4e5f6-a7b8-9012-cdef-123456789012'::UUID
);
```

### Example 2: With Idempotency Key

```sql
SELECT * FROM billing.record_token_call(
  p_run_id := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::UUID,
  p_step_id := 'b2c3d4e5-f6a7-8901-bcde-f12345678901'::UUID,
  p_input_tokens := 500,
  p_output_tokens := 200,
  p_model := 'gpt-4-turbo',
  p_org_id := 'c3d4e5f6-a7b8-9012-cdef-123456789012'::UUID,
  p_idempotency_key := 'step_b2c3d4e5_attempt_1'
);
```

### Example 3: With All Parameters

```sql
SELECT * FROM billing.record_token_call(
  p_run_id := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::UUID,
  p_step_id := 'b2c3d4e5-f6a7-8901-bcde-f12345678901'::UUID,
  p_input_tokens := 500,
  p_output_tokens := 200,
  p_model := 'gpt-4-turbo',
  p_org_id := 'c3d4e5f6-a7b8-9012-cdef-123456789012'::UUID,
  p_agent_id := 'd4e5f6a7-b8c9-0123-def0-234567890123'::UUID,
  p_task_id := 'e5f6a7b8-c9d0-1234-ef01-345678901234'::UUID,
  p_idempotency_key := 'step_b2c3d4e5_attempt_1',
  p_metadata := '{"source": "wide_research", "agent_index": 3}'::JSONB
);
```

---

## Summary

**8 Phases:**

| Phase | Purpose | Failure Mode |
|-------|---------|--------------|
| 1. Validation | Validate all inputs | Return error immediately |
| 2. Rate Limiting | Check and enforce limits | Return rate limit error |
| 3. Fetch Pricing | Get model pricing | Use fallback pricing |
| 4. Calculate Cost | Calculate total cost | Return error if excessive |
| 5. Check Balance | Verify sufficient credits | Return insufficient credits |
| 6. Insert Record | Create immutable record | Return error |
| 7. Update Balances | Deduct cost, update totals | Rollback on error |
| 8. Return Result | Return success with data | N/A |

**Error Codes:**

| Code | Phase | Description |
|------|-------|-------------|
| NULL_INPUT_TOKENS | 1 | input_tokens is NULL |
| NEGATIVE_INPUT_TOKENS | 1 | input_tokens is negative |
| RUN_NOT_FOUND | 1 | run_id doesn't exist |
| STEP_NOT_FOUND | 1 | step_id doesn't exist |
| ORG_NOT_FOUND | 1 | org_id doesn't exist |
| EXCESSIVE_TOKENS | 1 | total_tokens > 10M |
| RATE_LIMIT_EXCEEDED | 2 | Rate limit hit |
| EXCESSIVE_COST | 4 | cost > $100 |
| INSUFFICIENT_CREDITS | 5 | Not enough balance |
| UNIQUE_VIOLATION | Exception | Duplicate idempotency key |
| DEADLOCK_DETECTED | Exception | Database deadlock |

**Return Values:**

| Field | Type | Description |
|-------|------|-------------|
| record_id | UUID | Created token record ID |
| total_tokens | INTEGER | Input + output tokens |
| cost_usd | DECIMAL(12,8) | Total cost in USD |
| status | VARCHAR | SUCCESS, ERROR, RATE_LIMITED, IDEMPOTENT, RETRY |
| error_code | VARCHAR | Error code (if any) |
| error_message | TEXT | Error description (if any) |
| pricing_source | VARCHAR | database, database_normalized, database_family, fallback |
| balance_remaining | DECIMAL(12,8) | Remaining balance after charge |

---

**Ready to implement production billing system!** 🎯
