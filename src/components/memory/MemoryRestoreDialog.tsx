// src/components/memory/MemoryRestoreDialog.tsx

import { useState, useEffect } from 'react';
import { Cloud, Download, HardDrive, Loader2, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMemorySync } from '@/hooks/useMemorySync';
import { useToast } from '@/hooks/use-toast';

interface MemoryRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function MemoryRestoreDialog({ 
  open, 
  onOpenChange,
  onComplete 
}: MemoryRestoreDialogProps) {
  const { toast } = useToast();
  const { restoreFromCloud, checkCloudBackup, connected, provider } = useMemorySync();
  
  const [backupInfo, setBackupInfo] = useState<{
    hasBackup: boolean;
    lastModified?: number;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreComplete, setRestoreComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get provider display name
  const getProviderName = () => {
    switch (provider) {
      case 'google-drive': return 'Google Drive';
      case 's3': return 'Amazon S3';
      case 'swissvault-cloud': return 'SwissVault Cloud';
      default: return 'cloud storage';
    }
  };
  
  // Check for cloud backup on open
  useEffect(() => {
    if (open && connected) {
      setIsChecking(true);
      setError(null);
      
      checkCloudBackup()
        .then(setBackupInfo)
        .catch((err) => setError(err instanceof Error ? err.message : 'Check failed'))
        .finally(() => setIsChecking(false));
    }
  }, [open, connected, checkCloudBackup]);
  
  // Handle restore
  const handleRestore = async () => {
    setIsRestoring(true);
    setRestoreProgress(10);
    setError(null);
    
    try {
      setRestoreProgress(30);
      const result = await restoreFromCloud();
      setRestoreProgress(90);
      
      if (result.success) {
        setRestoreProgress(100);
        setRestoreComplete(true);
        
        toast({
          title: 'Memory restored',
          description: `${result.count} items restored from backup.`
        });
        
        setTimeout(() => {
          onComplete?.();
          onOpenChange(false);
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
      setRestoreProgress(0);
    } finally {
      setIsRestoring(false);
    }
  };
  
  // Handle start fresh
  const handleStartFresh = () => {
    // Mark that user chose to start fresh (don't ask again)
    localStorage.setItem('sv_memory_restore_declined', Date.now().toString());
    onOpenChange(false);
  };
  
  // Format date
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            Cloud Backup Found
          </DialogTitle>
          <DialogDescription>
            We found a memory backup in your {getProviderName()}. Would you like to restore it?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isChecking ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : backupInfo?.hasBackup ? (
            <>
              {restoreComplete ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-4 flex items-center justify-center">
                    <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="font-medium">Restore Complete!</p>
                  <p className="text-sm text-muted-foreground mt-1">Your memory has been restored.</p>
                </div>
              ) : isRestoring ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm">Restoring memory...</span>
                  </div>
                  <Progress value={restoreProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    This may take a moment
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last backup:</span>
                      <span className="font-medium">{formatDate(backupInfo.lastModified)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Source:</span>
                      <span className="font-medium">{getProviderName()}</span>
                    </div>
                  </div>
                  
                  <Alert>
                    <AlertDescription className="text-sm">
                      Restoring will load your previous memory into this device. 
                      Your data is encrypted and secure.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p>No backup found in {getProviderName()}.</p>
            </div>
          )}
        </div>
        
        {!isChecking && !isRestoring && !restoreComplete && backupInfo?.hasBackup && (
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleStartFresh}>
              <HardDrive className="h-4 w-4 mr-2" />
              Start Fresh
            </Button>
            <Button onClick={handleRestore}>
              <Download className="h-4 w-4 mr-2" />
              Restore Backup
            </Button>
          </DialogFooter>
        )}
        
        {!backupInfo?.hasBackup && !isChecking && (
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>
              Continue
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
