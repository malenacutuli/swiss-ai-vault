-- Create roles table for role definitions
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '[]',
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on roles
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);

-- Enable RLS on roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Add missing columns to existing user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS granted_by UUID,
ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create indexes on user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- Insert default system roles
INSERT INTO public.roles (name, description, permissions, is_system_role) VALUES
  ('admin', 'Full system access', '["*"]', true),
  ('moderator', 'Content moderation access', '["read", "moderate", "audit"]', true),
  ('user', 'Standard user access', '["read", "write"]', true)
ON CONFLICT (name) DO NOTHING;

-- Update has_role function to work with both enum and role_id
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND (
        ur.role::TEXT = _role_name 
        OR r.name = _role_name
      )
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  )
$$;

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND (r.permissions ? _permission OR r.permissions ? '*')
  )
$$;

-- Function to get all user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS TABLE(role_id UUID, role_name TEXT, permissions JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(r.id, gen_random_uuid()) as role_id,
    COALESCE(r.name, ur.role::TEXT) as role_name,
    COALESCE(r.permissions, '[]'::JSONB) as permissions
  FROM public.user_roles ur
  LEFT JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = _user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
$$;

-- Function to assign role to user
CREATE OR REPLACE FUNCTION public.assign_role(_user_id UUID, _role_name TEXT, _expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_assignment_id UUID;
BEGIN
  -- Get role id from roles table
  SELECT id INTO v_role_id FROM public.roles WHERE name = _role_name;
  
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role not found: %', _role_name;
  END IF;
  
  -- Insert assignment
  INSERT INTO public.user_roles (user_id, role_id, granted_by, granted_at, expires_at, role)
  VALUES (_user_id, v_role_id, auth.uid(), NOW(), _expires_at, 'user'::app_role)
  ON CONFLICT (user_id, role) DO UPDATE SET
    role_id = v_role_id,
    granted_by = auth.uid(),
    granted_at = NOW(),
    expires_at = _expires_at
  RETURNING id INTO v_assignment_id;
  
  RETURN v_assignment_id;
END;
$$;

-- RLS Policies for roles table
DROP POLICY IF EXISTS "Roles are viewable by authenticated users" ON public.roles;
CREATE POLICY "Roles are viewable by authenticated users"
ON public.roles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Only admins can manage roles" ON public.roles;
CREATE POLICY "Only admins can manage roles"
ON public.roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));