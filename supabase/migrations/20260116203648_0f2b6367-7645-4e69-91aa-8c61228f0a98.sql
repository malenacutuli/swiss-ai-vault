-- Add idempotency_key to existing credit_transactions if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_transactions' 
        AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.credit_transactions ADD COLUMN idempotency_key TEXT UNIQUE;
    END IF;
END $$;

-- Add artifact_id to existing credit_transactions if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_transactions' 
        AND column_name = 'artifact_id'
    ) THEN
        ALTER TABLE public.credit_transactions ADD COLUMN artifact_id UUID;
    END IF;
END $$;

-- Create index for idempotency_key if not exists
CREATE INDEX IF NOT EXISTS idx_credit_transactions_idempotency ON public.credit_transactions(idempotency_key);

-- Create or replace credit deduction function
CREATE OR REPLACE FUNCTION deduct_artifact_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_artifact_id UUID,
    p_description TEXT,
    p_idempotency_key TEXT
) RETURNS TABLE (
    success BOOLEAN,
    new_balance INTEGER,
    transaction_id UUID,
    error_message TEXT
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
    v_existing_transaction UUID;
BEGIN
    -- Check for existing transaction with same idempotency key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_transaction 
        FROM public.credit_transactions 
        WHERE idempotency_key = p_idempotency_key;
        
        IF v_existing_transaction IS NOT NULL THEN
            SELECT ct.balance_after INTO v_current_balance
            FROM public.credit_transactions ct
            WHERE ct.id = v_existing_transaction;
            
            RETURN QUERY SELECT 
                TRUE, 
                v_current_balance,
                v_existing_transaction,
                NULL::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Get current balance from unified_credits
    SELECT (GREATEST(0, COALESCE(monthly_allowance, 0) - COALESCE(monthly_used, 0)) + COALESCE(purchased_balance, 0) + COALESCE(grant_balance, 0))
    INTO v_current_balance 
    FROM public.unified_credits 
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;
    
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, v_current_balance, NULL::UUID, 'Insufficient credits'::TEXT;
        RETURN;
    END IF;
    
    v_new_balance := v_current_balance - p_amount;
    
    -- Deduct from purchased_balance first
    UPDATE public.unified_credits 
    SET purchased_balance = GREATEST(0, COALESCE(purchased_balance, 0) - p_amount),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Create transaction record
    INSERT INTO public.credit_transactions (
        user_id, transaction_type, amount, balance_after, 
        artifact_id, description, idempotency_key
    ) VALUES (
        p_user_id, 'debit', p_amount, v_new_balance,
        p_artifact_id, p_description, p_idempotency_key
    ) RETURNING id INTO v_transaction_id;
    
    RETURN QUERY SELECT TRUE, v_new_balance, v_transaction_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace credit refund function
CREATE OR REPLACE FUNCTION refund_artifact_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_artifact_id UUID,
    p_description TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    UPDATE public.unified_credits 
    SET purchased_balance = COALESCE(purchased_balance, 0) + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    SELECT (GREATEST(0, COALESCE(monthly_allowance, 0) - COALESCE(monthly_used, 0)) + COALESCE(purchased_balance, 0) + COALESCE(grant_balance, 0))
    INTO v_new_balance 
    FROM public.unified_credits 
    WHERE user_id = p_user_id;
    
    INSERT INTO public.credit_transactions (
        user_id, transaction_type, amount, balance_after, 
        artifact_id, description
    ) VALUES (
        p_user_id, 'refund', p_amount, v_new_balance,
        p_artifact_id, p_description
    );
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;