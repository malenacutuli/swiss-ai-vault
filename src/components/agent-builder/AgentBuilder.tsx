import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Play,
  Settings,
  Wrench,
  Plus,
  History,
  Loader2,
  Check,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomAgents, type CustomAgent, type AgentTemplate } from '@/hooks/useCustomAgents';
import { AgentTemplateSelector } from './AgentTemplateSelector';
import { AgentConfigForm, type AgentConfig } from './AgentConfigForm';
import { AgentToolSelector } from './AgentToolSelector';
import { MyAgentsList } from './MyAgentsList';

type BuilderView = 'list' | 'select-template' | 'edit';

const defaultConfig: AgentConfig = {
  name: '',
  description: '',
  system_prompt: '',
  model: 'claude-3-5-sonnet',
  temperature: 0.7,
  max_tokens: 4096,
  context_instructions: '',
  starter_prompts: [],
  visibility: 'private',
};

const defaultCapabilities = {
  can_search_web: true,
  can_execute_code: false,
  can_browse_web: false,
  can_generate_images: false,
  can_access_files: true,
};

export function AgentBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    agents,
    templates,
    versions,
    isLoading,
    createAgent,
    updateAgent,
    deleteAgent,
    getAgent,
    cloneAgent,
    cloneFromTemplate,
    getVersions,
    restoreVersion,
    generateShareLink,
  } = useCustomAgents();

  // View state
  const [view, setView] = useState<BuilderView>('list');
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);

  // Form state
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState(defaultCapabilities);

  // UI state
  const [activeTab, setActiveTab] = useState('config');
  const [isSaving, setIsSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Handle URL params for editing
  useEffect(() => {
    const agentId = searchParams.get('edit');
    if (agentId) {
      loadAgent(agentId);
    }
  }, [searchParams]);

  const loadAgent = async (agentId: string) => {
    const agent = await getAgent(agentId);
    if (agent) {
      setEditingAgent(agent);
      setConfig({
        name: agent.name,
        description: agent.description || '',
        system_prompt: agent.system_prompt,
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
        context_instructions: agent.context_instructions || '',
        starter_prompts: agent.starter_prompts || [],
        visibility: agent.visibility,
      });
      setEnabledTools(agent.enabled_tools || []);
      setCapabilities({
        can_search_web: agent.can_search_web,
        can_execute_code: agent.can_execute_code,
        can_browse_web: agent.can_browse_web,
        can_generate_images: agent.can_generate_images,
        can_access_files: agent.can_access_files,
      });
      setView('edit');
    }
  };

  const handleSelectTemplate = async (template: AgentTemplate) => {
    // Pre-fill from template
    setConfig({
      name: '',
      description: template.description,
      system_prompt: template.system_prompt,
      model: template.model,
      temperature: 0.7,
      max_tokens: 4096,
      context_instructions: '',
      starter_prompts: template.starter_prompts || [],
      visibility: 'private',
    });
    setEnabledTools(template.enabled_tools || []);
    setCapabilities(defaultCapabilities);
    setEditingAgent(null);
    setView('edit');
    setHasChanges(true);
  };

  const handleCreateBlank = () => {
    setConfig(defaultConfig);
    setEnabledTools([]);
    setCapabilities(defaultCapabilities);
    setEditingAgent(null);
    setView('edit');
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!config.name.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      if (editingAgent) {
        // Update existing
        await updateAgent(editingAgent.id, {
          name: config.name,
          description: config.description,
          system_prompt: config.system_prompt,
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
          context_instructions: config.context_instructions,
          starter_prompts: config.starter_prompts,
          visibility: config.visibility,
          enabled_tools: enabledTools,
          ...capabilities,
        });
      } else {
        // Create new
        const agent = await createAgent({
          name: config.name,
          description: config.description,
          system_prompt: config.system_prompt,
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
          context_instructions: config.context_instructions,
          starter_prompts: config.starter_prompts,
          visibility: config.visibility,
          enabled_tools: enabledTools,
          ...capabilities,
        });
        if (agent) {
          setEditingAgent(agent);
        }
      }
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTool = (toolId: string) => {
    setEnabledTools(prev =>
      prev.includes(toolId)
        ? prev.filter(t => t !== toolId)
        : [...prev, toolId]
    );
    setHasChanges(true);
  };

  const handleToggleCapability = (capability: string, enabled: boolean) => {
    setCapabilities(prev => ({ ...prev, [capability]: enabled }));
    setHasChanges(true);
  };

  const handleConfigChange = (newConfig: AgentConfig) => {
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleEdit = (agent: CustomAgent) => {
    loadAgent(agent.id);
  };

  const handleClone = async (agent: CustomAgent) => {
    await cloneAgent(agent.id);
  };

  const handleDelete = async (agent: CustomAgent) => {
    await deleteAgent(agent.id);
  };

  const handleRun = (agent: CustomAgent) => {
    navigate(`/agents?agent=${agent.id}`);
  };

  const handleViewVersions = async (agent: CustomAgent) => {
    await getVersions(agent.id);
    setShowVersions(true);
  };

  const handleShare = async (agent: CustomAgent) => {
    const token = await generateShareLink(agent.id);
    if (token) {
      const url = `${window.location.origin}/agents?shared=${token}`;
      await navigator.clipboard.writeText(url);
    }
  };

  const handleRestoreVersion = async (version: number) => {
    if (editingAgent) {
      await restoreVersion(editingAgent.id, version);
      await loadAgent(editingAgent.id);
      setShowVersions(false);
    }
  };

  // Render list view
  if (view === 'list') {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">My Agents</h1>
            <p className="text-muted-foreground">
              Create and manage your custom AI agents
            </p>
          </div>
          <Button onClick={() => setView('select-template')}>
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </div>

        <MyAgentsList
          agents={agents}
          isLoading={isLoading}
          onEdit={handleEdit}
          onClone={handleClone}
          onDelete={handleDelete}
          onRun={handleRun}
          onViewVersions={handleViewVersions}
          onShare={handleShare}
        />
      </div>
    );
  }

  // Render template selection view
  if (view === 'select-template') {
    return (
      <div className="container max-w-4xl py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => setView('list')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Agents
        </Button>

        <AgentTemplateSelector
          templates={templates}
          onSelectTemplate={handleSelectTemplate}
          onCreateBlank={handleCreateBlank}
          isLoading={isLoading}
        />
      </div>
    );
  }

  // Render edit view
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-4xl py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (hasChanges) {
                    // Could add confirmation dialog here
                  }
                  setView('list');
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="font-semibold">
                  {editingAgent ? 'Edit Agent' : 'Create Agent'}
                </h1>
                {editingAgent && (
                  <p className="text-xs text-muted-foreground">
                    v{editingAgent.current_version}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editingAgent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewVersions(editingAgent)}
                >
                  <History className="h-4 w-4 mr-2" />
                  History
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !config.name.trim() || !config.system_prompt.trim()}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : hasChanges ? (
                  <Save className="h-4 w-4 mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : hasChanges ? 'Save' : 'Saved'}
              </Button>
              {editingAgent && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleRun(editingAgent)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Run
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2">
              <Wrench className="h-4 w-4" />
              Tools & Capabilities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <AgentConfigForm
              config={config}
              onChange={handleConfigChange}
            />
          </TabsContent>

          <TabsContent value="tools">
            <AgentToolSelector
              enabledTools={enabledTools}
              capabilities={capabilities}
              onToggleTool={handleToggleTool}
              onToggleCapability={handleToggleCapability}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Version History Sheet */}
      <Sheet open={showVersions} onOpenChange={setShowVersions}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
            <SheetDescription>
              View and restore previous versions of this agent
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Version {version.version}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestoreVersion(version.version)}
                    >
                      Restore
                    </Button>
                  </div>
                  {version.change_summary && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {version.change_summary}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(version.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {versions.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No version history yet
                </p>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
