import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Search, FileText, Presentation, Table, BarChart, Calendar, Plus, Loader2, Brain, LayoutGrid } from 'lucide-react';
import { SwissAgentsIcon } from '@/components/icons/SwissAgentsIcon';
import { useAgentTasks } from '@/hooks/useAgentTasks';
import { useMemoryContext } from '@/hooks/useMemoryContext';
import { useMemory } from '@/hooks/useMemory';
import {
  AgentTaskCardLegacy,
  QuickActionButton,
  PrivacyTierSelector,
  ConnectedServicesRow,
  EmptyTaskState,
  AgentExecutionPanel,
  TemplateBrowser,
  type PrivacyTier,
  type ActionTemplate,
} from '@/components/agents';
import type { AgentTask } from '@/hooks/useAgentTasks';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const quickActions = [
  { id: 'research', label: 'Research', icon: Search },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'presentation', label: 'Presentation', icon: Presentation },
  { id: 'spreadsheet', label: 'Spreadsheet', icon: Table },
  { id: 'analysis', label: 'Analysis', icon: BarChart },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
];

export default function Agents() {
  const { activeTasks, recentTasks, activeCount, isLoading } = useAgentTasks();
  const [prompt, setPrompt] = useState('');
  const [privacyTier, setPrivacyTier] = useState<PrivacyTier>('vault');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionPrompt, setExecutionPrompt] = useState('');
  
  // Memory integration state
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryContext, setMemoryContext] = useState<string | null>(null);
  const [isSearchingMemory, setIsSearchingMemory] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  
  // Template browser state
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null);
  
  // Memory hooks
  const { getMemoryContext, isReady: memoryReady, isInitialized: memoryInitialized, initialize: initializeMemory } = useMemoryContext();
  const memory = useMemory();
  
  // Initialize memory and get stats
  useEffect(() => {
    const init = async () => {
      if (!memoryInitialized && memoryReady) {
        await initializeMemory();
      }
      if (memoryReady) {
        try {
          const stats = await memory.getStats();
          setMemoryCount(stats.count);
        } catch (e) {
          console.warn('[Agents] Failed to get memory stats:', e);
        }
      }
    };
    init();
  }, [memoryReady, memoryInitialized, initializeMemory, memory]);

  const handleQuickAction = (actionId: string) => {
    setSelectedAction(selectedAction === actionId ? null : actionId);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe your task');
      return;
    }

    // Fetch memory context if enabled
    let fetchedMemoryContext: string | null = null;
    if (memoryEnabled && memoryReady && memoryCount > 0) {
      setIsSearchingMemory(true);
      try {
        const result = await getMemoryContext(prompt.trim(), {
          limit: 8,
          minScore: 0.5,
          domain: selectedAction || undefined,
        });
        fetchedMemoryContext = result.context;
        if (result.sources.length > 0) {
          toast.success(`Found ${result.sources.length} relevant memories`);
        }
      } catch (e) {
        console.warn('[Agents] Memory search failed:', e);
      }
      setIsSearchingMemory(false);
    }

    setMemoryContext(fetchedMemoryContext);
    setExecutionPrompt(prompt.trim());
    setIsExecuting(true);
  };

  const handleCloseExecution = () => {
    setIsExecuting(false);
    setExecutionPrompt('');
    setPrompt('');
    setSelectedAction(null);
    setSelectedTemplate(null);
  };

  const handleSelectTemplate = (template: ActionTemplate) => {
    setSelectedTemplate(template);
    // Replace placeholders with readable format
    let templatePrompt = template.prompt_template;
    
    // If template has required inputs, show them as placeholders
    if (template.required_inputs && template.required_inputs.length > 0) {
      const inputNames = (template.required_inputs as any[])
        .map((input: any) => input.name || input)
        .join(', ');
      templatePrompt = `${template.name}\n\n${template.description || ''}\n\nRequired inputs: ${inputNames}`;
    }
    
    setPrompt(templatePrompt);
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleViewTask = (task: AgentTask) => {
    // TODO: Open task detail modal/page
    toast.info(`Viewing task: ${task.id}`);
  };

  const handleDownloadTask = (task: AgentTask) => {
    // TODO: Download task outputs
    toast.info('Download coming soon');
  };

  return (
    <>
      <Helmet>
        <title>Swiss Agents | SwissVault.ai</title>
        <meta name="description" content="Autonomous AI agents that work for you. Create research, documents, presentations, and more." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container max-w-5xl mx-auto px-4 py-8">
          {/* Header */}
          <header className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <SwissAgentsIcon className="h-6 w-6" />
                Swiss Agents
              </h1>
              <p className="text-muted-foreground mt-1">Autonomous AI that works for you</p>
            </div>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1.5" />
              New Task
            </Button>
          </header>

          {/* Hero Input Section */}
          <section className="mb-16">
            <h2 className="text-3xl font-light text-center text-foreground mb-6">
              What can I do for you?
            </h2>
            
            <div className="max-w-2xl mx-auto space-y-4">
              <Textarea
                placeholder="Describe your task..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className={cn(
                  'min-h-[120px] resize-none text-base',
                  'bg-card border-border focus:border-primary/50'
                )}
              />

              {/* Quick Actions */}
              <div className="flex flex-wrap justify-center gap-2">
                {quickActions.map((action) => (
                  <QuickActionButton
                    key={action.id}
                    icon={action.icon}
                    label={action.label}
                    isActive={selectedAction === action.id}
                    onClick={() => handleQuickAction(action.id)}
                  />
                ))}
              </div>

              {/* Browse Templates Button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setShowTemplateBrowser(true)}
                  className="gap-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Browse 50+ Templates
                </Button>
              </div>

              {/* Memory Integration Section */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    memoryEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <Brain className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">Use Your Memory</span>
                      {memoryCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {memoryCount} items
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {memoryCount > 0 
                        ? 'Agent will reference your documents & notes'
                        : 'No documents in memory yet'
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  checked={memoryEnabled}
                  onCheckedChange={setMemoryEnabled}
                  disabled={!memoryReady || memoryCount === 0}
                />
              </div>

              {/* Connected Services & Privacy Tier */}
              <div className="flex items-center justify-between pt-2">
                <ConnectedServicesRow />
                <PrivacyTierSelector value={privacyTier} onChange={setPrivacyTier} />
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!prompt.trim() || isSearchingMemory}
                  className="bg-primary hover:bg-primary/90 px-8"
                >
                  {isSearchingMemory ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching Memory...
                    </>
                  ) : (
                    'Start Task'
                  )}
                </Button>
              </div>
            </div>
          </section>

          {/* Execution Panel */}
          {isExecuting && (
            <AgentExecutionPanel
              prompt={executionPrompt}
              taskType={selectedAction || undefined}
              privacyTier={privacyTier}
              memoryContext={memoryContext}
              onClose={handleCloseExecution}
            />
          )}

          {/* Active Tasks */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-medium text-foreground">Active Tasks</h3>
              {activeCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeCount}
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeTasks.length === 0 ? (
              <EmptyTaskState variant="active" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeTasks.map((task) => (
                  <AgentTaskCardLegacy
                    key={task.id}
                    task={task}
                    variant="active"
                    onView={handleViewTask}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Recent Tasks */}
          <section>
            <h3 className="text-lg font-medium text-foreground mb-4">Recent Tasks</h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentTasks.length === 0 ? (
              <EmptyTaskState variant="recent" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recentTasks.map((task) => (
                  <AgentTaskCardLegacy
                    key={task.id}
                    task={task}
                    variant="recent"
                    onView={handleViewTask}
                    onDownload={handleDownloadTask}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Template Browser */}
      <TemplateBrowser
        open={showTemplateBrowser}
        onOpenChange={setShowTemplateBrowser}
        onSelectTemplate={handleSelectTemplate}
      />
    </>
  );
}
