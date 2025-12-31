import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Integration {
  id: string;
  integration_type: string;
  integration_name: string;
  is_active: boolean;
  last_synced_at: string | null;
  metadata: {
    workspace_name?: string;
    workspace_id?: string;
    username?: string;
    avatar_url?: string;
    email?: string;
    last_sync_stats?: {
      items_synced?: number;
      threads_synced?: number;
      messages_processed?: number;
      repos_synced?: number;
      files_indexed?: number;
    };
  };
  created_at: string;
}

export interface IntegrationDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  oauthEndpoint: string;
  syncEndpoint: string;
  available: boolean;
  comingSoon?: boolean;
}

export const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    type: 'slack',
    name: 'Slack',
    description: 'Sync messages and channels',
    icon: 'slack',
    oauthEndpoint: 'slack-oauth',
    syncEndpoint: 'slack-sync',
    available: true,
  },
  {
    type: 'notion',
    name: 'Notion',
    description: 'Sync pages and databases',
    icon: 'notion',
    oauthEndpoint: 'notion-oauth',
    syncEndpoint: 'notion-sync',
    available: true,
  },
  {
    type: 'gmail',
    name: 'Gmail',
    description: 'Sync emails and threads',
    icon: 'gmail',
    oauthEndpoint: 'gmail-oauth',
    syncEndpoint: 'gmail-sync',
    available: true,
  },
  {
    type: 'github',
    name: 'GitHub',
    description: 'Sync repositories and issues',
    icon: 'github',
    oauthEndpoint: 'github-oauth',
    syncEndpoint: 'github-sync',
    available: true,
  },
  {
    type: 'googledrive',
    name: 'Google Drive',
    description: 'Import files and documents',
    icon: 'google-drive',
    oauthEndpoint: 'googledrive-oauth',
    syncEndpoint: 'googledrive-import',
    available: true,
  },
  {
    type: 'google_docs',
    name: 'Google Docs',
    description: 'Sync documents and sheets',
    icon: 'google-docs',
    oauthEndpoint: 'google-docs-oauth',
    syncEndpoint: 'google-docs-sync',
    available: false,
    comingSoon: true,
  },
  {
    type: 'asana',
    name: 'Asana',
    description: 'Sync projects and tasks',
    icon: 'asana',
    oauthEndpoint: 'asana-oauth',
    syncEndpoint: 'asana-sync',
    available: false,
    comingSoon: true,
  },
  {
    type: 'azure_devops',
    name: 'Azure DevOps',
    description: 'Sync work items and repos',
    icon: 'azure-devops',
    oauthEndpoint: 'azure-devops-oauth',
    syncEndpoint: 'azure-devops-sync',
    available: false,
    comingSoon: true,
  },
  {
    type: 'figma',
    name: 'Figma',
    description: 'Sync design files',
    icon: 'figma',
    oauthEndpoint: 'figma-oauth',
    syncEndpoint: 'figma-sync',
    available: false,
    comingSoon: true,
  },
];

export function useIntegrations() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;

      setIntegrations(data as Integration[] || []);
    } catch (err) {
      console.error('Error fetching integrations:', err);
      setError('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const getIntegrationByType = useCallback((type: string): Integration | undefined => {
    return integrations.find(i => i.integration_type === type);
  }, [integrations]);

  const isConnected = useCallback((type: string): boolean => {
    return integrations.some(i => i.integration_type === type && i.is_active);
  }, [integrations]);

  const connect = useCallback(async (definition: IntegrationDefinition) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const authUrl = `${supabaseUrl}/functions/v1/${definition.oauthEndpoint}/authorize`;
    window.location.href = authUrl;
  }, []);

  const disconnect = useCallback(async (integrationId: string) => {
    if (!user) return;

    try {
      // Delete integration data
      await supabase
        .from('chat_integration_data')
        .delete()
        .eq('integration_id', integrationId);

      // Delete document chunks for this integration
      const { data: integration } = await supabase
        .from('chat_integrations')
        .select('integration_type')
        .eq('id', integrationId)
        .single();

      if (integration) {
        await supabase
          .from('document_chunks')
          .delete()
          .eq('user_id', user.id)
          .ilike('filename', `${integration.integration_type}:%`);
      }

      // Delete integration
      await supabase
        .from('chat_integrations')
        .delete()
        .eq('id', integrationId);

      toast({
        title: 'Disconnected',
        description: 'Integration has been disconnected and all synced data removed.',
      });

      fetchIntegrations();
    } catch (err) {
      console.error('Error disconnecting integration:', err);
      toast({
        title: 'Error',
        description: 'Failed to disconnect integration',
        variant: 'destructive',
      });
    }
  }, [user, fetchIntegrations]);

  return {
    integrations,
    loading,
    error,
    getIntegrationByType,
    isConnected,
    connect,
    disconnect,
    refetch: fetchIntegrations,
  };
}

