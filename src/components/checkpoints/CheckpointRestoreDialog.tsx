import { useState } from 'react';
import { AlertTriangle, RotateCcw, Clock, Zap, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ServerCheckpoint, CheckpointRestoreResult } from '@/hooks/useCheckpoints';

interface CheckpointRestoreDialogProps {
  checkpoint: ServerCheckpoint | null;
  currentStep?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: number) => Promise<CheckpointRestoreResult>;
  onRestoreComplete?: (result: CheckpointRestoreResult) => void;
}

export function CheckpointRestoreDialog({
  checkpoint,
  currentStep,
  open,
  onOpenChange,
  onRestore,
  onRestoreComplete,
}: CheckpointRestoreDialogProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleRestore = async () => {
    if (!checkpoint || !confirmed) return;

    setIsRestoring(true);
    try {
      const result = await onRestore(checkpoint.version);
      if (result.success && onRestoreComplete) {
        onRestoreComplete(result);
      }
      if (result.success) {
        onOpenChange(false);
      }
    } finally {
      setIsRestoring(false);
      setConfirmed(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmed(false);
    }
    onOpenChange(isOpen);
  };

  if (!checkpoint) return null;

  const stepsToRollback = currentStep ? currentStep - checkpoint.step_number : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Restore Checkpoint
          </DialogTitle>
          <DialogDescription>
            Restore the run to a previous checkpoint state
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Checkpoint info */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <Badge variant="outline">v{checkpoint.version}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Step</span>
              <span className="font-medium">{checkpoint.step_number}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <Badge variant="secondary" className="capitalize">
                {checkpoint.checkpoint_type.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">
                {format(new Date(checkpoint.created_at), 'MMM d, h:mm a')}
              </span>
            </div>
            {checkpoint.description && (
              <div className="pt-2 border-t">
                <span className="text-sm text-muted-foreground block mb-1">Description</span>
                <span className="text-sm">{checkpoint.description}</span>
              </div>
            )}
          </div>

          {/* Warning */}
          {stepsToRollback > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This will roll back <strong>{stepsToRollback} step{stepsToRollback !== 1 ? 's' : ''}</strong> of progress.
                Any work done after this checkpoint will need to be re-executed.
              </AlertDescription>
            </Alert>
          )}

          {/* What will happen */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">What will happen:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Run state will be restored to step {checkpoint.step_number}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Context and messages will be restored to this point</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>The run will be set to "resuming" state</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>Any checkpoints after v{checkpoint.version} will be invalidated</span>
              </li>
            </ul>
          </div>

          {/* Confirmation */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
            <Checkbox
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <Label
              htmlFor="confirm"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I understand that restoring this checkpoint will discard any progress made after
              step {checkpoint.step_number}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRestore}
            disabled={!confirmed || isRestoring}
            className="gap-2"
          >
            {isRestoring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Restore to v{checkpoint.version}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
