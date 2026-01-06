import { useState, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentExecution } from '@/hooks/useAgentExecution';
import { useAgentTasks } from '@/hooks/useAgentTasks';
import { SwissAgentsIcon } from '@/components/icons/SwissAgentsIcon';
import { QuickActionBar } from '@/components/agents/QuickActionBar';
import { ConnectedToolsBar } from '@/components/agents/ConnectedToolsBar';
import { TemplateBrowser, type ActionTemplate } from '@/components/agents/TemplateBrowser';
import { MasterExecutionView } from '@/components/agents/execution/MasterExecutionView';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// File type labels (enterprise style - no emojis)
const fileTypeLabels: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOC',
  doc: 'DOC',
  xlsx: 'XLS',
  xls: 'XLS',
  csv: 'CSV',
  txt: 'TXT',
  md: 'MD',
  png: 'IMG',
  jpg: 'IMG',
  jpeg: 'IMG',
  json: 'JSON',
  default: 'FILE',
};

function getFileLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return fileTypeLabels[ext] || fileTypeLabels.default;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type PrivacyTier = 'ghost' | 'vault' | 'full';

export default function Agents() {
  // Core state
  const [taskPrompt, setTaskPrompt] = useState('');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [privacyTier, setPrivacyTier] = useState<PrivacyTier>('vault');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Task hooks
  const { recentTasks } = useAgentTasks();
  const execution = useAgentExecution({
    onComplete: () => toast.success('Task completed'),
    onError: (err) => toast.error(err),
  });
  
  // File handlers
  const handleFileDrop = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        return false;
      }
      return true;
    });
    
    setAttachedFiles(prev => {
      const newFiles = [...prev, ...validFiles].slice(0, 10);
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
  
  // Submit handler
  const handleSubmit = async () => {
    if (!taskPrompt.trim()) {
      toast.error('Please describe your task');
      return;
    }

    // TODO: Process attached files
    if (attachedFiles.length > 0) {
      toast.info(`${attachedFiles.length} file(s) will be processed`);
    }

    await execution.createTask(taskPrompt.trim(), {
      taskType: selectedAction || 'general',
      privacyTier,
      // memoryContext: memoryEnabled ? await getMemoryContext(taskPrompt) : undefined,
    });

    setTaskPrompt('');
    setAttachedFiles([]);
    setSelectedAction(null);
  };

  const handleNewTask = () => {
    execution.reset();
  };

  const handleSelectTemplate = (template: ActionTemplate) => {
    setTaskPrompt(template.prompt_template);
    setSelectedAction(template.category || null);
    setShowTemplates(false);
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleViewRecentTask = (task: any) => {
    // Load task into execution view
    toast.info('Loading task...');
  };

  const isExecuting = !execution.isIdle;

  return (
    <>
      <Helmet>
        <title>Swiss Agents | SwissVault.ai</title>
        <meta name="description" content="Autonomous AI agents that work for you. Create research, documents, presentations, and more." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50">
          <div className="container max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SwissAgentsIcon className="h-6 w-6" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Swiss Agents</h1>
                  <p className="text-sm text-muted-foreground">Autonomous AI that works for you</p>
                </div>
              </div>
              
              {isExecuting && (
                <button
                  onClick={handleNewTask}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  + New Task
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="container max-w-5xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {!isExecuting ? (
              // TASK INPUT VIEW
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Main Input Card */}
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
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-6">
                      <h2 className="text-2xl font-light text-center text-foreground mb-6">
                        What can I do for you?
                      </h2>
                      
                      <textarea
                        value={taskPrompt}
                        onChange={(e) => setTaskPrompt(e.target.value)}
                        placeholder="Describe your task in detail..."
                        className="w-full min-h-[200px] text-base bg-transparent border-0 focus:ring-0 focus:outline-none resize-y placeholder:text-muted-foreground"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.metaKey) {
                            handleSubmit();
                          }
                        }}
                      />
                      
                      {/* Attached Files */}
                      <AnimatePresence>
                        {attachedFiles.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border"
                          >
                            {attachedFiles.map((file, index) => (
                              <motion.div
                                key={`${file.name}-${index}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm group"
                              >
                                <span className="text-xs font-medium text-muted-foreground">{getFileLabel(file.name)}</span>
                                <span className="max-w-[120px] truncate text-foreground">{file.name}</span>
                                <span className="text-muted-foreground text-xs">{formatFileSize(file.size)}</span>
                                <button
                                  onClick={() => handleFileRemove(index)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1"
                                  aria-label={`Remove ${file.name}`}
                                >
                                  x
                                </button>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Action Row */}
                    <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center gap-3">
                      {/* Add Files */}
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
                      
                      {/* Templates */}
                      <button
                        onClick={() => setShowTemplates(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        <LayoutGrid className="h-4 w-4" />
                        <span>Templates</span>
                      </button>
                      
                      <div className="flex-1" />
                      
                      {/* Submit */}
                      <button
                        onClick={handleSubmit}
                        disabled={!taskPrompt.trim() || execution.isPlanning}
                        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      >
                        {execution.isPlanning ? (
                          <span>Creating...</span>
                        ) : (
                          <>
                            <span>Start Task</span>
                            <span>↑</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="max-w-2xl mx-auto">
                  <QuickActionBar
                    selectedAction={selectedAction}
                    onSelect={(action) => {
                      setSelectedAction(action || null);
                      const prompts: Record<string, string> = {
                        slides: 'Create a presentation about ',
                        document: 'Write a document about ',
                        research: 'Research and summarize ',
                        analyze: 'Analyze this data: ',
                      };
                      if (action && prompts[action] && !taskPrompt) {
                        setTaskPrompt(prompts[action]);
                      }
                    }}
                  />
                </div>

                {/* Connected Tools & Privacy */}
                <div className="max-w-2xl mx-auto">
                  <ConnectedToolsBar
                    privacyTier={privacyTier}
                    setPrivacyTier={setPrivacyTier}
                  />
                </div>

                {/* Memory Toggle */}
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-full">
                    <span className="text-sm text-muted-foreground">Use Your Memory</span>
                    <Switch
                      checked={memoryEnabled}
                      onCheckedChange={setMemoryEnabled}
                    />
                  </div>
                </div>

                {/* Recent Tasks */}
                {recentTasks.length > 0 && (
                  <div className="max-w-2xl mx-auto mt-12">
                    <h3 className="text-lg font-medium text-foreground mb-4">Recent Tasks</h3>
                    <div className="grid gap-3">
                      {recentTasks.slice(0, 5).map((task) => (
                        <button
                          key={task.id}
                          onClick={() => handleViewRecentTask(task)}
                          className="p-4 bg-card border border-border rounded-xl text-left hover:border-primary/30 transition-colors"
                        >
                          <p className="font-medium truncate text-foreground">{task.prompt}</p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                task.status === 'completed' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                task.status === 'failed' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                              )}
                            >
                              {task.status}
                            </Badge>
                            <span>{task.created_at ? new Date(task.created_at).toLocaleDateString() : ''}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              // TASK EXECUTION VIEW
              <motion.div
                key="execution"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-[calc(100vh-200px)]"
              >
                {execution.task && (
                  <MasterExecutionView
                    task={execution.task}
                    steps={execution.steps}
                    outputs={execution.outputs}
                    isComplete={execution.isCompleted || execution.isFailed}
                    onPause={execution.pauseTask}
                    onStop={execution.stopTask}
                    onNewTask={handleNewTask}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Template Browser Modal */}
      <TemplateBrowser
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onSelectTemplate={handleSelectTemplate}
      />
    </>
  );
}
