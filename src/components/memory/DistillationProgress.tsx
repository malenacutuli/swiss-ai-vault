import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, Pause, Play, Clock, CheckCircle, XCircle, Zap } from 'lucide-react';
import { useDistillationRunner } from '@/hooks/useDistillationRunner';

export function DistillationProgress() {
  const { 
    state, 
    progress, 
    processed, 
    total, 
    succeeded, 
    failed, 
    estimatedMinutes,
    itemsPerSecond,
    elapsedSeconds,
    config,
    pause, 
    resume, 
    stop 
  } = useDistillationRunner();
  
  // Don't show if not running and nothing processed
  if (!state.isRunning && processed === 0) {
    return null;
  }
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };
  
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {state.isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          <span className="font-medium text-sm">
            {state.isRunning ? 'Analyzing Memories' : 'Analysis Complete'}
          </span>
          {state.isPaused && (
            <span className="text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded">
              Paused
            </span>
          )}
        </div>
        
        {state.isRunning && (
          <div className="flex items-center gap-2">
            {state.isPaused ? (
              <Button variant="outline" size="sm" onClick={resume} className="h-7 text-xs">
                <Play className="h-3 w-3 mr-1" />
                Resume
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={pause} className="h-7 text-xs">
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={stop} className="h-7 text-xs text-muted-foreground">
              Stop
            </Button>
          </div>
        )}
      </div>
      
      {/* Progress bar */}
      <Progress value={progress} className="h-2" />
      
      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{processed} / {total} items</span>
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            {succeeded}
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="h-3 w-3" />
              {failed}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {state.isRunning && estimatedMinutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{estimatedMinutes} min left
            </span>
          )}
          
          {!state.isRunning && elapsedSeconds > 0 && (
            <span className="text-muted-foreground">
              Completed in {formatTime(elapsedSeconds)}
            </span>
          )}
        </div>
      </div>
      
      {/* Performance metrics */}
      {state.isRunning && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
          <Zap className="h-3 w-3 text-yellow-500" />
          <span>
            {itemsPerSecond.toFixed(1)} items/sec • {config.concurrency} concurrent jobs
          </span>
        </div>
      )}
    </div>
  );
}