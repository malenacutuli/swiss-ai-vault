-- Revoke all access from anon role on vault_mail_accounts
REVOKE ALL ON public.vault_mail_accounts FROM anon;

-- Ensure RLS is enabled (should already be, but verify)
ALTER TABLE public.vault_mail_accounts ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (defense in depth)
ALTER TABLE public.vault_mail_accounts FORCE ROW LEVEL SECURITY;