export function useIntegrationSync(integrationId: string | null) {
  const { user, session } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncStats, setSyncStats] = useState<{
    itemsSynced?: number;
    totalItems?: number;
    estimatedTimeRemaining?: number;
  } | null>(null);

  const sync = useCallback(async (options?: Record<string, unknown>) => {
    if (!integrationId || !user || !session) return;

    try {
      setSyncing(true);
      setProgress(0);

      // Get integration type
      const { data: integration } = await supabase
        .from('chat_integrations')
        .select('integration_type')
        .eq('id', integrationId)
        .single();

      if (!integration) throw new Error('Integration not found');

      const definition = INTEGRATION_DEFINITIONS.find(
        d => d.type === integration.integration_type
      );

      if (!definition) throw new Error('Unknown integration type');

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 2000);

      const response = await supabase.functions.invoke(definition.syncEndpoint, {
        body: { integration_id: integrationId, ...options },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.error) throw response.error;

      setSyncStats({
        itemsSynced: response.data?.threads_synced || 
                     response.data?.repos_synced || 
                     response.data?.files_indexed || 0,
      });

      toast({
        title: 'Sync Complete',
        description: `Successfully synced ${response.data?.threads_synced || response.data?.repos_synced || 0} items`,
      });
    } catch (err) {
      console.error('Sync error:', err);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }, [integrationId, user, session]);

  return {
    sync,
    syncing,
    progress,
    syncStats,
  };
}

export function useIntegrationConfig(integrationId: string | null) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!integrationId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_integrations')
        .select('metadata')
        .eq('id', integrationId)
        .single();

      if (error) throw error;

      setConfig((data?.metadata as Record<string, unknown>)?.config as Record<string, unknown> || {});
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(async (newConfig: Record<string, unknown>) => {
    if (!integrationId) return;

    try {
      const { data: existing } = await supabase
        .from('chat_integrations')
        .select('metadata')
        .eq('id', integrationId)
        .single();

      const existingMetadata = (existing?.metadata || {}) as Record<string, unknown>;
      const updatedMetadata = {
        ...existingMetadata,
        config: newConfig,
      } as Record<string, unknown>;

      await supabase
        .from('chat_integrations')
        // @ts-ignore - metadata type is flexible
        .update({ metadata: updatedMetadata })
        .eq('id', integrationId);

      setConfig(newConfig);

      toast({
        title: 'Configuration Saved',
        description: 'Integration settings have been updated.',
      });
    } catch (err) {
      console.error('Error updating config:', err);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    }
  }, [integrationId]);

  return {
    config,
    loading,
    updateConfig,
    refetch: fetchConfig,
  };
}

export function useIntegrationData(integrationId: string | null) {
  const [data, setData] = useState<{
    totalItems: number;
    storageUsed: number;
    dataTypes: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!integrationId) return;

    try {
      setLoading(true);
      const { data: items, error } = await supabase
        .from('chat_integration_data')
        .select('id, data_type, encrypted_content')
        .eq('integration_id', integrationId);

      if (error) throw error;

      const dataTypes: Record<string, number> = {};
      let totalSize = 0;

      items?.forEach(item => {
        dataTypes[item.data_type] = (dataTypes[item.data_type] || 0) + 1;
        totalSize += (item.encrypted_content?.length || 0);
      });

      setData({
        totalItems: items?.length || 0,
        storageUsed: totalSize,
        dataTypes,
      });
    } catch (err) {
      console.error('Error fetching integration data:', err);
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    refetch: fetchData,
  };
}
