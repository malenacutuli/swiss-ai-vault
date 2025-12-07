import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  settings: any;
  created_at: string;
}

interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  user?: {
    email: string;
    full_name: string | null;
  };
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  members: OrganizationMember[];
  loading: boolean;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  userRole: string | null;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    loadOrganizations();
    const unsubscribe = subscribeToChanges();
    return () => {
      unsubscribe();
    };
  }, []);

  const loadOrganizations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get user's organizations via memberships
      const { data: memberships } = await supabase
        .from('organization_members')
        .select(`
          org_id,
          role,
          organizations (
            id,
            name,
            slug,
            avatar_url,
            settings,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        return;
      }

      const orgs = memberships
        .map(m => m.organizations as unknown as Organization)
        .filter(Boolean);
      setOrganizations(orgs);

      // Get current organization from user settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('current_organization_id')
        .eq('user_id', user.id)
        .single();

      let currentOrgId = settings?.current_organization_id;

      // If no current org set, use first org
      if (!currentOrgId && orgs.length > 0) {
        currentOrgId = orgs[0].id;
        await supabase
          .from('user_settings')
          .upsert({ 
            user_id: user.id, 
            current_organization_id: currentOrgId 
          }, { 
            onConflict: 'user_id' 
          });
      }

      // Load current organization and members
      if (currentOrgId) {
        const currentOrg = orgs.find(o => o.id === currentOrgId) || orgs[0];
        setCurrentOrganization(currentOrg);

        const membership = memberships.find(m => m.org_id === currentOrg.id);
        setUserRole(membership?.role || null);

        // Load members with user info
        const { data: orgMembers } = await supabase
          .from('organization_members')
          .select(`
            id,
            org_id,
            user_id,
            role,
            users (
              email,
              full_name
            )
          `)
          .eq('org_id', currentOrg.id);

        const formattedMembers: OrganizationMember[] = (orgMembers || []).map(m => ({
          id: m.id,
          org_id: m.org_id,
          user_id: m.user_id,
          role: m.role,
          user: m.users ? {
            email: (m.users as any).email,
            full_name: (m.users as any).full_name
          } : undefined
        }));

        setMembers(formattedMembers);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading organizations:', error);
      setLoading(false);
    }
  };

  const switchOrganization = async (orgId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update user settings
      await supabase
        .from('user_settings')
        .upsert({ 
          user_id: user.id, 
          current_organization_id: orgId 
        }, { 
          onConflict: 'user_id' 
        });

      // Update local state
      const org = organizations.find(o => o.id === orgId);
      if (org) {
        setCurrentOrganization(org);

        // Load members for new org
        const { data: orgMembers } = await supabase
          .from('organization_members')
          .select(`
            id,
            org_id,
            user_id,
            role,
            users (
              email,
              full_name
            )
          `)
          .eq('org_id', orgId);

        const formattedMembers: OrganizationMember[] = (orgMembers || []).map(m => ({
          id: m.id,
          org_id: m.org_id,
          user_id: m.user_id,
          role: m.role,
          user: m.users ? {
            email: (m.users as any).email,
            full_name: (m.users as any).full_name
          } : undefined
        }));

        setMembers(formattedMembers);

        // Get user's role in this org
        const membership = formattedMembers.find(m => m.user_id === user.id);
        setUserRole(membership?.role || null);

        // Reload page to refresh all org-scoped data
        window.location.reload();
      }
    } catch (error) {
      console.error('Error switching organization:', error);
    }
  };

  const refreshOrganizations = async () => {
    await loadOrganizations();
  };

  const subscribeToChanges = () => {
    const orgChannel = supabase
      .channel('org_context_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'organizations'
      }, () => {
        refreshOrganizations();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'organization_members'
      }, () => {
        refreshOrganizations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orgChannel);
    };
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        members,
        loading,
        switchOrganization,
        refreshOrganizations,
        userRole
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganizationContext = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationContext must be used within OrganizationProvider');
  }
  return context;
};
