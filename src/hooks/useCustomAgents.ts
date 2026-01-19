import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export type AgentVisibility = 'private' | 'workspace' | 'public';
export type AgentStatus = 'draft' | 'active' | 'archived';

export interface CustomAgent {
  id: string;
  user_id: string;
  workspace_id?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  avatar_url?: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  enabled_tools: string[];
  tool_config: Record<string, any>;
  context_instructions?: string;
  starter_prompts: string[];
  visibility: AgentVisibility;
  status: AgentStatus;
  share_token?: string;
  // Capabilities
  can_search_web: boolean;
  can_execute_code: boolean;
  can_browse_web: boolean;
  can_generate_images: boolean;
  can_access_files: boolean;
  // Stats
  run_count: number;
  avg_satisfaction?: number;
  current_version: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface AgentTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  system_prompt: string;
  model: string;
  enabled_tools: string[];
  tool_config: Record<string, any>;
  starter_prompts: string[];
  display_order: number;
}

export interface AgentVersion {
  id: string;
  agent_id: string;
  version: number;
  name: string;
  description?: string;
  system_prompt: string;
  model: string;
  enabled_tools: string[];
  tool_config: Record<string, any>;
  change_summary?: string;
  created_by: string;
  created_at: string;
}

export interface CreateAgentParams {
  name: string;
  system_prompt: string;
  description?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  enabled_tools?: string[];
  tool_config?: Record<string, any>;
  context_instructions?: string;
  starter_prompts?: string[];
  visibility?: AgentVisibility;
  workspace_id?: string;
  can_search_web?: boolean;
  can_execute_code?: boolean;
  can_browse_web?: boolean;
  can_generate_images?: boolean;
  can_access_files?: boolean;
}

export interface UpdateAgentParams {
  name?: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  enabled_tools?: string[];
  tool_config?: Record<string, any>;
  context_instructions?: string;
  starter_prompts?: string[];
  visibility?: AgentVisibility;
  can_search_web?: boolean;
  can_execute_code?: boolean;
  can_browse_web?: boolean;
  can_generate_images?: boolean;
  can_access_files?: boolean;
}

interface UseCustomAgentsReturn {
  // State
  agents: CustomAgent[];
  templates: AgentTemplate[];
  currentAgent: CustomAgent | null;
  versions: AgentVersion[];
  isLoading: boolean;

  // Agent CRUD
  createAgent: (params: CreateAgentParams) => Promise<CustomAgent | null>;
  updateAgent: (agentId: string, params: UpdateAgentParams, changeSummary?: string) => Promise<boolean>;
  deleteAgent: (agentId: string) => Promise<boolean>;
  getAgent: (agentId: string) => Promise<CustomAgent | null>;
  listAgents: (workspaceId?: string) => Promise<void>;
  setCurrentAgent: (agent: CustomAgent | null) => void;

  // Templates
  listTemplates: (category?: string) => Promise<void>;
  cloneFromTemplate: (templateSlug: string, name?: string, workspaceId?: string) => Promise<CustomAgent | null>;

  // Clone
  cloneAgent: (agentId: string, name?: string, workspaceId?: string) => Promise<CustomAgent | null>;

  // Versions
  getVersions: (agentId: string) => Promise<void>;
  restoreVersion: (agentId: string, version: number) => Promise<boolean>;

  // Publishing
  publishAgent: (agentId: string) => Promise<boolean>;
  unpublishAgent: (agentId: string) => Promise<boolean>;

  // Sharing
  generateShareLink: (agentId: string) => Promise<string | null>;

  // Public agents
  listPublicAgents: () => Promise<CustomAgent[]>;
}

