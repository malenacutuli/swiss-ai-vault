-- Add missing column to tier_limits
ALTER TABLE public.tier_limits 
ADD COLUMN IF NOT EXISTS can_manage_org BOOLEAN DEFAULT FALSE;

-- Update premium and enterprise to allow org management
UPDATE public.tier_limits SET can_manage_org = TRUE WHERE tier IN ('premium', 'enterprise');

-- Create get_user_tier RPC function
CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id UUID)
RETURNS TABLE (
  tier TEXT,
  tier_display_name TEXT,
  is_org_member BOOLEAN,
  org_id UUID,
  org_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_sub unified_subscriptions;
  v_org_member organization_members;
  v_org organizations;
  v_tier_info tier_limits;
BEGIN
  -- Get user's subscription
  SELECT * INTO v_sub
  FROM unified_subscriptions
  WHERE user_id = p_user_id;
  
  -- If no subscription, create default
  IF v_sub IS NULL THEN
    INSERT INTO unified_subscriptions (user_id, tier, status)
    VALUES (p_user_id, 'ghost_free', 'active')
    RETURNING * INTO v_sub;
  END IF;
  
  -- Get tier display name
  SELECT * INTO v_tier_info
  FROM tier_limits
  WHERE tier_limits.tier = v_sub.tier;
  
  -- Check if user is org member
  SELECT * INTO v_org_member
  FROM organization_members
  WHERE user_id = p_user_id
  ORDER BY joined_at DESC
  LIMIT 1;
  
  -- Get org details if member
  IF v_org_member IS NOT NULL THEN
    SELECT * INTO v_org
    FROM organizations
    WHERE id = v_org_member.org_id;
  END IF;
  
  RETURN QUERY SELECT 
    v_sub.tier,
    COALESCE(v_tier_info.display_name, 'Ghost Free'),
    v_org_member IS NOT NULL,
    v_org_member.org_id,
    v_org.name;
END;
$$;