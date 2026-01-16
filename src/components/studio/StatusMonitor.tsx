import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GenerationTask {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt: Date;
  error?: string;
}

interface StatusMonitorProps {
  tasks: GenerationTask[];
  onDismiss: (taskId: string) => void;
  onViewResult: (taskId: string) => void;
}

export function StatusMonitor({ tasks, onDismiss, onViewResult }: StatusMonitorProps) {
  const activeTasks = tasks.filter(t => t.status !== 'completed' || 
    (t.status === 'completed' && Date.now() - t.startedAt.getTime() < 30000));

  if (activeTasks.length === 0) return null;

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      podcast: 'Audio Summary',
      slides: 'Presentation',
      mindmap: 'Mind Map',
      quiz: 'Quiz',
      flashcards: 'Flashcards',
      report: 'Report',
      faq: 'FAQ',
      timeline: 'Timeline',
      table: 'Data Table',
      study_guide: 'Study Guide',
    };
    return labels[type] || type.replace(/_/g, ' ');
  };

  const getEstimatedTime = (type: string) => {
    const times: Record<string, string> = {
      podcast: '2-5 min',
      slides: '30-60 sec',
      mindmap: '20-40 sec',
      quiz: '15-30 sec',
      flashcards: '15-30 sec',
      report: '30-60 sec',
    };
    return times[type] || '~30 sec';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-muted/50 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-medium text-sm text-foreground">Studio Generations</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {activeTasks.filter(t => t.status === 'processing').length} active
            </span>
          </div>
        </div>
        
        {/* Task List */}
        <div className="divide-y divide-border max-h-64 overflow-auto">
          {activeTasks.map((task) => (
            <div key={task.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">
                    {getTypeLabel(task.type)}
                  </span>
                  {task.status === 'processing' && (
                    <span className="text-xs text-muted-foreground">
                      ~{getEstimatedTime(task.type)}
                    </span>
                  )}
                </div>

                <div className="flex items-center">
                  {task.status === 'processing' && (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  )}
                  {task.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  {task.status === 'failed' && (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  )}
                  {task.status === 'pending' && (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    task.status === 'completed' && "bg-green-500",
                    task.status === 'failed' && "bg-destructive",
                    task.status === 'processing' && "bg-primary",
                    task.status === 'pending' && "bg-muted-foreground"
                  )}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              
              {/* Status Text */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {task.status === 'processing' && 'Processing in europe-west6...'}
                  {task.status === 'completed' && 'Ready'}
                  {task.status === 'failed' && (task.error || 'Failed')}
                  {task.status === 'pending' && 'Queued'}
                </span>
                
                {task.status === 'completed' && (
                  <button
                    onClick={() => onViewResult(task.id)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    View →
                  </button>
                )}
                
                {task.status === 'failed' && (
                  <button
                    onClick={() => onDismiss(task.id)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-2 bg-muted/30 border-t border-border">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            🇨🇭 All processing in Swiss data centers
          </span>
        </div>
      </div>
    </div>
  );
}
