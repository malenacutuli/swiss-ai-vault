import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Download, ExternalLink, Share2, Plus, Copy, Clock, Zap, Coins } from 'lucide-react';
import type { ExecutionTask, TaskOutput } from '@/hooks/useAgentExecution';

interface CompletionViewProps {
  task: ExecutionTask;
  outputs: TaskOutput[];
  onDownload: (output: TaskOutput) => void;
  onDownloadAll: () => void;
  onCreateSimilar: () => void;
  onNewTask: () => void;
  className?: string;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CompletionView({
  task,
  outputs,
  onDownload,
  onDownloadAll,
  onCreateSimilar,
  onNewTask,
  className,
}: CompletionViewProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Success Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
          <Check className="h-6 w-6 text-success" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">Task Completed</h3>
          <p className="text-sm text-muted-foreground">
            Completed in {formatDuration(task.duration_ms)}
          </p>
        </div>
      </div>

      {/* Result Summary */}
      {task.result_summary && (
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="text-sm text-foreground">{task.result_summary}</p>
        </div>
      )}

      {/* Output Cards */}
      {outputs.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Generated Files</h4>
          
          {outputs.map((output) => (
            <div
              key={output.id}
              className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {output.file_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {output.output_type} • {formatFileSize(output.file_size_bytes)}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {output.preview_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => window.open(output.preview_url!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => onDownload(output)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex justify-center gap-6 py-4 border-t border-b border-border">
        <div className="text-center">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Time</span>
          </div>
          <p className="text-lg font-medium text-foreground mt-1">
            {formatDuration(task.duration_ms)}
          </p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span className="text-sm">Steps</span>
          </div>
          <p className="text-lg font-medium text-foreground mt-1">
            {task.total_steps || '-'}
          </p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Coins className="h-4 w-4" />
            <span className="text-sm">Credits</span>
          </div>
          <p className="text-lg font-medium text-foreground mt-1">
            {task.credits_used || 0}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {outputs.length > 1 && (
          <Button
            onClick={onDownloadAll}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            Download All
          </Button>
        )}
        
        <Button
          variant="outline"
          onClick={onCreateSimilar}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          Create Similar
        </Button>
        
        <Button
          variant="outline"
          onClick={onNewTask}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>
    </div>
  );
}
