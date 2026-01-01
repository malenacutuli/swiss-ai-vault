// src/components/memory/MemorySyncSettings.tsx

import { useState, useEffect, useCallback } from 'react';
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
    
    toast({ title: 'Sync provider updated' });
  }, [provider, toast]);
  
  // Handle connect
  const handleConnect = useCallback(async () => {
    if (!provider || selectedProvider === 'none') return;
    
    setIsConnecting(true);
    try {
      await provider.connect();
      const newStatus = await provider.getStatus();
      setStatus(newStatus);
      toast({ 
        title: 'Connected', 
        description: `Syncing to ${provider.name}` 
      });
    } catch (error) {
      toast({ 
        title: 'Connection failed', 
        description: String(error), 
        variant: 'destructive' 
      });
    } finally {
      setIsConnecting(false);
    }
  }, [provider, selectedProvider, toast]);
  
  // Handle disconnect
  const handleDisconnect = useCallback(async () => {
    if (!provider) return;
    
    try {
      await provider.disconnect();
      const newStatus = await provider.getStatus();
      setStatus(newStatus);
      toast({ title: 'Disconnected' });
    } catch (error) {
      toast({ 
        title: 'Disconnect failed', 
        description: String(error), 
        variant: 'destructive' 
      });
    }
  }, [provider, toast]);
  
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
      
      toast({ title: 'Sync complete' });
      onSyncComplete?.();
    } catch (error) {
      toast({ 
        title: 'Sync failed', 
        description: String(error), 
        variant: 'destructive' 
      });
    } finally {
      setIsSyncing(false);
    }
  }, [provider, toast, onSyncComplete]);
  
  // Format last sync time
  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Provider</CardTitle>
          <CardDescription>
            Choose where to backup your encrypted memory. Data is encrypted before upload.
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
                      {p.type === 'none' && 'Memory stays on this device only'}
                      {p.type === 'google-drive' && 'Sync to your personal Google Drive'}
                      {p.type === 's3' && 'Enterprise: Use your own S3 bucket'}
                      {p.type === 'swissvault-cloud' && 'Swiss-hosted zero-knowledge sync'}
                    </p>
                  </div>
                  {!p.available && (
                    <Badge variant="secondary">Coming Soon</Badge>
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
            <CardTitle>Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            {status?.connected ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Connected</span>
                    {status.email && (
                      <span className="text-sm text-muted-foreground">({status.email})</span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDisconnect}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Last Sync</p>
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
                    Sync Now
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CloudOff className="h-5 w-5" />
                  <span>Not connected</span>
                </div>
                
                <Button onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 mr-2" />
                  )}
                  Connect to {provider?.name}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Security Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>End-to-End Encrypted</AlertTitle>
        <AlertDescription>
          Your memory is encrypted with your vault password before upload. 
          The sync provider only sees encrypted data and cannot read your content.
        </AlertDescription>
      </Alert>
    </div>
  );
}
