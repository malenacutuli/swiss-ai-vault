import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import {
  Lock,
  Send,
  Paperclip,
  Stethoscope,
  FileText,
  FlaskConical,
  Pill,
  BookOpen,
  ClipboardCheck,
  Users,
  MessageSquare,
  Settings,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  toolResults?: ToolResult[];
  timestamp: Date;
}

interface Citation {
  index: number;
  source_type: string;
  url?: string;
  title?: string;
  authors?: string;
  date?: string;
}

interface ToolResult {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

// ============================================
// TASK CONFIGURATION
// ============================================

const TASK_TYPES: { value: TaskType; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'prior_auth_review',
    label: 'Prior Authorization',
    icon: ClipboardCheck,
    description: 'Review requests against coverage criteria'
  },
  {
    value: 'claims_appeal',
    label: 'Claims Appeal',
    icon: FileText,
    description: 'Analyze denials and build appeals'
  },
  {
    value: 'icd10_lookup',
    label: 'ICD-10 Lookup',
    icon: Stethoscope,
    description: 'Search diagnosis and procedure codes'
  },
  {
    value: 'drug_interaction',
    label: 'Drug Interaction',
    icon: Pill,
    description: 'Check medication interactions'
  },
  {
    value: 'literature_search',
    label: 'Literature Search',
    icon: BookOpen,
    description: 'Search PubMed medical research'
  },
  {
    value: 'clinical_documentation',
    label: 'Documentation',
    icon: FlaskConical,
    description: 'Help with clinical notes'
  },
  {
    value: 'care_coordination',
    label: 'Care Coordination',
    icon: Users,
    description: 'Message triage and tracking'
  },
  {
    value: 'general_query',
    label: 'General Query',
    icon: MessageSquare,
    description: 'Ask any healthcare question'
  },
];

// ============================================
// COMPONENT
// ============================================

export default function VaultHealth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { isPro, isPremium, isEnterprise, loading: subLoading } = useSubscription();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Access control
  const hasAccess = isPro || isPremium || isEnterprise;

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('general_query');
  const [showTaskSelector, setShowTaskSelector] = useState(true);

  // Handle query params (from Ghost/Health deep link)
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get auth token from Supabase
  const getAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

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
      const token = await getAuthToken();

      // Call Swiss K8s Healthcare API
      const response = await fetch('https://api.swissbrain.ai/healthcare/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: userMessage.content,
          task_type: taskType,
          // TODO: Add context_chunks from local documents
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content,
        citations: data.citations,
        toolResults: data.tool_results,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error: unknown) {
      console.error('Healthcare query error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to process healthcare query',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (authLoading || subLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#1D4E5F]" />
      </div>
    );
  }

  // Access denied
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white p-8">
        <Card className="max-w-md w-full text-center p-8 border-[#1D4E5F]/20">
          <Lock className="w-16 h-16 mx-auto mb-4 text-[#1D4E5F]/40" />
          <h2 className="text-2xl font-semibold text-[#1D4E5F] mb-2 font-['Playfair_Display'] italic">
            Vault Health is a Pro Feature
          </h2>
          <p className="text-gray-600 mb-6">
            Access healthcare AI with prior auth review, claims analysis, and clinical tools.
          </p>
          <Button
            onClick={() => navigate('/ghost/pricing')}
            className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90"
          >
            Upgrade to Pro
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Stethoscope className="w-6 h-6 text-[#1D4E5F]" />
          <h1 className="text-xl font-semibold text-[#1D4E5F] font-['Playfair_Display'] italic">
            Vault Health
          </h1>
          <Badge variant="outline" className="text-xs">
            Claude-Powered
          </Badge>
        </div>
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5 text-gray-500" />
        </Button>
      </header>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Task Selector (shown when no messages) */}
          {showTaskSelector && messages.length === 0 && (
            <div className="text-center py-8">
              <Stethoscope className="w-16 h-16 mx-auto mb-4 text-[#1D4E5F]/20" />
              <h2 className="text-2xl font-semibold text-[#1D4E5F] mb-2 font-['Playfair_Display'] italic">
                Healthcare Intelligence
              </h2>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Select a task type or ask any healthcare administration question.
                Documents are processed locally - your data stays in your browser.
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
                        : "border-gray-200 hover:border-[#1D4E5F]/50"
                    )}
                  >
                    <task.icon className={cn(
                      "w-6 h-6 mb-2",
                      taskType === task.value ? "text-[#1D4E5F]" : "text-gray-400"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      taskType === task.value ? "text-[#1D4E5F]" : "text-gray-700"
                    )}>
                      {task.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-4",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[85%] rounded-2xl p-4",
                msg.role === 'user'
                  ? "bg-[#1D4E5F] text-white"
                  : "bg-[#F8F9FA] text-gray-800 border border-gray-200"
              )}>
                {/* Message Content */}
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {msg.content}
                </div>

                {/* Tool Results (collapsed by default) */}
                {msg.toolResults && msg.toolResults.length > 0 && (
                  <Collapsible className="mt-3 pt-3 border-t border-gray-200/30">
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs opacity-70 hover:opacity-100">
                      <ChevronDown className="w-3 h-3" />
                      {msg.toolResults.length} tool(s) used
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2">
                      {msg.toolResults.map((tool, i) => (
                        <div key={i} className="text-xs bg-white/10 rounded p-2">
                          <span className="font-medium">{tool.tool}</span>
                          <span className="opacity-60 ml-2">
                            {JSON.stringify(tool.input).slice(0, 50)}...
                          </span>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200/30">
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
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            [{citation.index}]
                          </Badge>
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
              <div className="bg-[#F8F9FA] border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1D4E5F]" />
                  <span className="text-sm text-gray-600">Processing with Claude...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-gray-200 px-6 py-4 bg-white">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          {/* Task Type Selector (inline) */}
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

          {/* Input */}
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
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90 h-auto"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>

          {/* Medical Disclaimer */}
          <div className="flex items-center gap-2 mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>For informational purposes only. Always consult healthcare providers for medical decisions.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
