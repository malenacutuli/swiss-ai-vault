-- Organization members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_members
CREATE POLICY "Users can view own memberships" 
ON public.organization_members
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Org admins can manage members"
ON public.organization_members
FOR ALL
USING (
  org_id IN (
    SELECT om.org_id FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.role = 'admin'
  )
);

-- RLS Policies for audit_logs
CREATE POLICY "Org admins can view audit logs" 
ON public.audit_logs
FOR SELECT 
USING (
  org_id IN (
    SELECT org_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Index for faster lookups
CREATE INDEX idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.organization_members(org_id);
CREATE INDEX idx_audit_logs_org_id ON public.audit_logs(org_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);