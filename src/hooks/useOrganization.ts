import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: string | null;
  settings: unknown;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  created_at: string | null;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

const CURRENT_ORG_KEY = 'swissvault_current_org';

// Get/set current organization from localStorage
export function useCurrentOrganization() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    return localStorage.getItem(CURRENT_ORG_KEY);
  });
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const setCurrentOrganization = useCallback((orgId: string | null) => {
    if (orgId) {
      localStorage.setItem(CURRENT_ORG_KEY, orgId);
    } else {
      localStorage.removeItem(CURRENT_ORG_KEY);
    }
    setCurrentOrgId(orgId);
  }, []);

  useEffect(() => {
    const fetchCurrentOrg = async () => {
      if (!currentOrgId || !user) {
        setCurrentOrg(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', currentOrgId)
        .single();

      if (error || !data) {
        // Org doesn't exist or user doesn't have access, clear it
        setCurrentOrganization(null);
        setCurrentOrg(null);
      } else {
        setCurrentOrg(data);
      }
      setLoading(false);
    };

    fetchCurrentOrg();
  }, [currentOrgId, user, setCurrentOrganization]);

  return {
    currentOrgId,
    currentOrg,
    setCurrentOrganization,
    loading,
    isPersonalWorkspace: !currentOrgId,
  };
}

// List user's organizations
export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get orgs where user is a member
      const { data: memberships, error: membershipsError } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('user_id', user.id);

      if (membershipsError) throw membershipsError;

      if (!memberships || memberships.length === 0) {
        setOrganizations([]);
        setLoading(false);
        return;
      }

      const orgIds = memberships.map(m => m.org_id);

      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)
        .order('name');

      if (orgsError) throw orgsError;

      setOrganizations(orgs || []);
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch organizations'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return { organizations, loading, error, refetch: fetchOrganizations };
}

// List organization members
export function useOrganizationMembers(orgId: string | null) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!orgId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // First get members
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at');

      if (membersError) throw membersError;

      // Then get user details for each member
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email, full_name, avatar_url')
          .in('id', userIds);

        const membersWithUsers = membersData.map(member => ({
          ...member,
          user: usersData?.find(u => u.id === member.user_id),
        }));

        setMembers(membersWithUsers);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch members'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, error, refetch: fetchMembers };
}

// Create organization
export function useCreateOrganization() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const createOrganization = async (name: string, slug?: string) => {
    if (!user) {
      toast.error('You must be logged in');
      return null;
    }

    setLoading(true);
    try {
      // Generate slug from name if not provided
      const orgSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name,
          slug: orgSlug,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add creator as admin
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          org_id: org.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      toast.success('Organization created successfully');
      return org;
    } catch (err: unknown) {
      console.error('Error creating organization:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create organization';
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createOrganization, loading };
}

// Update organization
export function useUpdateOrganization() {
  const [loading, setLoading] = useState(false);

  const updateOrganization = async (orgId: string, updates: { name?: string }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({
          name: updates.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgId)
        .select()
        .single();

      if (error) throw error;

      toast.success('Organization updated');
      return data as Organization;
    } catch (err: unknown) {
      console.error('Error updating organization:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update organization';
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { updateOrganization, loading };
}

// Delete organization
export function useDeleteOrganization() {
  const [loading, setLoading] = useState(false);

  const deleteOrganization = async (orgId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);

      if (error) throw error;

      toast.success('Organization deleted');
      return true;
    } catch (err: unknown) {
      console.error('Error deleting organization:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete organization';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deleteOrganization, loading };
}

// Update member role
export function useUpdateMemberRole() {
  const [loading, setLoading] = useState(false);

  const updateMemberRole = async (memberId: string, role: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Member role updated');
      return true;
    } catch (err: unknown) {
      console.error('Error updating member role:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update role';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { updateMemberRole, loading };
}

// Remove member
export function useRemoveMember() {
  const [loading, setLoading] = useState(false);

  const removeMember = async (memberId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Member removed');
      return true;
    } catch (err: unknown) {
      console.error('Error removing member:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { removeMember, loading };
}

// Leave organization
export function useLeaveOrganization() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const leaveOrganization = async (orgId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Left organization');
      return true;
    } catch (err: unknown) {
      console.error('Error leaving organization:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave organization';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { leaveOrganization, loading };
}

// Get user's role in organization
export function useUserOrgRole(orgId: string | null) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchRole = async () => {
      if (!orgId || !user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        setRole(null);
      } else {
        setRole(data.role);
      }
      setLoading(false);
    };

    fetchRole();
  }, [orgId, user]);

  return { role, loading, isAdmin: role === 'admin' };
}
