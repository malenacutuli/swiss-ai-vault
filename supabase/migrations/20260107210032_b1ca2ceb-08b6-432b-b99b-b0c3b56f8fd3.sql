-- =============================================
-- MIGRATION 4: HELPER FUNCTIONS
-- SwissVault Enterprise - January 2026
-- =============================================

-- Check quota for artifact generation
CREATE OR REPLACE FUNCTION check_artifact_quota(
  p_notebook_id UUID,
  p_artifact_type TEXT
) RETURNS JSONB AS $$
DECLARE
  v_usage RECORD;
  v_limit INTEGER;
  v_current INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- Get or create today's usage record
  INSERT INTO notebook_quota_usage (notebook_id, date)
  VALUES (p_notebook_id, CURRENT_DATE)
  ON CONFLICT (notebook_id, date) DO NOTHING;
  
  SELECT * INTO v_usage
  FROM notebook_quota_usage
  WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
  
  -- Get limits (per Gemini feedback: 20 audio/day/notebook)
  v_limit := CASE p_artifact_type
    WHEN 'podcast' THEN 20
    WHEN 'audio_overview' THEN 20
    WHEN 'quiz' THEN 100
    WHEN 'flashcards' THEN 100
    WHEN 'slides' THEN 50
    WHEN 'report' THEN 50
    WHEN 'mind_map' THEN 50
    WHEN 'study_guide' THEN 50
    WHEN 'faq' THEN 100
    WHEN 'timeline' THEN 50
    WHEN 'table' THEN 100
    ELSE 100
  END;
  
  -- Get current count
  v_current := CASE p_artifact_type
    WHEN 'podcast' THEN COALESCE(v_usage.audio_overview_count, 0)
    WHEN 'audio_overview' THEN COALESCE(v_usage.audio_overview_count, 0)
    WHEN 'quiz' THEN COALESCE(v_usage.quiz_count, 0)
    WHEN 'flashcards' THEN COALESCE(v_usage.flashcard_count, 0)
    WHEN 'slides' THEN COALESCE(v_usage.slides_count, 0)
    WHEN 'report' THEN COALESCE(v_usage.report_count, 0)
    WHEN 'mind_map' THEN COALESCE(v_usage.mind_map_count, 0)
    ELSE 0
  END;
  
  v_allowed := v_current < v_limit;
  
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current', v_current,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_current),
    'reset_at', (CURRENT_DATE + INTERVAL '1 day')::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Increment quota usage
CREATE OR REPLACE FUNCTION increment_quota(
  p_notebook_id UUID,
  p_artifact_type TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO notebook_quota_usage (notebook_id, date)
  VALUES (p_notebook_id, CURRENT_DATE)
  ON CONFLICT (notebook_id, date) DO NOTHING;
  
  CASE p_artifact_type
    WHEN 'podcast' THEN
      UPDATE notebook_quota_usage 
      SET audio_overview_count = audio_overview_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    WHEN 'audio_overview' THEN
      UPDATE notebook_quota_usage 
      SET audio_overview_count = audio_overview_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    WHEN 'quiz' THEN
      UPDATE notebook_quota_usage 
      SET quiz_count = quiz_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    WHEN 'flashcards' THEN
      UPDATE notebook_quota_usage 
      SET flashcard_count = flashcard_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    WHEN 'slides' THEN
      UPDATE notebook_quota_usage 
      SET slides_count = slides_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    WHEN 'report' THEN
      UPDATE notebook_quota_usage 
      SET report_count = report_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    WHEN 'study_guide' THEN
      UPDATE notebook_quota_usage 
      SET report_count = report_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    WHEN 'faq' THEN
      UPDATE notebook_quota_usage 
      SET report_count = report_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    WHEN 'timeline' THEN
      UPDATE notebook_quota_usage 
      SET report_count = report_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    WHEN 'mind_map' THEN
      UPDATE notebook_quota_usage 
      SET mind_map_count = mind_map_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
    ELSE
      UPDATE notebook_quota_usage 
      SET query_count = query_count + 1
      WHERE notebook_id = p_notebook_id AND date = CURRENT_DATE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Log audit event
CREATE OR REPLACE FUNCTION log_audit_event(
  p_org_id UUID,
  p_user_id UUID,
  p_category TEXT,
  p_type TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO audit_events (
    org_id, user_id, event_category, event_type,
    target_type, target_id, description, metadata
  ) VALUES (
    p_org_id, p_user_id, p_category, p_type,
    p_target_type, p_target_id, p_description, p_metadata
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get user's organization with role
CREATE OR REPLACE FUNCTION get_user_organization()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  user_role TEXT,
  policy JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name::TEXT,
    o.slug::TEXT,
    om.role::TEXT,
    o.policy_json
  FROM organizations o
  JOIN organization_members om ON o.id = om.org_id
  WHERE om.user_id = auth.uid()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Create default organization for user
CREATE OR REPLACE FUNCTION create_default_organization(
  p_user_id UUID,
  p_org_name TEXT DEFAULT 'Personal'
) RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_slug TEXT;
BEGIN
  -- Generate unique slug
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8);
  
  -- Create organization
  INSERT INTO organizations (name, slug, owner_id)
  VALUES (p_org_name, v_slug, p_user_id)
  RETURNING id INTO v_org_id;
  
  -- Add user as owner
  INSERT INTO organization_members (org_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner');
  
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;