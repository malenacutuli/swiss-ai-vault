import React, { useState } from 'react';
import { RotateCcw, Save, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCheckpoints } from '@/hooks/useCheckpoints';
import { CheckpointList } from './CheckpointList';
import type { CheckpointState, Checkpoint } from '@/lib/agents/checkpoints';
import { toast } from 'sonner';

interface CheckpointPanelProps {
  taskId: string;
  getCurrentState?: () => CheckpointState;
  onRestore?: (checkpoint: Checkpoint) => void;
  isExecuting?: boolean;
}

export function CheckpointPanel({
  taskId,
  getCurrentState,
  onRestore,
  isExecuting = false,
}: CheckpointPanelProps) {
  const {
    checkpoints,
    isLoading,
    isCreating,
    loadCheckpoint,
    createCheckpoint,
    deleteCheckpoint,
  } = useCheckpoints({ taskId });

  const [isRestoring, setIsRestoring] = useState(false);

  const handleCreateCheckpoint = async () => {
    if (!getCurrentState) {
      toast.error('Cannot create checkpoint: no state available');
      return;
    }

    const state = getCurrentState();
    await createCheckpoint(state, 'Manual checkpoint');
  };

  const handleRestore = async (checkpointId: string) => {
    setIsRestoring(true);
    try {
      const checkpoint = await loadCheckpoint(checkpointId);
      if (checkpoint && onRestore) {
        onRestore(checkpoint);
        toast.success('Checkpoint loaded. Ready to resume.');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async (checkpointId: string) => {
    await deleteCheckpoint(checkpointId);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Checkpoints
            </CardTitle>
            <CardDescription className="mt-1">
              Resume execution from a saved checkpoint
            </CardDescription>
          </div>
          
          {getCurrentState && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateCheckpoint}
              disabled={isCreating || !isExecuting}
            >
              {isCreating ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Now
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {checkpoints.length > 0 && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Checkpoints are automatically saved every 5 minutes and on phase completion.
              The last 5 checkpoints are kept for each task.
            </AlertDescription>
          </Alert>
        )}

        <CheckpointList
          checkpoints={checkpoints}
          isLoading={isLoading}
          onRestore={handleRestore}
          onDelete={handleDelete}
          isRestoring={isRestoring}
        />
      </CardContent>
    </Card>
  );
}
