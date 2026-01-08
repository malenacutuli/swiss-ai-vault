import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Brain, Loader2 } from 'lucide-react';
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
import { extractFilesForPrompt } from '@/utils/fileExtractor';

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
  
  // Handle incoming state from Studio navigation
  useEffect(() => {
    const state = location.state as { taskId?: string; taskType?: string; sources?: any[] } | null;
    
    if (state?.taskId) {
      console.log('[Agents] Loading task from Studio:', state.taskId);
      
      // Load the task via execution hook - just pass the taskId
      execution.loadTask(state.taskId);
      
      // Clear the router state to prevent reloading on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
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
  
  // Mode to task type mapping for proper backend routing
  // Mode to task type mapping for proper backend routing
  const MODE_TO_TASK_TYPE: Record<string, string> = {
    // NotebookLM-style modes
    'flashcards': 'flashcards',
    'quiz': 'quiz',
    'podcast': 'podcast',
    'audio': 'audio_summary',
    'audio_summary': 'audio_summary',
    'mindmap': 'mind_map',
    'mind_map': 'mind_map',
    'video': 'video_summary',
    'video_summary': 'video_summary',
    // Document modes
    'slides': 'slides',
    'presentation': 'slides',
    'document': 'document',
    'report': 'document',
    'spreadsheet': 'spreadsheet',
    'excel': 'spreadsheet',
    // Research modes
    'research': 'research',
    'deep_research': 'research',
    // Default
    'general': 'general',
    'chat': 'general',
    'default': 'general',
  };

  // Modes that REQUIRE sources
  const SOURCE_REQUIRED_MODES = [
    'flashcards', 'quiz', 'podcast', 'audio', 'mindmap', 
    'mind_map', 'audio_summary', 'video_summary'
  ];

  // Submit handler - complete implementation
  const handleSubmit = async () => {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: VALIDATION
    // ═══════════════════════════════════════════════════════════════════════
    
    const hasPrompt = taskPrompt.trim().length > 0;
    const hasAttachedFiles = attachedFiles.length > 0;
    const hasModeFiles = modeSources.some(s => s.type === 'file' && s.file);
    const hasModeUrls = modeSources.some(s => s.type === 'url' && s.url);
    const hasModeText = modeSources.some(s => s.type === 'text' && s.content);
    const hasAnySources = hasAttachedFiles || hasModeFiles || hasModeUrls || hasModeText;

    if (!hasPrompt && !hasAnySources) {
      toast.error('Please enter a message or add sources.');
      return;
    }

    if (!user) {
      toast.error('Please sign in to create tasks');
      return;
    }

    const currentModeNormalized = currentMode?.toLowerCase() || '';
    const modeRequiresSources = SOURCE_REQUIRED_MODES.includes(currentModeNormalized);
    
    if (modeRequiresSources && !hasAnySources) {
      toast.error(`Please add at least one source to generate ${currentMode}.`);
      return;
    }

    setIsUploading(true);

    try {
      // ═══════════════════════════════════════════════════════════════════════
      // STEP 2: GATHER ALL FILES FROM BOTH PIPELINES
      // ═══════════════════════════════════════════════════════════════════════
      
      // Get files from mode sources (Flashcards/Quiz/Podcast UI)
      const modeFiles: File[] = modeSources
        .filter(s => s.type === 'file' && s.file)
        .map(s => s.file as File);
      
      // Merge with chat-attached files, deduplicate by name+size
      const seenFileNames = new Set<string>();
      const allFiles: File[] = [];
      
      for (const file of [...attachedFiles, ...modeFiles]) {
        const key = `${file.name}-${file.size}`;
        if (!seenFileNames.has(key)) {
          seenFileNames.add(key);
          allFiles.push(file);
        }
      }

      console.log('[handleSubmit] Files gathered:', {
        attachedFiles: attachedFiles.length,
        modeFiles: modeFiles.length,
        allFilesDeduped: allFiles.length,
      });

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 3: EXTRACT TEXT CONTENT FROM FILES
      // ═══════════════════════════════════════════════════════════════════════
      
      let extractedDocuments = '';
      
      if (allFiles.length > 0) {
        toast.info(`Extracting content from ${allFiles.length} file(s)...`);
        
        // Use the extractFilesForPrompt utility which handles PDF, DOCX, etc.
        extractedDocuments = await extractFilesForPrompt(allFiles);
        console.log('[handleSubmit] Extracted content length:', extractedDocuments.length);
        
        if (extractedDocuments.length > 100) {
          toast.success(`Extracted content from ${allFiles.length} file(s)`);
        } else {
          toast.warning('Some files could not be processed');
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 4: INCLUDE URL SOURCES
      // ═══════════════════════════════════════════════════════════════════════
      
      let urlSourcesContent = '';
      const urls = modeSources.filter(s => s.type === 'url' && s.url);
      
      if (urls.length > 0) {
        urlSourcesContent = '\n\n--- URL SOURCES ---\n';
        urls.forEach((s, i) => {
          urlSourcesContent += `${i + 1}. ${s.url}\n`;
          if (s.title) urlSourcesContent += `   Title: ${s.title}\n`;
        });
        urlSourcesContent += '--- END URL SOURCES ---\n';
      }

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 5: INCLUDE TEXT SOURCES
      // ═══════════════════════════════════════════════════════════════════════
      
      let textSourcesContent = '';
      const texts = modeSources.filter(s => s.type === 'text' && s.content);
      
      if (texts.length > 0) {
        textSourcesContent = '\n\n--- PASTED TEXT SOURCES ---\n\n';
        texts.forEach((s, i) => {
          textSourcesContent += `=== Text ${i + 1} ===\n`;
          textSourcesContent += s.content;
          textSourcesContent += '\n\n';
        });
        textSourcesContent += '--- END TEXT SOURCES ---\n';
      }

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 6: BUILD FINAL PROMPT
      // ═══════════════════════════════════════════════════════════════════════
      
      let fullPrompt = '';
      
      // Add all sources first
      if (extractedDocuments) fullPrompt += extractedDocuments;
      if (urlSourcesContent) fullPrompt += urlSourcesContent;
      if (textSourcesContent) fullPrompt += textSourcesContent;
      
      // Add user request
      if (fullPrompt) {
        fullPrompt += '\n\n--- User Request ---\n';
      }
      fullPrompt += taskPrompt.trim();

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 7: DETERMINE CORRECT TASK TYPE
      // ═══════════════════════════════════════════════════════════════════════
      
      // Priority: selectedAction > currentMode mapping > 'general'
      const effectiveTaskType = selectedAction 
        || MODE_TO_TASK_TYPE[currentModeNormalized] 
        || 'general';

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 8: DIAGNOSTIC LOGGING
      // ═══════════════════════════════════════════════════════════════════════
      
      const diagnostics = {
        currentMode,
        selectedAction,
        effectiveTaskType,
        fileCount: allFiles.length,
        urlCount: urls.length,
        textCount: texts.length,
        promptLength: fullPrompt.length,
        hasDocumentMarkers: fullPrompt.includes('--- UPLOADED DOCUMENTS ---') || fullPrompt.includes('--- Document'),
        hasUrlMarkers: fullPrompt.includes('--- URL SOURCES ---'),
        hasTextMarkers: fullPrompt.includes('--- PASTED TEXT SOURCES ---'),
      };
      
      console.log('[handleSubmit] Diagnostics:', diagnostics);
      
      // CRITICAL: Verify sources are included
      if (modeRequiresSources && !diagnostics.hasDocumentMarkers && !diagnostics.hasUrlMarkers && !diagnostics.hasTextMarkers) {
        console.error('[handleSubmit] BUG: Mode requires sources but no markers in prompt!');
        toast.error('Failed to include source content. Please try again.');
        setIsUploading(false);
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 9: UPLOAD FILES TO STORAGE (for reference/re-download)
      // ═══════════════════════════════════════════════════════════════════════
      
      let uploadedFiles: Array<{ name: string; url: string; type: string }> = [];
      
      if (allFiles.length > 0) {
        try {
          uploadedFiles = await uploadFilesToStorage(allFiles);
        } catch (err) {
          console.warn('[handleSubmit] File upload to storage failed:', err);
          // Non-blocking - content is already extracted
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 10: GET MEMORY CONTEXT
      // ═══════════════════════════════════════════════════════════════════════
      
      let memoryContext: string | undefined;
      let memoryContexts: any[] = [];
      
      if (memoryEnabled) {
        memoryContexts = await getContextForTask(taskPrompt.trim(), 5);
        
        if (memoryContexts.length > 0) {
          memoryContext = formatContextForAgent(memoryContexts);
          console.log('[handleSubmit] Memory context found:', memoryContexts.length, 'items');
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 11: EXECUTE TASK
      // ═══════════════════════════════════════════════════════════════════════
      
      const result = await execution.createTask(fullPrompt, {
        taskType: effectiveTaskType,
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

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 12: CLEANUP & UI UPDATE
        // ═══════════════════════════════════════════════════════════════════════
        
        setTaskPrompt('');
        setAttachedFiles([]);
        setModeSources([]);
        setSelectedAction(null);
        
        toast.success('Task started');
      }
    } catch (err: any) {
      console.error('[handleSubmit] Error:', err);
      toast.error(err.message || 'Failed to start task');
    } finally {
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
        <title>Swiss Agents | Swiss BrAIn</title>
        <meta name="description" content="Autonomous AI agents that work for you. Create research, documents, presentations, and more." />
      </Helmet>
      {/* Light theme wrapper for Agents only */}
      <div className="min-h-screen bg-white">
        {/* Sidebar - 280px fixed */}
        <AgentsSidebar 
          onNewTask={handleNewTask} 
          recentTasks={recentTasks}
          onSelectTask={handleViewRecentTask}
        />
        
        {/* Main content area - offset by sidebar width */}
        <div className="ml-[280px]">
          <AgentsHeader />
          
          <main className="p-8 max-w-3xl mx-auto">
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
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {isUploading ? 'Processing files...' : 'Creating...'}
                          </span>
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
