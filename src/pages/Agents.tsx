import { useState, useCallback, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentExecution } from '@/hooks/useAgentExecution';
import { useAgentTasks } from '@/hooks/useAgentTasks';
import { useAgentMemory } from '@/hooks/useAgentMemory';
import { supabase } from '@/integrations/supabase/client';
import { AgentsModeSelector } from '@/components/agents/AgentsModeSelector';
import { AgentsFeatureCard } from '@/components/agents/AgentsFeatureCard';
import type { TaskMode } from '@/components/agents/AgentsTaskInput';
import { ConnectedToolsBar } from '@/components/agents/ConnectedToolsBar';
import { SlidesMode, PodcastMode, FlashcardsMode, QuizMode, MindMapMode } from '@/components/agents/modes';
import type { Source } from '@/components/agents/SourceUpload';
import { TemplateBrowser, type ActionTemplate } from '@/components/agents/TemplateBrowser';
import { TaskDetailModal } from '@/components/agents/TaskDetailModal';
import { MasterExecutionView } from '@/components/agents/execution/MasterExecutionView';
import { AgentsExecutionView } from '@/components/agents/AgentsExecutionView';
import { AgentsSidebar } from '@/components/agents/AgentsSidebar';
import { AgentsHeader } from '@/components/agents/AgentsHeader';
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
  const { user } = useAuth();
  const location = useLocation();
  
  // Detect if we're inside LabsLayout (route /labs/agents) to avoid duplicate sidebar/header
  const isInsideLabs = location.pathname.startsWith('/labs');
  // Core state
  const [taskPrompt, setTaskPrompt] = useState('');
  const [currentMode, setCurrentMode] = useState<TaskMode>('default');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [privacyTier, setPrivacyTier] = useState<PrivacyTier>('vault');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [connectedTools, setConnectedTools] = useState<string[]>(['github']);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Slides mode specific state
  const [selectedTemplate, setSelectedTemplate] = useState('swiss-classic');
  const [slideCount, setSlideCount] = useState(8);
  
  // NotebookLM modes state
  const [modeSources, setModeSources] = useState<Source[]>([]);
  const [podcastHostA, setPodcastHostA] = useState('kore');
  const [podcastHostB, setPodcastHostB] = useState('charon');
  const [flashcardCount, setFlashcardCount] = useState(20);
  const [flashcardDifficulty, setFlashcardDifficulty] = useState('medium');
  const [quizQuestionCount, setQuizQuestionCount] = useState(10);
  const [quizQuestionTypes, setQuizQuestionTypes] = useState(['multiple_choice', 'true_false']);
  const [mindMapDepth, setMindMapDepth] = useState(3);
  const [mindMapFocus, setMindMapFocus] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Task hooks
  const { recentTasks, deleteTask } = useAgentTasks();
  const execution = useAgentExecution({
    onComplete: () => toast.success('Task completed'),
    onError: (err) => toast.error(err),
  });
  
  // Memory hook
  const {
    getContextForTask,
    storeTaskResult,
    formatContextForAgent,
    memoryCount,
    isLoading: isLoadingMemory,
  } = useAgentMemory();
  
  // Store completed tasks as memories
  useEffect(() => {
    const storeCompletedTask = async () => {
      if (execution.task?.status === 'completed' && execution.outputs.length > 0) {
        await storeTaskResult(
          execution.task.id,
          execution.task.prompt,
          execution.task.result_summary || 'Task completed',
          execution.outputs
        );
        console.log('[Agents] Stored task result in memory');
      }
    };

    storeCompletedTask();
  }, [execution.task?.status, execution.outputs, storeTaskResult]);

  // File upload to storage
  const uploadFilesToStorage = async (files: File[]): Promise<Array<{ name: string; url: string; type: string }>> => {
    if (!user || files.length === 0) return [];
    
    const uploaded: Array<{ name: string; url: string; type: string }> = [];
    
    for (const file of files) {
      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `agent-uploads/${user.id}/${timestamp}-${safeName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('agent-outputs')
          .upload(path, file, { upsert: true });
        
        if (uploadError) {
          console.error('[Agents] Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }
        
        const { data: urlData } = supabase.storage
          .from('agent-outputs')
          .getPublicUrl(path);
        
        uploaded.push({
          name: file.name,
          url: urlData.publicUrl,
          type: file.type,
        });
      } catch (err) {
        console.error('[Agents] File upload error:', err);
      }
    }
    
    return uploaded;
  };
  
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

    if (!user) {
      toast.error('Please sign in to create tasks');
      return;
    }

    try {
      // 1. Get memory context if enabled
      let memoryContext: string | undefined;
      let memoryContexts: any[] = [];
      
      if (memoryEnabled) {
        toast.info('Searching your memory for relevant context...');
        memoryContexts = await getContextForTask(taskPrompt.trim(), 5);
        
        if (memoryContexts.length > 0) {
          memoryContext = formatContextForAgent(memoryContexts);
          console.log('[Agents] Memory context found:', memoryContexts.length, 'items');
          toast.success(`Found ${memoryContexts.length} relevant memories`);
        }
      }

      // 2. Upload attached files first
      let uploadedFiles: Array<{ name: string; url: string; type: string }> = [];
      if (attachedFiles.length > 0) {
        setIsUploading(true);
        toast.info(`Uploading ${attachedFiles.length} file(s)...`);
        uploadedFiles = await uploadFilesToStorage(attachedFiles);
        setIsUploading(false);
        
        if (uploadedFiles.length !== attachedFiles.length) {
          toast.warning('Some files failed to upload');
        }
      }

      console.log('[Agents] Creating task with:', {
        prompt: taskPrompt.trim(),
        taskType: selectedAction || 'general',
        privacyTier,
        attachments: uploadedFiles,
        connectedTools,
        hasMemoryContext: !!memoryContext,
      });

      // 3. Create the task
      const result = await execution.createTask(taskPrompt.trim(), {
        taskType: selectedAction || 'general',
        privacyTier,
        memoryContext,
        attachments: uploadedFiles,
        connectedTools,
      });

      if (result) {
        // Store context used for this task
        if (memoryContexts.length > 0) {
          for (const ctx of memoryContexts) {
            await supabase.from('agent_memory_context').insert({
              task_id: result.id,
              user_id: user.id,
              context_type: ctx.type,
              context_content: ctx.content,
              relevance_score: ctx.relevance,
              source_reference: ctx.source,
            });
          }
        }

        setTaskPrompt('');
        setAttachedFiles([]);
        setSelectedAction(null);
      }
    } catch (err: any) {
      console.error('[Agents] Submit error:', err);
      toast.error(err.message || 'Failed to create task');
      setIsUploading(false);
    }
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
    setSelectedTaskId(task.id);
    setIsDetailModalOpen(true);
  };

  const isExecuting = !execution.isIdle;
  const isSubmitting = execution.isPlanning || isUploading;

  return (
    <>
      <Helmet>
        <title>Swiss Agents | SwissVault.ai</title>
        <meta name="description" content="Autonomous AI agents that work for you. Create research, documents, presentations, and more." />
      </Helmet>
      {/* Light theme wrapper for Agents only */}
      <div className={cn("min-h-screen bg-white", !isInsideLabs && "flex")}>
        {/* Sidebar - only render if not inside LabsLayout */}
        {!isInsideLabs && (
          <AgentsSidebar 
            onNewTask={handleNewTask} 
            recentTasks={recentTasks}
            onSelectTask={handleViewRecentTask}
          />
        )}
        
        {/* Main content area - offset by sidebar width only when sidebar is shown */}
        <div className={cn(!isInsideLabs && "ml-[280px] flex-1")}>
          {/* Header only when not inside LabsLayout */}
          {!isInsideLabs && <AgentsHeader />}
          
          <main className="p-6 max-w-3xl mx-auto">
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
                    isDragging && "ring-2 ring-[#1D4E5F] ring-offset-4 rounded-xl"
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
                        className="absolute inset-0 bg-[#1D4E5F]/5 border-2 border-dashed border-[#1D4E5F] rounded-xl flex items-center justify-center z-50 backdrop-blur-sm"
                      >
                        <div className="text-center">
                          <p className="text-lg font-medium text-[#1D4E5F]">Drop files here</p>
                          <p className="text-sm text-[#1D4E5F]/70">PDF, DOCX, XLSX, CSV, Images (max 20MB)</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Task Input Card */}
                  <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6">
                      <h2 className="text-2xl font-light text-center text-[#1A1A1A] mb-6">
                        What can I do for you?
                      </h2>
                      
                      <textarea
                        value={taskPrompt}
                        onChange={(e) => setTaskPrompt(e.target.value)}
                        placeholder="Describe your task in detail..."
                        className="w-full min-h-[280px] text-base bg-transparent border-0 focus:ring-0 focus:outline-none resize-y placeholder:text-[#999999] text-[#1A1A1A]"
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
                    <div className="px-6 py-4 bg-[#FAFAF8] border-t border-[#E5E5E5] flex items-center gap-3">
                      {/* Add Files */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors"
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
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors"
                      >
                        <LayoutGrid className="h-4 w-4" />
                        <span>Templates</span>
                      </button>
                      
                      <div className="flex-1" />
                      
                      {/* Submit */}
                      <button
                        onClick={handleSubmit}
                        disabled={!taskPrompt.trim() || isSubmitting}
                        className="flex items-center gap-2 px-5 py-2 bg-[#1D4E5F] text-white rounded-lg hover:bg-[#163d4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      >
                        {isSubmitting ? (
                          <span>{isUploading ? 'Uploading...' : 'Creating...'}</span>
                        ) : (
                          <>
                            <span>Start Task</span>
                            <kbd className="text-xs opacity-70">⌘↵</kbd>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="max-w-2xl mx-auto">
                  <AgentsModeSelector
                    currentMode={currentMode}
                    onModeChange={(mode) => {
                      setCurrentMode(mode);
                      // Set starter prompts based on mode
                      const prompts: Record<string, string> = {
                        slides: 'Create a presentation about ',
                        research: 'Research and summarize ',
                        website: 'Build a website for ',
                        apps: 'Create an app that ',
                        design: 'Design a visual for ',
                      };
                      if (mode !== 'default' && prompts[mode] && !taskPrompt) {
                        setTaskPrompt(prompts[mode]);
                      }
                    }}
                  />
                </div>

                {/* Feature Card - only show when not in special modes */}
                {!['slides', 'podcast', 'flashcards', 'quiz', 'mindmap'].includes(currentMode) && (
                  <AgentsFeatureCard mode={currentMode} />
                )}

                {/* Mode-specific content */}
                {currentMode === 'slides' && (
                  <SlidesMode
                    onPromptSelect={(text) => setTaskPrompt(text)}
                    onTemplateSelect={setSelectedTemplate}
                    selectedTemplate={selectedTemplate}
                    slideCount={slideCount}
                    onSlideCountChange={setSlideCount}
                  />
                )}

                {currentMode === 'podcast' && (
                  <PodcastMode
                    onPromptSelect={(text) => setTaskPrompt(text)}
                    sources={modeSources}
                    onSourcesChange={setModeSources}
                    hostA={podcastHostA}
                    hostB={podcastHostB}
                    onHostAChange={setPodcastHostA}
                    onHostBChange={setPodcastHostB}
                  />
                )}

                {currentMode === 'flashcards' && (
                  <FlashcardsMode
                    onPromptSelect={(text) => setTaskPrompt(text)}
                    sources={modeSources}
                    onSourcesChange={setModeSources}
                    cardCount={flashcardCount}
                    onCardCountChange={setFlashcardCount}
                    difficulty={flashcardDifficulty}
                    onDifficultyChange={setFlashcardDifficulty}
                  />
                )}

                {currentMode === 'quiz' && (
                  <QuizMode
                    onPromptSelect={(text) => setTaskPrompt(text)}
                    sources={modeSources}
                    onSourcesChange={setModeSources}
                    questionCount={quizQuestionCount}
                    onQuestionCountChange={setQuizQuestionCount}
                    questionTypes={quizQuestionTypes}
                    onQuestionTypesChange={setQuizQuestionTypes}
                  />
                )}

                {currentMode === 'mindmap' && (
                  <MindMapMode
                    onPromptSelect={(text) => setTaskPrompt(text)}
                    sources={modeSources}
                    onSourcesChange={setModeSources}
                    maxDepth={mindMapDepth}
                    onMaxDepthChange={setMindMapDepth}
                    focusArea={mindMapFocus}
                    onFocusAreaChange={setMindMapFocus}
                  />
                )}

                {/* Connected Tools & Privacy */}
                <div className="max-w-2xl mx-auto">
                  <ConnectedToolsBar
                    privacyTier={privacyTier}
                    setPrivacyTier={setPrivacyTier}
                  />
                </div>

                {/* Memory Toggle */}
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-full">
                    <div className="flex items-center gap-2">
                      <Brain className={cn(
                        "h-4 w-4 transition-colors",
                        memoryEnabled ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className="text-sm font-medium text-foreground">Use Your Memory</span>
                    </div>
                    <Switch
                      checked={memoryEnabled}
                      onCheckedChange={setMemoryEnabled}
                    />
                    {memoryCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {memoryCount} memories stored
                      </span>
                    )}
                  </div>
                </div>

                {/* Recent Tasks moved to sidebar */}
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
                  <AgentsExecutionView
                    task={execution.task}
                    steps={execution.steps}
                    outputs={execution.outputs}
                    onSendMessage={(msg) => {
                      console.log('[Agents] Send message:', msg);
                      toast.info('Message sent to agent');
                    }}
                    onCancel={execution.stopTask}
                    onPause={execution.pauseTask}
                    onNewTask={handleNewTask}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        </div>
      </div>

      {/* Template Browser Modal */}
      <TemplateBrowser
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        onRetry={(task) => {
          setIsDetailModalOpen(false);
          setTaskPrompt(task.prompt);
          toast.info('Prompt loaded - click Start Task to retry');
        }}
        onDelete={async (taskId) => {
          const success = await deleteTask(taskId);
          if (!success) throw new Error('Delete failed');
        }}
      />
    </>
  );
}
