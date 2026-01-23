import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { useHealthStorage } from '@/hooks/useHealthStorage';
import { HealthSidebar } from '@/components/vault-health/HealthSidebar';
import { RetentionMode, HealthMessage } from '@/lib/health/health-storage';
import {
  Lock, Send, Paperclip, Stethoscope, FileText, FlaskConical, Pill,
  BookOpen, ClipboardCheck, Users, MessageSquare, Settings, ChevronDown,
  ChevronRight, ExternalLink, AlertTriangle, Loader2, Wrench, Search,
  Database, Globe, X, Upload, Menu, File, FileImage, FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

type TaskType =
  | 'prior_auth_review'
  | 'claims_appeal'
  | 'icd10_lookup'
  | 'drug_interaction'
  | 'literature_search'
  | 'clinical_documentation'
  | 'care_coordination'
  | 'general_query';

interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  success?: boolean;
}

interface Citation {
  index: number;
  source_type: string;
  url?: string;
  title?: string;
  authors?: string;
  date?: string;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model_used?: string;
  latency_ms?: number;
  fallback?: boolean;
  citations?: Citation[];
  tool_calls?: ToolCall[];
  timestamp: Date;
}

// ============================================
// TASK CONFIGURATION
// ============================================

const TASK_TYPES: { value: TaskType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'prior_auth_review', label: 'Prior Authorization', icon: ClipboardCheck, description: 'Review requests against coverage criteria' },
  { value: 'claims_appeal', label: 'Claims Appeal', icon: FileText, description: 'Analyze denials and build appeals' },
  { value: 'icd10_lookup', label: 'ICD-10 Lookup', icon: Stethoscope, description: 'Search diagnosis and procedure codes' },
  { value: 'drug_interaction', label: 'Drug Interaction', icon: Pill, description: 'Check medication interactions' },
  { value: 'literature_search', label: 'Literature Search', icon: BookOpen, description: 'Search PubMed medical research' },
  { value: 'clinical_documentation', label: 'Documentation', icon: FlaskConical, description: 'Help with clinical notes' },
  { value: 'care_coordination', label: 'Care Coordination', icon: Users, description: 'Message triage and tracking' },
  { value: 'general_query', label: 'General Query', icon: MessageSquare, description: 'Ask any healthcare question' },
];

// Tool icon mapping
const TOOL_ICONS: Record<string, React.ElementType> = {
  'search': Search,
  'web_search': Globe,
  'database_query': Database,
  'drug_lookup': Pill,
  'icd10_search': Stethoscope,
  'pubmed_search': BookOpen,
  'literature_search': BookOpen,
  'lookup_icd10': Stethoscope,
  'lookup_cpt': ClipboardCheck,
  'verify_npi': Users,
  'check_drug_interaction': Pill,
  'search_pubmed': BookOpen,
  'lookup_coverage_policy': FileText,
  'get_drug_info': Pill,
};

// ============================================
// TOOL CALLS DISPLAY COMPONENT
// ============================================

