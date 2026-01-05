import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  TaskDetailModal,
  type PrivacyTier,
  type ActionTemplate,
} from '@/components/agents';
import type { AgentTask } from '@/hooks/useAgentTasks';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const quickActions = [
  { id: 'research', label: 'Research', icon: Search },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'presentation', label: 'Presentation', icon: Presentation },
  { id: 'spreadsheet', label: 'Spreadsheet', icon: Table },
  { id: 'analysis', label: 'Analysis', icon: BarChart },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
];

// File type icons (no Lucide)
const fileTypeIcons: Record<string, string> = {
  pdf: '📄',
  docx: '📝',
  doc: '📝',
  xlsx: '📊',
  xls: '📊',
  csv: '📋',
  txt: '📃',
  md: '📑',
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  json: '📦',
  default: '📎',
};

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return fileTypeIcons[ext] || fileTypeIcons.default;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Agents() {
  const { activeTasks, recentTasks, activeCount, isLoading } = useAgentTasks();
  const [prompt, setPrompt] = useState('');
  const [privacyTier, setPrivacyTier] = useState<PrivacyTier>('vault');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionPrompt, setExecutionPrompt] = useState('');
  
  // File attachment state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Memory integration state
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryContext, setMemoryContext] = useState<string | null>(null);
  const [isSearchingMemory, setIsSearchingMemory] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  
  // Template browser state
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null);
  const [templateCount, setTemplateCount] = useState<number>(0);
  
  // Task detail modal state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  
  // Memory hooks
  const { getMemoryContext, isReady: memoryReady, isInitialized: memoryInitialized, initialize: initializeMemory } = useMemoryContext();
  const memory = useMemory();
  
  // Initialize memory and get stats + template count
  useEffect(() => {
    const init = async () => {
      // Fetch template count
      const { count } = await supabase
        .from('action_templates')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true);
      setTemplateCount(count || 0);
      
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

  // File handlers
  const handleFileDrop = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      // Max 20MB per file
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        return false;
      }
      return true;
    });
    
    setAttachedFiles(prev => {
      const newFiles = [...prev, ...validFiles].slice(0, 10); // Max 10 files
      if (newFiles.length >= 10 && validFiles.length > 0) {
        toast.info('Maximum 10 files allowed');
      }
      return newFiles;
    });
    setIsDragging(false);
  }, []);

  const handleFileRemove = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Drag handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileDrop(e.dataTransfer.files);
  };

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

    // TODO: Upload attached files to storage and include URLs in context
    if (attachedFiles.length > 0) {
      toast.info(`${attachedFiles.length} file(s) will be processed`);
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
    setAttachedFiles([]);
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
    setSelectedTaskId(task.id);
    setShowTaskDetail(true);
  };
  
  const handleRetryTask = (task: { prompt: string }) => {
    setPrompt(task.prompt);
    setShowTaskDetail(false);
    toast.info('Prompt loaded. Click "Start Task" to retry.');
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

          {/* Hero Input Section with Drop Zone */}
          <section className="mb-16">
            <h2 className="text-3xl font-light text-center text-foreground mb-6">
              What can I do for you?
            </h2>
            
            {/* Main Container with Drop Zone */}
            <div
              className={cn(
                "relative max-w-2xl mx-auto transition-all duration-200",
                isDragging && "ring-2 ring-primary ring-offset-4 rounded-xl"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drop Overlay */}
              <AnimatePresence>
                {isDragging && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-xl flex items-center justify-center z-50 backdrop-blur-sm"
                  >
                    <div className="text-center">
                      <p className="text-lg font-medium text-primary">Drop files here</p>
                      <p className="text-sm text-primary/70">PDF, DOCX, XLSX, CSV, Images (max 20MB)</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Task Input Card */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <Textarea
                  placeholder="Describe your task in detail..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className={cn(
                    'min-h-[120px] resize-none text-base',
                    'bg-transparent border-0 focus-visible:ring-0 p-0'
                  )}
                />

                {/* Attached Files Display */}
                <AnimatePresence>
                  {attachedFiles.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-wrap gap-2 pt-4 border-t border-border"
                    >
                      {attachedFiles.map((file, index) => (
                        <motion.div
                          key={`${file.name}-${index}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm group"
                        >
                          <span className="flex-shrink-0">{getFileIcon(file.name)}</span>
                          <span className="max-w-[120px] truncate text-foreground">{file.name}</span>
                          <span className="text-muted-foreground text-xs">{formatFileSize(file.size)}</span>
                          <button
                            onClick={() => handleFileRemove(index)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1"
                            aria-label={`Remove ${file.name}`}
                          >
                            ✕
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions Row - Manus Style */}
                <div className="flex items-center gap-2 pt-4 border-t border-border">
                  {/* Add Files Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    <span className="text-base">+</span>
                    <span>Add files</span>
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.png,.jpg,.jpeg,.json"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileDrop(e.target.files)}
                  />
                  
                  {/* Browse Templates */}
                  <button
                    onClick={() => setShowTemplateBrowser(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span>Templates</span>
                  </button>
                  
                  <div className="flex-1" />
                  
                  {/* Template count badge */}
                  {selectedTemplate && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedTemplate.name}
                    </Badge>
                  )}
                  
                  {/* Submit Button - Minimal arrow */}
                  <Button
                    onClick={handleSubmit}
                    disabled={!prompt.trim() || isSearchingMemory}
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                  >
                    {isSearchingMemory ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-lg">↑</span>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Actions - Below input */}
            <div className="max-w-2xl mx-auto mt-4">
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

              {/* Memory Integration Section */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50 mt-4">
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
              <div className="flex items-center justify-between pt-4">
                <ConnectedServicesRow />
                <PrivacyTierSelector value={privacyTier} onChange={setPrivacyTier} />
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

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        open={showTaskDetail}
        onOpenChange={setShowTaskDetail}
        onRetry={handleRetryTask}
      />
    </>
  );
}
