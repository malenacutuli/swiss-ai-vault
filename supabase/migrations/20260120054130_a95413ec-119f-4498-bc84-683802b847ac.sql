-- Fix get_user_tier function: org_members -> organization_members
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
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_tier_info RECORD;
  v_org_member RECORD;
  v_org RECORD;
BEGIN
  -- Get active subscription
  SELECT us.tier INTO v_sub
  FROM unified_subscriptions us
  WHERE us.user_id = p_user_id
  AND us.status = 'active'
  ORDER BY us.created_at DESC
  LIMIT 1;

  -- Get tier display info
  SELECT tl.display_name INTO v_tier_info
  FROM tier_limits tl
  WHERE tl.tier = COALESCE(v_sub.tier, 'ghost_free');

  -- Check org membership (FIXED: organization_members instead of org_members)
  SELECT om.org_id INTO v_org_member
  FROM organization_members om
  WHERE om.user_id = p_user_id
  LIMIT 1;

  -- Get org details if member
  IF v_org_member.org_id IS NOT NULL THEN
    SELECT o.name INTO v_org
    FROM organizations o
    WHERE o.id = v_org_member.org_id;
  END IF;

  RETURN QUERY SELECT 
    COALESCE(v_sub.tier, 'ghost_free')::TEXT,
    COALESCE(v_tier_info.display_name, 'Ghost Free')::TEXT,
    v_org_member.org_id IS NOT NULL,
    v_org_member.org_id,
    v_org.name::TEXT;
END;
$$;