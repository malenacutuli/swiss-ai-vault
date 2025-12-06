CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_service_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get current balance with row lock
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user has credits record
  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_credit_record',
      'message', 'User has no credit record'
    );
  END IF;
  
  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_funds',
      'message', 'Insufficient credits',
      'current_balance', v_current_balance,
      'required', p_amount
    );
  END IF;
  
  -- Deduct credits
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE user_credits
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Create transaction record
  INSERT INTO credit_transactions (
    user_id, service_type, credits_used, description, metadata
  ) VALUES (
    p_user_id, p_service_type, p_amount, p_description, p_metadata
  ) RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_deducted', p_amount
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION deduct_credits TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_credits TO service_role;