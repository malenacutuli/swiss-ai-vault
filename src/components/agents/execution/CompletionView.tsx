import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function getFileTypeIcon(type: string): string {
  switch (type?.toLowerCase()) {
    case 'pptx': return '📊';
    case 'docx': return '📄';
    case 'xlsx': return '📈';
    case 'pdf': return '📕';
    case 'png':
    case 'jpg':
    case 'jpeg': return '🖼️';
    default: return '📁';
  }
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
    <div className={cn('space-y-8 animate-fade-in', className)}>
      {/* Success Header - Swiss minimalist */}
      <div className="text-center space-y-4">
        <div 
          className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center animate-scale-in"
        >
          <span className="text-2xl text-primary-foreground">✓</span>
        </div>
        
        <div className="space-y-1">
          <h3 className="text-xl font-medium text-foreground">Task Complete</h3>
          <p className="text-sm text-muted-foreground">
            Finished in {formatDuration(task.duration_ms)}
          </p>
        </div>
      </div>

      {/* Result Summary */}
      {task.result_summary && (
        <div className="bg-muted/30 rounded-xl p-5 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <p className="text-sm text-foreground leading-relaxed">
            {task.result_summary}
          </p>
        </div>
      )}

      {/* Output Files - Card style */}
      {outputs.length > 0 && (
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Generated Files
          </h4>
          
          <div className="space-y-2">
            {outputs.map((output, index) => (
              <div
                key={output.id}
                className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer animate-fade-in"
                style={{ animationDelay: `${200 + index * 50}ms` }}
                onClick={() => onDownload(output)}
              >
                {/* File Icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
                  {getFileTypeIcon(output.output_type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {output.file_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs uppercase">
                      {output.output_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(output.file_size_bytes)}
                    </span>
                  </div>
                </div>
                
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Download →
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Row - Minimal */}
      <div 
        className="flex justify-center gap-8 py-4 border-t border-b border-border animate-fade-in"
        style={{ animationDelay: '300ms' }}
      >
        <div className="text-center">
          <p className="text-2xl font-light text-foreground">
            {formatDuration(task.duration_ms)}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
            Duration
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-2xl font-light text-foreground">
            {task.total_steps || '-'}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
            Steps
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-2xl font-light text-foreground">
            {task.credits_used || 0}
          </p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
            Credits
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div 
        className="flex flex-wrap items-center justify-center gap-3 animate-fade-in"
        style={{ animationDelay: '400ms' }}
      >
        {outputs.length > 1 && (
          <Button onClick={onDownloadAll} className="gap-2">
            Download All
          </Button>
        )}
        
        <Button variant="outline" onClick={onCreateSimilar}>
          Create Similar
        </Button>
        
        <Button variant="ghost" onClick={onNewTask}>
          New Task
        </Button>
      </div>
    </div>
  );
}
