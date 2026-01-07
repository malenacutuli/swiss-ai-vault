import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  RotateCcw,
  Copy,
  Loader2,
  FileText,
  Pause,
  Trash2,
  Brain,
  Link2,
  MessageSquare,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { AgentOutputRenderer } from './AgentOutputRenderer';
import { TaskResultRenderer } from './TaskResultRenderer';

interface TaskStep {
  id: string;
  step_number: number;
  step_type: string;
  tool_name: string | null;
  description: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

interface TaskOutput {
  id: string;
  file_name: string;
  output_type: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  download_url: string | null;
  preview_url: string | null;
  file_path: string | null;
}

interface ReasoningEntry {
  id: string;
  agent_type: string;
  reasoning_text: string;
  confidence_score: number | null;
  sources_used: any;
  decisions_made: any;
  model_used: string | null;
  thought_summary?: string | null;
  thinking_tokens?: number | null;
  created_at: string | null;
}

interface SourceEntry {
  id: string;
  source_type: string;
  source_title: string | null;
  source_url: string | null;
  source_snippet: string | null;
  citation_key: string | null;
  relevance_score: number | null;
}

interface CommunicationEntry {
  id: string;
  from_agent: string;
  to_agent: string;
  message_type: string;
  message_content: string;
  created_at: string | null;
}

interface Task {
  id: string;
  prompt: string;
  status: string | null;
  task_type: string | null;
  privacy_tier: string | null;
  current_step: number | null;
  total_steps: number | null;
  progress_percentage: number | null;
  plan_summary: string | null;
  result_summary: string | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  credits_used: number | null;
  tokens_used: number | null;
  duration_ms: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  gemini_model?: string | null;
  thinking_level?: string | null;
  total_tokens?: number | null;
  total_cost_usd?: number | null;
}

interface TaskDetailModalProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (task: Task) => void;
  onDelete?: (taskId: string) => Promise<void>;
}