function ToolCallsSection({ toolCalls, variant = 'light' }: { toolCalls: ToolCall[]; variant?: 'light' | 'dark' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  if (!toolCalls || toolCalls.length === 0) return null;

  const toggleTool = (index: number) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTools(newExpanded);
  };

  const isDark = variant === 'dark';

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-lg transition-colors",
          isDark ? "bg-white/10 hover:bg-white/20" : "bg-muted/50 hover:bg-muted border border-border"
        )}>
          <Wrench className={cn("h-4 w-4", isDark ? "text-white/60" : "text-muted-foreground")} />
          <span className={cn("flex-1 text-left text-sm", isDark ? "text-white/80" : "text-foreground")}>
            {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''} used
          </span>
          <div className="flex items-center gap-1">
            {toolCalls.slice(0, 3).map((tc, i) => {
              const Icon = TOOL_ICONS[tc.tool] || Wrench;
              return (
                <Badge key={i} variant="secondary" className={cn("text-[10px] px-1.5 py-0", isDark && "bg-white/10 text-white/70")}>
                  <Icon className="h-3 w-3 mr-0.5" />
                  {tc.tool.split('_')[0]}
                </Badge>
              );
            })}
            {toolCalls.length > 3 && (
              <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", isDark && "bg-white/10 text-white/70")}>
                +{toolCalls.length - 3}
              </Badge>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className={cn("h-4 w-4", isDark ? "text-white/60" : "text-muted-foreground")} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", isDark ? "text-white/60" : "text-muted-foreground")} />
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className={cn("mt-2 rounded-lg border overflow-hidden", isDark ? "bg-white/5 border-white/10" : "bg-card border-border")}>
          {toolCalls.map((tc, index) => {
            const Icon = TOOL_ICONS[tc.tool] || Wrench;
            const isToolExpanded = expandedTools.has(index);
            const displayName = tc.tool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            return (
              <div key={index} className={cn("border-b last:border-b-0", isDark ? "border-white/10" : "border-border/50")}>
                <button
                  onClick={() => toggleTool(index)}
                  className={cn("w-full flex items-center gap-2 px-3 py-2 transition-colors", isDark ? "hover:bg-white/5" : "hover:bg-muted/50")}
                >
                  <div className={cn("p-1.5 rounded-md border", isDark ? "bg-white/10 border-white/20" : "bg-muted border-border")}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 text-left text-sm font-medium">{displayName}</span>
                  {tc.success !== undefined && (
                    <Badge variant={tc.success ? "default" : "destructive"} className="text-[10px]">
                      {tc.success ? 'success' : 'failed'}
                    </Badge>
                  )}
                  {isToolExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isToolExpanded && (
                  <div className={cn("px-3 pb-3 pt-1 space-y-2", isDark ? "bg-white/5" : "bg-muted/30")}>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
                      <pre className={cn("text-xs rounded-md p-2 overflow-x-auto font-mono max-h-24 overflow-y-auto", isDark ? "bg-black/20" : "bg-muted")}>
                        {JSON.stringify(tc.input, null, 2)}
                      </pre>
                    </div>
                    {tc.output && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Output</div>
                        <pre className={cn("text-xs rounded-md p-2 overflow-x-auto font-mono max-h-32 overflow-y-auto", isDark ? "bg-black/20" : "bg-muted")}>
                          {JSON.stringify(tc.output, null, 2).slice(0, 500)}
                          {JSON.stringify(tc.output).length > 500 && '...'}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// FILE HELPERS
// ============================================

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel')) return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix for binary files
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function VaultHealth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading: authLoading } = useAuth();
  const { isPro, isPremium, isEnterprise, isLoadingSubscription } = useSubscription();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasAccess = isPro || isPremium || isEnterprise;

  // Health storage hook
  const {
    conversations,
    isInitialized,
    isLoading: storageLoading,
    settings,
    createConversation,
    getConversation,
    deleteConversation,
    updateTitle,
    saveMessage,
    attachDocument,
    removeDocument,
    setMemoryEnabled,
    setRetentionMode,
    updateTaskType,
    updateSettings,
  } = useHealthStorage();

  // State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('general_query');
  const [retentionMode, setRetentionModeState] = useState<RetentionMode>('90days');
  const [memoryEnabled, setMemoryEnabledState] = useState(true);
  const [attachedDocs, setAttachedDocs] = useState<Array<{ id: string; filename: string; mimeType: string; size: number }>>([]);
  const [showTaskSelector, setShowTaskSelector] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Load conversation when selected
  useEffect(() => {
    if (!currentConversationId || !isInitialized) {
      setDisplayMessages([]);
      setAttachedDocs([]);
      return;
    }

    const conv = getConversation(currentConversationId);
    if (conv) {
      // Convert HealthMessage to DisplayMessage
      const msgs: DisplayMessage[] = conv.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        tool_calls: m.toolCalls as ToolCall[],
        timestamp: new Date(m.timestamp),
        ...m.metadata,
      }));
      setDisplayMessages(msgs);
      setTaskType(conv.taskType as TaskType);
      setRetentionModeState(conv.retentionMode);
      setMemoryEnabledState(conv.memoryEnabled);
      setAttachedDocs(conv.documents.map(d => ({
        id: d.id,
        filename: d.filename,
        mimeType: d.mimeType,
        size: d.size,
      })));
      setShowTaskSelector(msgs.length === 0);
    }
  }, [currentConversationId, isInitialized, getConversation]);

  // Handle query params on mount
  useEffect(() => {
    const query = searchParams.get('query');
    const type = searchParams.get('type') as TaskType;
    if (query) {
      setInput(query);
      if (type && TASK_TYPES.some(t => t.value === type)) {
        setTaskType(type);
      }
    }
  }, [searchParams]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  // Create new conversation
  const handleNewConversation = useCallback(() => {
    if (!isInitialized) return;

    const id = createConversation(
      'New Health Session',
      settings.defaultRetentionMode,
      settings.memoryEnabled,
      'general_query'
    );
    if (id) {
      setCurrentConversationId(id);
      setDisplayMessages([]);
      setAttachedDocs([]);
      setTaskType('general_query');
      setRetentionModeState(settings.defaultRetentionMode);
      setMemoryEnabledState(settings.memoryEnabled);
      setShowTaskSelector(true);
      setPendingFiles([]);
    }
  }, [isInitialized, createConversation, settings]);

  // Select conversation
  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setPendingFiles([]);
  }, []);

  // Delete conversation
  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setDisplayMessages([]);
      setAttachedDocs([]);
    }
  }, [deleteConversation, currentConversationId]);

  // Rename conversation
  const handleRenameConversation = useCallback((id: string, title: string) => {
    updateTitle(id, title);
  }, [updateTitle]);

  // Handle task type change
  const handleTaskTypeChange = useCallback((type: string) => {
    setTaskType(type as TaskType);
    if (currentConversationId) {
      updateTaskType(currentConversationId, type);
    }
  }, [currentConversationId, updateTaskType]);

  // Handle retention mode change
  const handleRetentionModeChange = useCallback((mode: RetentionMode) => {
    setRetentionModeState(mode);
    if (currentConversationId) {
      setRetentionMode(currentConversationId, mode);
    }
  }, [currentConversationId, setRetentionMode]);

  // Handle memory toggle
  const handleMemoryEnabledChange = useCallback((enabled: boolean) => {
    setMemoryEnabledState(enabled);
    if (currentConversationId) {
      setMemoryEnabled(currentConversationId, enabled);
    }
  }, [currentConversationId, setMemoryEnabled]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/csv',
      'image/png',
      'image/jpeg',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    const validFiles = files.filter(f => {
      if (!allowedTypes.includes(f.type)) {
        toast({
          title: 'Unsupported file type',
          description: `${f.name} is not a supported file type`,
          variant: 'destructive',
        });
        return false;
      }
      if (f.size > 30 * 1024 * 1024) { // 30MB limit (matches Claude Chat)
        toast({
          title: 'File too large',
          description: `${f.name} exceeds 30MB limit`,
          variant: 'destructive',
        });
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...validFiles]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove pending file
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle document removal
  const handleRemoveDocument = useCallback((docId: string) => {
    if (currentConversationId) {
      removeDocument(currentConversationId, docId);
      setAttachedDocs(prev => prev.filter(d => d.id !== docId));
    }
  }, [currentConversationId, removeDocument]);

  // Submit message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Ensure we have a conversation
    let convId = currentConversationId;
    if (!convId) {
      convId = createConversation(
        input.trim().slice(0, 50) + (input.length > 50 ? '...' : ''),
        retentionMode,
        memoryEnabled,
        taskType
      );
      if (!convId) {
        toast({ title: 'Error', description: 'Failed to create conversation', variant: 'destructive' });
        return;
      }
      setCurrentConversationId(convId);
    }

    // Process pending files first
    const contextChunks: Array<{ filename: string; content: string }> = [];
    for (const file of pendingFiles) {
      try {
        let content: string;
        if (file.type.startsWith('text/') || file.type === 'text/plain' || file.type === 'text/csv') {
          content = await readFileAsText(file);
        } else {
          content = await readFileAsBase64(file);
        }

        // Attach to conversation storage
        attachDocument(convId, file.name, file.type, content, file.size);

        // Add to context for query
        if (file.type.startsWith('text/') || file.type === 'text/csv') {
          contextChunks.push({ filename: file.name, content });
        }
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }
    setPendingFiles([]);

    // Reload attached docs
    const conv = getConversation(convId);
    if (conv) {
      setAttachedDocs(conv.documents.map(d => ({
        id: d.id,
        filename: d.filename,
        mimeType: d.mimeType,
        size: d.size,
      })));
    }

    // Create user message
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setDisplayMessages(prev => [...prev, userMessage]);
    saveMessage(convId, 'user', input.trim());

    setInput('');
    setIsLoading(true);
    setShowTaskSelector(false);

    try {
      // Build conversation history for context
      const conversationHistory = displayMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Call healthcare-query edge function
      const { data, error } = await supabase.functions.invoke('healthcare-query', {
        body: {
          query: userMessage.content,
          task_type: taskType,
          context_chunks: contextChunks,
          conversation_history: conversationHistory,
        },
      });

      if (error) {
        throw new Error(error.message || 'Healthcare query failed');
      }

      // Debug: log the response
      console.log('[VaultHealth] Edge function response:', data);

      // Handle case where data might be empty or missing content
      if (!data || !data.content) {
        console.error('[VaultHealth] No content in response:', data);
        throw new Error('No response content received from healthcare assistant');
      }

      const assistantMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content,
        model_used: data.model_used,
        latency_ms: data.latency_ms,
        fallback: data.fallback,
        citations: data.citations,
        tool_calls: data.tool_calls || [],
        timestamp: new Date(),
      };

      setDisplayMessages(prev => [...prev, assistantMessage]);

      // Save to storage
      saveMessage(
        convId,
        'assistant',
        data.content,
        data.tool_calls,
        {
          model_used: data.model_used,
          latency_ms: data.latency_ms,
          fallback: data.fallback,
          citations: data.citations,
        }
      );

    } catch (error: unknown) {
      console.error('Healthcare query error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process healthcare query',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (authLoading || isLoadingSubscription || storageLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Access denied
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-8">
        <Card className="max-w-md w-full text-center p-8 border-primary/20">
          <Lock className="w-16 h-16 mx-auto mb-4 text-primary/40" />
          <h2 className="text-2xl font-semibold text-primary mb-2">Health Professionals is a Pro Feature</h2>
          <p className="text-muted-foreground mb-6">Access advanced healthcare AI with prior auth review, claims analysis, and clinical decision support tools.</p>
          <Button onClick={() => navigate('/ghost/pricing')} className="bg-primary hover:bg-primary/90">Upgrade to Access</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Sidebar */}
      <HealthSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={conversations}
        selectedConversation={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        currentTaskType={taskType}
        onTaskTypeChange={handleTaskTypeChange}
        currentRetentionMode={retentionMode}
        onRetentionModeChange={handleRetentionModeChange}
        memoryEnabled={memoryEnabled}
        onMemoryEnabledChange={handleMemoryEnabledChange}
        attachedDocuments={attachedDocs}
        onRemoveDocument={handleRemoveDocument}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <Stethoscope className="w-6 h-6 text-[#1D4E5F]" />
            <h1 className="text-xl font-semibold text-[#1D4E5F]">Vault Health</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
            <Settings className="w-5 h-5 text-muted-foreground" />
          </Button>
        </header>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Task Selector */}
            {showTaskSelector && displayMessages.length === 0 && (
              <div className="text-center py-8">
                <Stethoscope className="w-16 h-16 mx-auto mb-4 text-[#1D4E5F]/20" />
                <h2 className="text-2xl font-semibold text-[#1D4E5F] mb-2">Healthcare Intelligence</h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Select a task type or ask any healthcare administration question.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
                  {TASK_TYPES.map((task) => (
                    <button
                      key={task.value}
                      onClick={() => setTaskType(task.value)}
                      className={cn(
                        "flex flex-col items-center p-4 rounded-lg border transition-all",
                        taskType === task.value
                          ? "border-[#1D4E5F] bg-[#1D4E5F]/5"
                          : "border-border hover:border-[#1D4E5F]/50"
                      )}
                    >
                      <task.icon className={cn("w-6 h-6 mb-2", taskType === task.value ? "text-[#1D4E5F]" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-medium", taskType === task.value ? "text-[#1D4E5F]" : "text-foreground")}>{task.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {displayMessages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-4", msg.role === 'user' ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl p-4",
                  msg.role === 'user' ? "bg-[#1D4E5F] text-white" : "bg-card border border-border"
                )}>
                  {/* Message Content */}
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
                    {msg.content}
                  </div>

                  {/* Model info badge */}
                  {msg.model_used && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                      <Badge variant="secondary" className="text-[10px]">
                        {msg.model_used}
                      </Badge>
                      {msg.latency_ms && (
                        <span className="text-[10px] text-muted-foreground">{msg.latency_ms}ms</span>
                      )}
                      {msg.fallback && (
                        <Badge variant="outline" className="text-[10px] text-amber-600">fallback</Badge>
                      )}
                    </div>
                  )}

                  {/* Tool Calls Display */}
                  {msg.tool_calls && msg.tool_calls.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <ToolCallsSection toolCalls={msg.tool_calls} variant={msg.role === 'user' ? 'dark' : 'light'} />
                    </div>
                  )}

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-xs font-medium mb-2 opacity-70">Sources:</p>
                      <div className="space-y-1">
                        {msg.citations.map((citation) => (
                          <a
                            key={citation.index}
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100"
                          >
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">[{citation.index}]</Badge>
                            <span className="truncate flex-1">{citation.title || citation.url}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-4 justify-start">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1D4E5F]" />
                    <span className="text-sm text-muted-foreground">Processing with Claude...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Pending Files Preview */}
        {pendingFiles.length > 0 && (
          <div className="px-6 py-2 border-t border-border bg-muted/30">
            <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
              {pendingFiles.map((file, index) => {
                const FileIcon = getFileIcon(file.type);
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border text-sm"
                  >
                    <FileIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1"
                      onClick={() => removePendingFile(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border px-6 py-4 bg-card/50">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Select value={taskType} onValueChange={(v) => handleTaskTypeChange(v)}>
                <SelectTrigger className="w-[200px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((task) => (
                    <SelectItem key={task.value} value={task.value}>
                      <div className="flex items-center gap-2">
                        <task.icon className="w-4 h-4" />
                        {task.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-4 h-4 mr-1" />
                Attach
              </Button>
            </div>

            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a healthcare question..."
                className="min-h-[60px] max-h-[200px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button type="submit" disabled={!input.trim() || isLoading} className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90 h-auto">
                <Send className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>For informational purposes only. Always consult healthcare providers for medical decisions.</span>
            </div>
          </form>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Health Assistant Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Retention Mode</label>
              <Select
                value={settings.defaultRetentionMode}
                onValueChange={(v) => updateSettings({ defaultRetentionMode: v as RetentionMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forever">Forever</SelectItem>
                  <SelectItem value="90days">90 Days</SelectItem>
                  <SelectItem value="zerotrace">Zero Trace</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Enable Memory by Default</label>
              <input
                type="checkbox"
                checked={settings.memoryEnabled}
                onChange={(e) => updateSettings({ memoryEnabled: e.target.checked })}
                className="rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Show Disclaimer</label>
              <input
                type="checkbox"
                checked={settings.showDisclaimer}
                onChange={(e) => updateSettings({ showDisclaimer: e.target.checked })}
                className="rounded"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