export function useCustomAgents(): UseCustomAgentsReturn {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [currentAgent, setCurrentAgent] = useState<CustomAgent | null>(null);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Helper to call custom-agents service
  const callService = useCallback(async (action: string, params: Record<string, any> = {}): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('custom-agents', {
      body: { action, ...params },
    });

    if (error) {
      console.error(`[useCustomAgents] ${action} error:`, error);
      throw new Error(error.message);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Unknown error');
    }

    return data;
  }, []);

  // ===== Agent CRUD =====

  const createAgent = useCallback(async (params: CreateAgentParams): Promise<CustomAgent | null> => {
    setIsLoading(true);
    try {
      const data = await callService('create', params);
      const agent = data.agent as CustomAgent;
      setAgents(prev => [agent, ...prev]);
      toast.success('Agent created');
      return agent;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create agent');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callService]);

  const updateAgent = useCallback(async (
    agentId: string,
    params: UpdateAgentParams,
    changeSummary?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const data = await callService('update', {
        agent_id: agentId,
        ...params,
        change_summary: changeSummary,
      });
      const agent = data.agent as CustomAgent;

      setAgents(prev => prev.map(a => a.id === agentId ? agent : a));
      if (currentAgent?.id === agentId) {
        setCurrentAgent(agent);
      }

      toast.success('Agent updated');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update agent');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [callService, currentAgent]);

  const deleteAgent = useCallback(async (agentId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await callService('delete', { agent_id: agentId });
      setAgents(prev => prev.filter(a => a.id !== agentId));
      if (currentAgent?.id === agentId) {
        setCurrentAgent(null);
      }
      toast.success('Agent deleted');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete agent');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [callService, currentAgent]);

  const getAgent = useCallback(async (agentId: string): Promise<CustomAgent | null> => {
    setIsLoading(true);
    try {
      const data = await callService('get', { agent_id: agentId });
      return data.agent as CustomAgent;
    } catch (error: any) {
      console.error('Failed to get agent:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callService]);

  const listAgents = useCallback(async (workspaceId?: string): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await callService('list', { workspace_id: workspaceId });
      setAgents(data.agents || []);
    } catch (error: any) {
      console.error('Failed to list agents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [callService]);

  // ===== Templates =====

  const listTemplates = useCallback(async (category?: string): Promise<void> => {
    try {
      const data = await callService('list_templates', { category });
      setTemplates(data.templates || []);
    } catch (error: any) {
      console.error('Failed to list templates:', error);
    }
  }, [callService]);

  const cloneFromTemplate = useCallback(async (
    templateSlug: string,
    name?: string,
    workspaceId?: string
  ): Promise<CustomAgent | null> => {
    setIsLoading(true);
    try {
      const data = await callService('clone_template', {
        template_slug: templateSlug,
        name,
        workspace_id: workspaceId,
      });
      const agent = data.agent as CustomAgent;
      setAgents(prev => [agent, ...prev]);
      toast.success('Agent created from template');
      return agent;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create from template');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callService]);

  // ===== Clone =====

  const cloneAgent = useCallback(async (
    agentId: string,
    name?: string,
    workspaceId?: string
  ): Promise<CustomAgent | null> => {
    setIsLoading(true);
    try {
      const data = await callService('clone', {
        agent_id: agentId,
        name,
        workspace_id: workspaceId,
      });
      const agent = data.agent as CustomAgent;
      setAgents(prev => [agent, ...prev]);
      toast.success('Agent cloned');
      return agent;
    } catch (error: any) {
      toast.error(error.message || 'Failed to clone agent');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callService]);

  // ===== Versions =====

  const getVersions = useCallback(async (agentId: string): Promise<void> => {
    try {
      const data = await callService('get_versions', { agent_id: agentId });
      setVersions(data.versions || []);
    } catch (error: any) {
      console.error('Failed to get versions:', error);
    }
  }, [callService]);

  const restoreVersion = useCallback(async (agentId: string, version: number): Promise<boolean> => {
    setIsLoading(true);
    try {
      await callService('restore_version', { agent_id: agentId, version });
      toast.success(`Restored to version ${version}`);
      // Refresh agent
      const agent = await getAgent(agentId);
      if (agent) {
        setAgents(prev => prev.map(a => a.id === agentId ? agent : a));
        if (currentAgent?.id === agentId) {
          setCurrentAgent(agent);
        }
      }
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to restore version');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [callService, getAgent, currentAgent]);

  // ===== Publishing =====

  const publishAgent = useCallback(async (agentId: string): Promise<boolean> => {
    try {
      await callService('publish', { agent_id: agentId });
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'active' as AgentStatus } : a));
      if (currentAgent?.id === agentId) {
        setCurrentAgent(prev => prev ? { ...prev, status: 'active' } : null);
      }
      toast.success('Agent published');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to publish agent');
      return false;
    }
  }, [callService, currentAgent]);

  const unpublishAgent = useCallback(async (agentId: string): Promise<boolean> => {
    try {
      await callService('unpublish', { agent_id: agentId });
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'draft' as AgentStatus } : a));
      if (currentAgent?.id === agentId) {
        setCurrentAgent(prev => prev ? { ...prev, status: 'draft' } : null);
      }
      toast.success('Agent unpublished');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to unpublish agent');
      return false;
    }
  }, [callService, currentAgent]);

  // ===== Sharing =====

  const generateShareLink = useCallback(async (agentId: string): Promise<string | null> => {
    try {
      const data = await callService('generate_share_link', { agent_id: agentId });
      toast.success('Share link generated');
      return data.share_token;
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate share link');
      return null;
    }
  }, [callService]);

  // ===== Public Agents =====

  const listPublicAgents = useCallback(async (): Promise<CustomAgent[]> => {
    try {
      const data = await callService('list_public');
      return data.agents || [];
    } catch (error: any) {
      console.error('Failed to list public agents:', error);
      return [];
    }
  }, [callService]);

  // Load agents on mount
  useEffect(() => {
    listAgents();
    listTemplates();
  }, [listAgents, listTemplates]);

  return {
    agents,
    templates,
    currentAgent,
    versions,
    isLoading,
    createAgent,
    updateAgent,
    deleteAgent,
    getAgent,
    listAgents,
    setCurrentAgent,
    listTemplates,
    cloneFromTemplate,
    cloneAgent,
    getVersions,
    restoreVersion,
    publishAgent,
    unpublishAgent,
    generateShareLink,
    listPublicAgents,
  };
}
