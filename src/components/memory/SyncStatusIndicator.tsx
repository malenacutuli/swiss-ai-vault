// src/components/memory/SyncStatusIndicator.tsx

import { useTranslation } from 'react-i18next';
import { Cloud, CloudOff, Loader2, AlertCircle, Check, HardDrive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMemorySync } from '@/hooks/useMemorySync';

export function SyncStatusIndicator() {
  const { t } = useTranslation();
  const { 
    status, 
    connected, 
    lastSync, 
    error, 
    provider,
    sync,
    isSyncing 
  } = useMemorySync({ autoSync: true });
  
  // Format last sync time
  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return t('memory.sync.never', 'Never synced');
    
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return t('memory.sync.justNow', 'Just now');
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return new Date(timestamp).toLocaleDateString();
  };
  
  // Get provider display name
  const getProviderName = () => {
    switch (provider) {
      case 'google-drive': return 'Google Drive';
      case 's3': return 'Amazon S3';
      case 'swissvault-cloud': return 'SwissBrAIn Cloud';
      default: return t('memory.sync.localOnly', 'Local Only');
    }
  };
  
  if (provider === 'none') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1 cursor-default">
              <HardDrive className="h-3 w-3" />
              {t('memory.sync.localOnly', 'Local Only')}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{t('memory.sync.localOnlyDesc', 'Memory is stored locally on this device only.')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('memory.sync.enableSyncHint', 'Enable sync in Sync Settings for backup.')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (!connected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 cursor-default text-muted-foreground">
              <CloudOff className="h-3 w-3" />
              Disconnected
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">Not connected to {getProviderName()}.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Reconnect in Sync Settings.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (isSyncing) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Syncing...
      </Badge>
    );
  }
  
  if (status === 'error' && error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1 cursor-default">
              <AlertCircle className="h-3 w-3" />
              Sync Error
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{error}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => sync()}
            >
              Retry
            </Button>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1 cursor-default text-green-700 dark:text-green-400">
            <Check className="h-3 w-3" />
            Synced
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Connected to {getProviderName()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Last sync: {formatTime(lastSync)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
