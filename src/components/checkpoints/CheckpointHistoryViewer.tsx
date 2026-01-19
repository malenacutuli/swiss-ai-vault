import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  X,
  Save,
  RefreshCw,
  GitCompare,
  Settings,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCheckpoints, type ServerCheckpoint, type CheckpointRestoreResult } from '@/hooks/useCheckpoints';
import { CheckpointTimeline } from './CheckpointTimeline';
import { CheckpointDetails } from './CheckpointDetails';
import { CheckpointCompare } from './CheckpointCompare';
import { CheckpointRestoreDialog } from './CheckpointRestoreDialog';

interface CheckpointHistoryViewerProps {
  runId: string;
  currentStep?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore?: (result: CheckpointRestoreResult) => void;
}

export function CheckpointHistoryViewer({
  runId,
  currentStep,
  open,
  onOpenChange,
  onRestore,
}: CheckpointHistoryViewerProps) {
  const {
    serverCheckpoints,
    isLoading,
    isCreating,
    listServerCheckpoints,
    createServerCheckpoint,
    restoreFromCheckpoint,
    configureAutoCheckpoint,
  } = useCheckpoints({ runId });

  // UI state
  const [activeTab, setActiveTab] = useState('timeline');
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<ServerCheckpoint | null>(null);
  const [compareCheckpoint, setCompareCheckpoint] = useState<ServerCheckpoint | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [checkpointToRestore, setCheckpointToRestore] = useState<ServerCheckpoint | null>(null);

  // Auto-checkpoint settings
  const [autoCheckpointEnabled, setAutoCheckpointEnabled] = useState(false);
  const [autoCheckpointInterval, setAutoCheckpointInterval] = useState(300); // 5 minutes

  // Manual checkpoint state
  const [manualDescription, setManualDescription] = useState('');

  // Select first checkpoint on load
  useEffect(() => {
    if (serverCheckpoints.length > 0 && !selectedCheckpoint) {
      setSelectedCheckpoint(serverCheckpoints[0]);
    }
  }, [serverCheckpoints, selectedCheckpoint]);

  const handleRefresh = useCallback(() => {
    listServerCheckpoints();
  }, [listServerCheckpoints]);

  const handleSelectCheckpoint = useCallback((checkpoint: ServerCheckpoint) => {
    setSelectedCheckpoint(checkpoint);
    if (activeTab === 'compare' && !compareCheckpoint) {
      // If in compare mode and no compare selected, auto-select
    }
  }, [activeTab, compareCheckpoint]);

  const handleCompareCheckpoint = useCallback((checkpoint: ServerCheckpoint) => {
    if (compareCheckpoint?.id === checkpoint.id) {
      setCompareCheckpoint(null);
    } else {
      setCompareCheckpoint(checkpoint);
      setActiveTab('compare');
    }
  }, [compareCheckpoint]);

  const handleRestoreClick = useCallback((checkpoint: ServerCheckpoint) => {
    setCheckpointToRestore(checkpoint);
    setRestoreDialogOpen(true);
  }, []);

  const handleRestore = useCallback(async (version: number): Promise<CheckpointRestoreResult> => {
    return await restoreFromCheckpoint(version);
  }, [restoreFromCheckpoint]);

  const handleRestoreComplete = useCallback((result: CheckpointRestoreResult) => {
    handleRefresh();
    if (onRestore) {
      onRestore(result);
    }
  }, [handleRefresh, onRestore]);

  const handleCreateManualCheckpoint = useCallback(async () => {
    if (!currentStep) return;

    await createServerCheckpoint(currentStep, {}, {
      type: 'manual',
      description: manualDescription || undefined,
    });
    setManualDescription('');
  }, [createServerCheckpoint, currentStep, manualDescription]);

  const handleAutoCheckpointChange = useCallback(async (enabled: boolean) => {
    const success = await configureAutoCheckpoint(enabled, autoCheckpointInterval);
    if (success) {
      setAutoCheckpointEnabled(enabled);
    }
  }, [configureAutoCheckpoint, autoCheckpointInterval]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl p-0" side="right">
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="px-6 py-4 border-b shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Checkpoint History
                  </SheetTitle>
                  <SheetDescription>
                    {serverCheckpoints.length} checkpoint{serverCheckpoints.length !== 1 ? 's' : ''} saved
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2">
                  {/* Settings Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <div className="space-y-4">
                        <h4 className="font-medium">Checkpoint Settings</h4>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Auto-checkpoint</Label>
                            <p className="text-xs text-muted-foreground">
                              Automatically save checkpoints
                            </p>
                          </div>
                          <Switch
                            checked={autoCheckpointEnabled}
                            onCheckedChange={handleAutoCheckpointChange}
                          />
                        </div>

                        {autoCheckpointEnabled && (
                          <div className="space-y-2">
                            <Label>Interval (seconds)</Label>
                            <Input
                              type="number"
                              min={60}
                              max={3600}
                              value={autoCheckpointInterval}
                              onChange={(e) => setAutoCheckpointInterval(parseInt(e.target.value) || 300)}
                            />
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button variant="outline" size="icon" onClick={handleRefresh}>
                    <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                  </Button>
                </div>
              </div>

              {/* Manual Checkpoint */}
              <div className="flex items-center gap-2 mt-4">
                <Input
                  placeholder="Checkpoint description (optional)"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleCreateManualCheckpoint}
                  disabled={isCreating || !currentStep}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Now
                </Button>
              </div>
            </SheetHeader>

            {/* Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mt-4 shrink-0">
                <TabsTrigger value="timeline" className="gap-2">
                  <History className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="compare" className="gap-2">
                  <GitCompare className="h-4 w-4" />
                  Compare
                  {compareCheckpoint && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="timeline" className="h-full m-0 p-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
                    {/* Timeline */}
                    <div className="border-r overflow-hidden">
                      <ScrollArea className="h-full p-6">
                        <CheckpointTimeline
                          checkpoints={serverCheckpoints}
                          selectedId={selectedCheckpoint?.id}
                          compareId={compareCheckpoint?.id}
                          onSelect={handleSelectCheckpoint}
                          onCompare={handleCompareCheckpoint}
                          onRestore={handleRestoreClick}
                          isLoading={isLoading}
                        />
                      </ScrollArea>
                    </div>

                    {/* Details */}
                    <div className="p-6 overflow-hidden">
                      <CheckpointDetails
                        checkpoint={selectedCheckpoint}
                        onRestore={() => selectedCheckpoint && handleRestoreClick(selectedCheckpoint)}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="compare" className="h-full m-0 p-6">
                  {compareCheckpoint ? (
                    <div className="h-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Comparing:</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCompareCheckpoint(null)}
                          >
                            Clear comparison
                            <X className="h-3 w-3 ml-2" />
                          </Button>
                        </div>
                      </div>
                      <CheckpointCompare
                        checkpointA={selectedCheckpoint}
                        checkpointB={compareCheckpoint}
                      />
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <h3 className="font-medium mb-1">No comparison selected</h3>
                        <p className="text-sm">
                          Click the compare icon on a checkpoint to start comparing
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Restore Dialog */}
      <CheckpointRestoreDialog
        checkpoint={checkpointToRestore}
        currentStep={currentStep}
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        onRestore={handleRestore}
        onRestoreComplete={handleRestoreComplete}
      />
    </>
  );
}
