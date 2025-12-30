-- Create deduct_unified_credits RPC function
CREATE OR REPLACE FUNCTION public.deduct_unified_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_source TEXT
)
RETURNS TABLE(success BOOLEAN, remaining INTEGER, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_credits unified_credits;
  v_monthly_remaining INTEGER;
  v_total_available INTEGER;
  v_deducted INTEGER := 0;
BEGIN
  -- Get current credits
  SELECT * INTO v_credits
  FROM unified_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_credits IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'No credits record found'::TEXT;
    RETURN;
  END IF;
  
  -- Calculate available credits
  v_monthly_remaining := GREATEST(0, COALESCE(v_credits.monthly_allowance, 0) - COALESCE(v_credits.monthly_used, 0));
  v_total_available := v_monthly_remaining + COALESCE(v_credits.purchased_balance, 0) + COALESCE(v_credits.grant_balance, 0);
  
  -- Check if enough credits
  IF v_total_available < p_amount THEN
    RETURN QUERY SELECT FALSE, v_total_available, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;
  
  -- Deduct from monthly allowance first
  IF v_monthly_remaining > 0 THEN
    IF v_monthly_remaining >= p_amount THEN
      UPDATE unified_credits
      SET monthly_used = COALESCE(monthly_used, 0) + p_amount, updated_at = NOW()
      WHERE user_id = p_user_id;
      
      RETURN QUERY SELECT TRUE, (v_total_available - p_amount)::INTEGER, NULL::TEXT;
      RETURN;
    ELSE
      -- Use all monthly remaining
      UPDATE unified_credits
      SET monthly_used = COALESCE(monthly_allowance, 0), updated_at = NOW()
      WHERE user_id = p_user_id;
      v_deducted := v_monthly_remaining;
    END IF;
  END IF;
  
  -- Deduct remaining from grant balance
  IF v_deducted < p_amount AND COALESCE(v_credits.grant_balance, 0) > 0 THEN
    DECLARE v_from_grant INTEGER := LEAST(COALESCE(v_credits.grant_balance, 0), p_amount - v_deducted);
    BEGIN
      UPDATE unified_credits
      SET grant_balance = grant_balance - v_from_grant, updated_at = NOW()
      WHERE user_id = p_user_id;
      v_deducted := v_deducted + v_from_grant;
    END;
  END IF;
  
  -- Deduct remaining from purchased balance
  IF v_deducted < p_amount AND COALESCE(v_credits.purchased_balance, 0) > 0 THEN
    DECLARE v_from_purchased INTEGER := p_amount - v_deducted;
    BEGIN
      UPDATE unified_credits
      SET purchased_balance = purchased_balance - v_from_purchased, updated_at = NOW()
      WHERE user_id = p_user_id;
    END;
  END IF;
  
  RETURN QUERY SELECT TRUE, (v_total_available - p_amount)::INTEGER, NULL::TEXT;
END;
$$;