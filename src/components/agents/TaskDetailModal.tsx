import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Play,
  Pause,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  error_message: string | null;
  credits_used: number | null;
  tokens_used: number | null;
  duration_ms: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (taskId && open) {
      fetchTaskDetails();
    }
  }, [taskId, open]);

  const fetchTaskDetails = async () => {
    if (!taskId) return;
    
    setLoading(true);

    try {
      // Fetch task
      const { data: taskData, error: taskError } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;

      // Fetch steps
      const { data: stepsData } = await supabase
        .from('agent_task_steps')
        .select('*')
        .eq('task_id', taskId)
        .order('step_number');

      // Fetch outputs
      const { data: outputsData } = await supabase
        .from('agent_outputs')
        .select('*')
        .eq('task_id', taskId);

      setTask(taskData as Task);
      setSteps((stepsData || []) as TaskStep[]);
      setOutputs((outputsData || []) as TaskOutput[]);
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

  const handleDownloadOutput = (output: TaskOutput) => {
    if (output.download_url) {
      window.open(output.download_url, '_blank');
    } else {
      toast.error('Download URL not available');
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
        <DialogContent className="max-w-2xl">
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
        <DialogContent className="max-w-2xl">
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Task Details</DialogTitle>
            <Badge variant="outline" className={cn('capitalize', getStatusColor(task.status))}>
              {task.status}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Task Overview */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Task</h4>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-foreground whitespace-pre-wrap">{task.prompt}</p>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>Type: {task.task_type || 'general'}</span>
                <span>•</span>
                <span>Privacy: {task.privacy_tier || 'vault'}</span>
                {task.created_at && (
                  <>
                    <span>•</span>
                    <span>Created {formatDistanceToNow(new Date(task.created_at))} ago</span>
                  </>
                )}
              </div>
            </div>

            {/* Plan Summary */}
            {task.plan_summary && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Plan</h4>
                <p className="text-sm text-foreground">{task.plan_summary}</p>
              </div>
            )}

            {/* Progress */}
            {task.status !== 'completed' && task.status !== 'failed' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Progress</h4>
                  <span className="text-sm text-foreground">{task.progress_percentage || 0}%</span>
                </div>
                <Progress value={task.progress_percentage || 0} className="h-2" />
              </div>
            )}

            <Separator />

            {/* Execution Steps */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Execution Steps ({steps.length})
              </h4>
              <div className="space-y-3">
                {steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No steps recorded</p>
                ) : (
                  steps.map((step) => (
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
                  ))
                )}
              </div>
            </div>

            {/* Outputs */}
            {outputs.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Generated Files ({outputs.length})
                  </h4>
                  <div className="space-y-2">
                    {outputs.map((output) => (
                      <div
                        key={output.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {output.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {output.output_type?.toUpperCase()} •{' '}
                              {formatBytes(output.file_size_bytes)}
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
              </>
            )}

            {/* Result Summary */}
            {task.result_summary && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Result Summary</h4>
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <p className="text-sm text-foreground">{task.result_summary}</p>
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {task.error_message && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium text-red-500 mb-2">Error</h4>
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <p className="text-sm text-red-500">{task.error_message}</p>
                  </div>
                </div>
              </>
            )}

            {/* Stats */}
            {(task.duration_ms || task.tokens_used || task.credits_used) && (
              <>
                <Separator />
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {task.duration_ms && <span>Duration: {formatDuration(task.duration_ms)}</span>}
                  {task.tokens_used && <span>Tokens: {task.tokens_used.toLocaleString()}</span>}
                  {task.credits_used && <span>Credits: {task.credits_used}</span>}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

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
