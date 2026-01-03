// src/components/memory/MemorySyncSettings.tsx

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Cloud, 
  CloudOff, 
  HardDrive, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Loader2,
  Shield,
  Database,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  createSyncProvider, 
  getAvailableProviders, 
  getSavedProviderType,
  saveProviderType,
  SyncProvider,
  SyncProviderType,
  SyncStatus
} from '@/lib/memory/sync';

interface MemorySyncSettingsProps {
  onSyncComplete?: () => void;
}

export function MemorySyncSettings({ onSyncComplete }: MemorySyncSettingsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [selectedProvider, setSelectedProvider] = useState<SyncProviderType>(getSavedProviderType());
  const [provider, setProvider] = useState<SyncProvider | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const availableProviders = getAvailableProviders();
  
  // Initialize provider
  useEffect(() => {
    const p = createSyncProvider(selectedProvider);
    setProvider(p);
    
    // Get initial status
    p.getStatus().then(setStatus);
  }, [selectedProvider]);
  
  // Get provider icon
  const getProviderIcon = (icon: string) => {
    switch (icon) {
      case 'cloud': return <Cloud className="h-5 w-5" />;
      case 'hard-drive': return <HardDrive className="h-5 w-5" />;
      case 'database': return <Database className="h-5 w-5" />;
      case 'shield': return <Shield className="h-5 w-5" />;
      default: return <Cloud className="h-5 w-5" />;
    }
  };
  
  // Handle provider change
  const handleProviderChange = useCallback(async (type: SyncProviderType) => {
    // Disconnect from current provider first
    if (provider?.isConnected()) {
      await provider.disconnect();
    }
    
    setSelectedProvider(type);
    saveProviderType(type);
    
    toast({ title: t('memory.sync.providerUpdated', 'Sync provider updated') });
  }, [provider, toast, t]);
  
  // Handle connect
  const handleConnect = useCallback(async () => {
    if (!provider || selectedProvider === 'none') return;
    
    setIsConnecting(true);
    try {
      await provider.connect();
      const newStatus = await provider.getStatus();
      setStatus(newStatus);
      toast({ 
        title: t('memory.sync.connected', 'Connected'), 
        description: t('memory.sync.syncingTo', 'Syncing to {{name}}').replace('{{name}}', provider.name)
      });
    } catch (error) {
      toast({ 
        title: t('memory.sync.connectionFailed', 'Connection failed'), 
        description: String(error), 
        variant: 'destructive' 
      });
    } finally {
      setIsConnecting(false);
    }
  }, [provider, selectedProvider, toast, t]);
  
  // Handle disconnect
  const handleDisconnect = useCallback(async () => {
    if (!provider) return;
    
    try {
      await provider.disconnect();
      const newStatus = await provider.getStatus();
      setStatus(newStatus);
      toast({ title: t('memory.sync.disconnected', 'Disconnected') });
    } catch (error) {
      toast({ 
        title: t('memory.sync.disconnectFailed', 'Disconnect failed'), 
        description: String(error), 
        variant: 'destructive' 
      });
    }
  }, [provider, toast, t]);
  
  // Handle manual sync
  const handleSync = useCallback(async () => {
    if (!provider || !provider.isConnected()) return;
    
    setIsSyncing(true);
    try {
      // Import memory manager dynamically to get export function
      const { exportMemories } = await import('@/lib/memory/memory-manager');
      const blob = await exportMemories();
      
      // Upload to provider
      const filename = `memory-backup-${Date.now()}.svmem`;
      await provider.upload(blob, filename);
      await provider.setLastSyncTime(Date.now());
      
      const newStatus = await provider.getStatus();
      setStatus(newStatus);
      
      toast({ title: t('memory.sync.syncComplete', 'Sync complete') });
      onSyncComplete?.();
    } catch (error) {
      toast({ 
        title: t('memory.sync.syncFailed', 'Sync failed'), 
        description: String(error), 
        variant: 'destructive' 
      });
    } finally {
      setIsSyncing(false);
    }
  }, [provider, toast, onSyncComplete, t]);
  
  // Format last sync time
  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return t('memory.sync.never', 'Never');
    
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return t('memory.sync.justNow', 'Just now');
    if (minutes < 60) return t('memory.sync.minutesAgo', '{{count}} minutes ago').replace('{{count}}', String(minutes));
    if (hours < 24) return t('memory.sync.hoursAgo', '{{count}} hours ago').replace('{{count}}', String(hours));
    return t('memory.sync.daysAgo', '{{count}} days ago').replace('{{count}}', String(days));
  };

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>{t('memory.sync.provider', 'Sync Provider')}</CardTitle>
          <CardDescription>
            {t('memory.sync.providerDesc', 'Choose where to backup your encrypted memory. Data is encrypted before upload.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={selectedProvider}
            onValueChange={(v) => handleProviderChange(v as SyncProviderType)}
          >
            {availableProviders.map((p) => (
              <div
                key={p.type}
                className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors ${
                  selectedProvider === p.type ? 'border-primary bg-primary/5' : 'border-border'
                } ${!p.available && p.type !== 'none' ? 'opacity-50' : ''}`}
              >
                <RadioGroupItem value={p.type} id={p.type} disabled={!p.available} />
                <Label htmlFor={p.type} className="flex items-center gap-3 flex-1 cursor-pointer">
                  {getProviderIcon(p.icon)}
                  <div className="flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.type === 'none' && t('memory.sync.localOnly', 'Memory stays on this device only')}
                      {p.type === 'google-drive' && t('memory.sync.googleDriveDesc', 'Sync to your personal Google Drive')}
                      {p.type === 's3' && t('memory.sync.s3Desc', 'Enterprise: Use your own S3 bucket')}
                      {p.type === 'swissvault-cloud' && t('memory.sync.swissvaultDesc', 'Swiss-hosted zero-knowledge sync')}
                    </p>
                  </div>
                  {!p.available && (
                    <Badge variant="secondary">{t('memory.connectors.comingSoon')}</Badge>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
      
      {/* Connection Status */}
      {selectedProvider !== 'none' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('memory.sync.connectionStatus', 'Connection Status')}</CardTitle>
          </CardHeader>
          <CardContent>
            {status?.connected ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium">{t('memory.connectors.connected')}</span>
                    {status.email && (
                      <span className="text-sm text-muted-foreground">({status.email})</span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDisconnect}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('memory.connectors.disconnect')}
                  </Button>
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t('memory.sync.lastSync')}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatLastSync(status.lastSync)}
                    </p>
                  </div>
                  <Button onClick={handleSync} disabled={isSyncing}>
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {t('memory.connectors.syncNow')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CloudOff className="h-5 w-5" />
                  <span>{t('memory.connectors.notConnected')}</span>
                </div>
                
                <Button onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 mr-2" />
                  )}
                  {t('memory.sync.connectTo', 'Connect to {{name}}').replace('{{name}}', provider?.name || '')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Security Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>{t('memory.sync.e2eEncrypted', 'End-to-End Encrypted')}</AlertTitle>
        <AlertDescription>
          {t('memory.sync.e2eDesc', 'Your memory is encrypted with your vault password before upload. The sync provider only sees encrypted data and cannot read your content.')}
        </AlertDescription>
      </Alert>
    </div>
  );
}
