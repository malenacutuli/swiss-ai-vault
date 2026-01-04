-- Enhanced security for vault_mail_accounts table
-- This migration hardens RLS policies and adds audit logging for email account credentials

-- 1. Drop the existing permissive policy
DROP POLICY IF EXISTS "Users manage own mail accounts" ON public.vault_mail_accounts;

-- 2. Revoke all access from anon role (defense-in-depth)
REVOKE ALL ON public.vault_mail_accounts FROM anon;

-- 3. Create separate, explicit policies targeting authenticated role only
-- SELECT: Users can only view their own accounts
CREATE POLICY "Authenticated users view own mail accounts"
ON public.vault_mail_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT: Users can only insert their own accounts
CREATE POLICY "Authenticated users insert own mail accounts"
ON public.vault_mail_accounts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own accounts
CREATE POLICY "Authenticated users update own mail accounts"
ON public.vault_mail_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own accounts
CREATE POLICY "Authenticated users delete own mail accounts"
ON public.vault_mail_accounts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Create an audit log function for token access events
CREATE OR REPLACE FUNCTION public.log_mail_account_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log sensitive operations on mail accounts
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    CASE TG_OP
      WHEN 'INSERT' THEN 'mail_account_created'
      WHEN 'UPDATE' THEN 'mail_account_updated'
      WHEN 'DELETE' THEN 'mail_account_deleted'
    END,
    'vault_mail_account',
    COALESCE(NEW.id, OLD.id)::text,
    jsonb_build_object(
      'provider', COALESCE(NEW.provider, OLD.provider),
      'email', COALESCE(NEW.email_address, OLD.email_address),
      'operation', TG_OP
    ),
    now()
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Create trigger for audit logging
DROP TRIGGER IF EXISTS audit_mail_account_changes ON public.vault_mail_accounts;
CREATE TRIGGER audit_mail_account_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.vault_mail_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_mail_account_access();

-- 6. Add index for faster token expiration checks
CREATE INDEX IF NOT EXISTS idx_vault_mail_accounts_token_expires 
ON public.vault_mail_accounts (user_id, token_expires_at)
WHERE token_expires_at IS NOT NULL;

-- 7. Create a function to check if tokens are expired (for use in application code)
CREATE OR REPLACE FUNCTION public.is_mail_token_expired(account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expires_at timestamptz;
BEGIN
  SELECT token_expires_at INTO expires_at
  FROM vault_mail_accounts
  WHERE id = account_id AND user_id = auth.uid();
  
  IF expires_at IS NULL THEN
    RETURN false; -- No expiration set
  END IF;
  
  RETURN expires_at < now();
END;
$$;

-- 8. Grant execute on the helper function to authenticated users only
REVOKE ALL ON FUNCTION public.is_mail_token_expired(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_mail_token_expired(uuid) TO authenticated;