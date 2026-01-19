import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import {
  Lock, Send, Paperclip, Stethoscope, FileText, FlaskConical, Pill,
  BookOpen, ClipboardCheck, Users, MessageSquare, Settings, ChevronDown,
  ChevronRight, ExternalLink, AlertTriangle, Loader2, Wrench, Search,
  Database, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
}

interface Citation {
  index: number;
  source_type: string;
  url?: string;
  title?: string;
  authors?: string;
  date?: string;
}

interface Message {
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
                  {tc.output?.results && (
                    <Badge variant="outline" className="text-[10px]">
                      {Array.isArray(tc.output.results) ? tc.output.results.length : 0} results
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
// MAIN COMPONENT
// ============================================

export default function VaultHealth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading: authLoading } = useAuth();
  const { isPro, isPremium, isEnterprise, isLoadingSubscription } = useSubscription();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasAccess = isPro || isPremium || isEnterprise;

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('general_query');
  const [showTaskSelector, setShowTaskSelector] = useState(true);

  // Handle query params
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
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowTaskSelector(false);

    try {
      // Call healthcare-query edge function
      const { data, error } = await supabase.functions.invoke('healthcare-query', {
        body: {
          query: userMessage.content,
          task_type: taskType,
        },
      });

      if (error) {
        throw new Error(error.message || 'Healthcare query failed');
      }

      const assistantMessage: Message = {
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

      setMessages(prev => [...prev, assistantMessage]);

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
  if (authLoading || isLoadingSubscription) {
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
          <h2 className="text-2xl font-semibold text-primary mb-2">Vault Health is a Pro Feature</h2>
          <p className="text-muted-foreground mb-6">Access healthcare AI with prior auth review, claims analysis, and clinical tools.</p>
          <Button onClick={() => navigate('/ghost/pricing')} className="bg-primary hover:bg-primary/90">Upgrade to Pro</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Stethoscope className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold text-primary">Vault Health</h1>
          <Badge variant="outline" className="text-xs">Claude-Powered</Badge>
        </div>
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </Button>
      </header>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Task Selector */}
          {showTaskSelector && messages.length === 0 && (
            <div className="text-center py-8">
              <Stethoscope className="w-16 h-16 mx-auto mb-4 text-primary/20" />
              <h2 className="text-2xl font-semibold text-primary mb-2">Healthcare Intelligence</h2>
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
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <task.icon className={cn("w-6 h-6 mb-2", taskType === task.value ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", taskType === task.value ? "text-primary" : "text-foreground")}>{task.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-4", msg.role === 'user' ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl p-4",
                msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-card border border-border"
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
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Processing with Claude...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border px-6 py-4 bg-card/50">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
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
            <Button type="button" variant="ghost" size="sm" className="h-8">
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
            <Button type="submit" disabled={!input.trim() || isLoading} className="bg-primary hover:bg-primary/90 h-auto">
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
  );
}
