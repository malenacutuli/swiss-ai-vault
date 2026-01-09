import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Pause, 
  Play,
  Trash2,
  RotateCcw,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { CheckpointSummary, CheckpointType } from '@/lib/agents/checkpoints';

interface CheckpointListProps {
  checkpoints: CheckpointSummary[];
  isLoading?: boolean;
  onRestore: (checkpointId: string) => void;
  onDelete: (checkpointId: string) => void;
  isRestoring?: boolean;
}

const TYPE_CONFIG: Record<CheckpointType, { icon: React.ElementType; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  auto: { icon: Clock, label: 'Auto', variant: 'secondary' },
  phase_complete: { icon: CheckCircle2, label: 'Phase', variant: 'default' },
  pre_dangerous: { icon: AlertTriangle, label: 'Safety', variant: 'destructive' },
  user_pause: { icon: Pause, label: 'Pause', variant: 'outline' },
  completion: { icon: CheckCircle2, label: 'Complete', variant: 'default' },
};

export function CheckpointList({
  checkpoints,
  isLoading,
  onRestore,
  onDelete,
  isRestoring,
}: CheckpointListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Clock className="h-4 w-4 animate-spin mr-2" />
        Loading checkpoints...
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <RotateCcw className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No checkpoints available</p>
        <p className="text-xs mt-1">Checkpoints are created automatically during execution</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2 pr-4">
        {checkpoints.map((checkpoint, index) => {
          const config = TYPE_CONFIG[checkpoint.type];
          const Icon = config.icon;
          const isLatest = index === 0;

          return (
            <div
              key={checkpoint.id}
              className={`
                flex items-center justify-between p-3 rounded-lg border
                ${isLatest ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}
              `}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-full ${isLatest ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`h-4 w-4 ${isLatest ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={config.variant} className="text-xs">
                      {config.label}
                    </Badge>
                    {isLatest && (
                      <Badge variant="outline" className="text-xs">
                        Latest
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>Phase {checkpoint.phaseCompleted}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{checkpoint.tasksCompleted} tasks</span>
                    <span className="mx-1">•</span>
                    <span>{formatDistanceToNow(checkpoint.createdAt, { addSuffix: true })}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRestore(checkpoint.id)}
                  disabled={isRestoring}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Resume
                </Button>

                {checkpoint.type !== 'completion' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Checkpoint</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this checkpoint. You won't be able to resume from this point.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(checkpoint.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