export function TaskDetailModal({
  taskId,
  open,
  onOpenChange,
  onRetry,
  onDelete,
}: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningEntry[]>([]);
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [communications, setCommunications] = useState<CommunicationEntry[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('thinking');

  useEffect(() => {
    if (taskId && open) {
      fetchTaskDetails();
    }
  }, [taskId, open]);

  const fetchTaskDetails = async () => {
    if (!taskId) return;
    
    setLoading(true);

    try {
      // Fetch all data in parallel
      const [taskRes, stepsRes, outputsRes, reasoningRes, sourcesRes, commsRes] = await Promise.all([
        supabase.from('agent_tasks').select('*').eq('id', taskId).single(),
        supabase.from('agent_task_steps').select('*').eq('task_id', taskId).order('step_number'),
        supabase.from('agent_outputs').select('*').eq('task_id', taskId),
        supabase.from('agent_reasoning').select('*').eq('task_id', taskId).order('created_at'),
        supabase.from('agent_sources').select('*').eq('task_id', taskId).order('citation_key'),
        supabase.from('agent_communications').select('*').eq('task_id', taskId).order('created_at'),
      ]);

      if (taskRes.error) throw taskRes.error;

      setTask(taskRes.data as Task);
      setSteps((stepsRes.data || []) as TaskStep[]);
      setOutputs((outputsRes.data || []) as TaskOutput[]);
      setReasoning((reasoningRes.data || []) as ReasoningEntry[]);
      setSources((sourcesRes.data || []) as SourceEntry[]);
      setCommunications((commsRes.data || []) as CommunicationEntry[]);
    } catch (error) {
      console.error('[TaskDetailModal] Error fetching task:', error);
      toast.error('Failed to load task details');
    }

    setLoading(false);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'executing':
      case 'running':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'planning':
      case 'queued':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStepStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
      case 'executing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return 'text-muted-foreground';
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const handleDownloadOutput = async (output: TaskOutput) => {
    try {
      // Try file_path first for signed URL (most secure)
      if (output.file_path) {
        const { data, error } = await supabase.storage
          .from('agent-outputs')
          .createSignedUrl(output.file_path, 3600); // 1 hour expiry
        
        if (data?.signedUrl) {
          // Create download link
          const a = document.createElement('a');
          a.href = data.signedUrl;
          a.download = output.file_name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return;
        }
      }
      
      // Fallback: Try to extract path from download_url and create signed URL
      if (output.download_url?.includes('/agent-outputs/')) {
        const pathMatch = output.download_url.match(/\/agent-outputs\/(.+)$/);
        if (pathMatch) {
          const { data } = await supabase.storage
            .from('agent-outputs')
            .createSignedUrl(pathMatch[1], 3600);
          
          if (data?.signedUrl) {
            const a = document.createElement('a');
            a.href = data.signedUrl;
            a.download = output.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
          }
        }
      }
      
      // Last resort: open download_url directly
      if (output.download_url) {
        window.open(output.download_url, '_blank');
      } else {
        toast.error('Download URL not available');
      }
    } catch (err) {
      console.error('[TaskDetailModal] Download error:', err);
      toast.error('Failed to download file');
    }
  };

  const handleCopyPrompt = () => {
    if (task?.prompt) {
      navigator.clipboard.writeText(task.prompt);
      toast.success('Prompt copied to clipboard');
    }
  };

  const handleRetry = () => {
    if (task && onRetry) {
      onRetry(task);
      onOpenChange(false);
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!task) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-3" />
            <p>Task not found</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Task Details</DialogTitle>
            <Badge variant="outline" className={cn('capitalize', getStatusColor(task.status))}>
              {task.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Task Summary */}
          <div className="px-6 py-4 border-b border-border">
            <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">{task.prompt}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.created_at && format(new Date(task.created_at), 'MMM d, yyyy HH:mm')}
              </span>
              {task.gemini_model && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {task.gemini_model}
                </span>
              )}
              {(task.total_tokens || task.tokens_used) && (
                <Badge variant="secondary" className="text-xs">
                  {((task.total_tokens || task.tokens_used) ?? 0).toLocaleString()} tokens
                </Badge>
              )}
              {task.total_cost_usd && task.total_cost_usd > 0 && (
                <Badge variant="secondary" className="text-xs">
                  ${task.total_cost_usd.toFixed(4)}
                </Badge>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 grid grid-cols-4 w-auto">
              <TabsTrigger value="thinking" className="text-xs">
                <Brain className="h-3.5 w-3.5 mr-1.5" />
                Thinking ({reasoning.length})
              </TabsTrigger>
              <TabsTrigger value="sources" className="text-xs">
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
                Sources ({sources.length})
              </TabsTrigger>
              <TabsTrigger value="comms" className="text-xs">
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Chat ({communications.length})
              </TabsTrigger>
              <TabsTrigger value="results" className="text-xs">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Results ({outputs.length})
              </TabsTrigger>
            </TabsList>

            {/* Thinking Tab */}
            <TabsContent value="thinking" className="flex-1 overflow-hidden m-0 p-0">
              <ScrollArea className="h-[320px] px-6 py-4">
                {reasoning.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Brain className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No reasoning data recorded</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reasoning.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="p-4 rounded-lg bg-card border border-border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {entry.agent_type}
                          </Badge>
                          {entry.confidence_score && (
                            <span className={cn('text-xs font-medium', getConfidenceColor(entry.confidence_score))}>
                              {(entry.confidence_score * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </div>
                        {entry.thought_summary && (
                          <p className="text-xs text-primary/80 mb-2 italic">
                            {entry.thought_summary}
                          </p>
                        )}
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {entry.reasoning_text}
                        </p>
                        {entry.model_used && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Model: {entry.model_used}
                            {entry.thinking_tokens && ` | ${entry.thinking_tokens} thinking tokens`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Sources Tab */}
            <TabsContent value="sources" className="flex-1 overflow-hidden m-0 p-0">
              <ScrollArea className="h-[320px] px-6 py-4">
                {sources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Link2 className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No sources cited</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="p-3 rounded-lg bg-card border border-border"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {source.citation_key && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {source.citation_key}
                              </Badge>
                            )}
                            <span className="text-sm font-medium text-foreground truncate">
                              {source.source_title || 'Untitled Source'}
                            </span>
                          </div>
                          {source.source_url && (
                            <a
                              href={source.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        {source.source_snippet && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                            {source.source_snippet}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span className="capitalize">{source.source_type}</span>
                          {source.relevance_score && (
                            <>
                              <span>|</span>
                              <span>Relevance: {(source.relevance_score * 100).toFixed(0)}%</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Communications Tab */}
            <TabsContent value="comms" className="flex-1 overflow-hidden m-0 p-0">
              <ScrollArea className="h-[320px] px-6 py-4">
                {communications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No agent communications recorded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {communications.map((comm) => (
                      <div
                        key={comm.id}
                        className="p-3 rounded-lg bg-card border border-border"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {comm.from_agent}
                          </Badge>
                          <span className="text-muted-foreground text-xs">{'→'}</span>
                          <Badge variant="outline" className="text-xs">
                            {comm.to_agent}
                          </Badge>
                          {comm.created_at && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(new Date(comm.created_at), 'HH:mm:ss')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {comm.message_content}
                        </p>
                        <Badge variant="secondary" className="text-xs mt-2 capitalize">
                          {comm.message_type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="flex-1 overflow-hidden m-0 p-0">
              <ScrollArea className="h-[320px] px-6 py-4">
                <div className="space-y-4">
                  {/* Full Result Object - Smart Rendering */}
                  {task.result && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-muted-foreground">Result</h4>
                      <TaskResultRenderer 
                        result={task.result as Record<string, unknown>} 
                        artifactType={task.task_type || undefined}
                      />
                    </div>
                  )}

                  {/* Fallback: Result Summary as text/markdown */}
                  {!task.result && task.result_summary && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-muted-foreground">Result Summary</h4>
                      <AgentOutputRenderer 
                        content={task.result_summary} 
                        outputType={task.task_type || undefined}
                      />
                    </div>
                  )}

                  {/* Error */}
                  {task.error_message && (
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <h4 className="text-xs font-medium text-red-500 mb-1">Error</h4>
                      <p className="text-sm text-red-500">{task.error_message}</p>
                    </div>
                  )}

                  {/* Outputs */}
                  {outputs.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Generated Files ({outputs.length})
                      </h4>
                      <div className="space-y-2">
                        {outputs.map((output) => (
                          <div
                            key={output.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {output.file_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {output.output_type?.toUpperCase()} • {formatBytes(output.file_size_bytes)}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadOutput(output)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execution Steps */}
                  {steps.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Execution Steps ({steps.length})
                      </h4>
                      <div className="space-y-2">
                        {steps.map((step) => (
                          <div
                            key={step.id}
                            className="flex gap-3 p-3 rounded-lg bg-card border border-border"
                          >
                            <div className="shrink-0 mt-0.5">{getStepStatusIcon(step.status)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Step {step.step_number}
                                </span>
                                {step.tool_name && (
                                  <Badge variant="secondary" className="text-xs">
                                    {step.tool_name}
                                  </Badge>
                                )}
                              </div>
                              {step.description && (
                                <p className="text-sm text-foreground">{step.description}</p>
                              )}
                              {step.error_message && (
                                <p className="text-xs text-red-500 mt-1">Error: {step.error_message}</p>
                              )}
                              {step.duration_ms && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Completed in {formatDuration(step.duration_ms)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  {(task.duration_ms || task.tokens_used || task.credits_used) && (
                    <Separator />
                  )}
                  {(task.duration_ms || task.tokens_used || task.credits_used) && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {task.duration_ms && <span>Duration: {formatDuration(task.duration_ms)}</span>}
                      {task.tokens_used && <span>Tokens: {task.tokens_used.toLocaleString()}</span>}
                      {task.credits_used && <span>Credits: {task.credits_used}</span>}
                    </div>
                  )}

                  {outputs.length === 0 && !task.result_summary && !task.error_message && steps.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No results yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
              <Copy className="h-4 w-4 mr-1.5" />
              Copy Prompt
            </Button>
            {task.status === 'failed' && onRetry && (
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Retry
              </Button>
            )}
            {onDelete && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={async () => {
                  if (!taskId) return;
                  const confirmed = window.confirm('Are you sure you want to delete this task? This action cannot be undone.');
                  if (!confirmed) return;
                  
                  setIsDeleting(true);
                  try {
                    await onDelete(taskId);
                    toast.success('Task deleted');
                    onOpenChange(false);
                  } catch (err) {
                    toast.error('Failed to delete task');
                  }
                  setIsDeleting(false);
                }}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </div>
          <Button variant="default" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
