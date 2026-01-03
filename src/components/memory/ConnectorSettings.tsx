import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare,
  Github,
  Mail,
  FolderOpen,
  FileText,
  RefreshCw,
  Check,
  AlertCircle,
  ExternalLink,
  LogIn
} from 'lucide-react';
import { useIntegrations, INTEGRATION_DEFINITIONS } from '@/hooks/useIntegrations';
import { useAuth } from '@/contexts/AuthContext';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { supabase } from '@/integrations/supabase/client';
import { syncConnector, getIntegrationId, type ConnectorType } from '@/lib/memory/connector-sync';
import { toast } from 'sonner';

interface ConnectorConfig {
  id: ConnectorType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const CONNECTOR_CONFIGS: ConnectorConfig[] = [
  {
    id: 'slack',
    name: 'Slack',
    icon: <MessageSquare className="h-5 w-5" />,
    description: 'Sync messages and threads to your memory'
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: <Github className="h-5 w-5" />,
    description: 'Sync issues, PRs, and discussions'
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: <Mail className="h-5 w-5" />,
    description: 'Sync important emails to memory'
  },
  {
    id: 'googledrive',
    name: 'Google Drive',
    icon: <FolderOpen className="h-5 w-5" />,
    description: 'Sync documents and files'
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: <FileText className="h-5 w-5" />,
    description: 'Sync pages and databases'
  }
];

interface ConnectorSettingsProps {
  encryptionKey?: CryptoKey | null;
}

export function ConnectorSettings({ encryptionKey: propKey }: ConnectorSettingsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getMasterKey, isUnlocked } = useEncryptionContext();
  const { integrations, isConnected, connect } = useIntegrations();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { count: number; date: string }>>(() => {
    const saved = localStorage.getItem('memory-sync-results');
    return saved ? JSON.parse(saved) : {};
  });
  const [syncSettings, setSyncSettings] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('memory-sync-settings');
    return saved ? JSON.parse(saved) : {};
  });
  
  const handleToggleSync = (connectorId: string, enabled: boolean) => {
    const updated = { ...syncSettings, [connectorId]: enabled };
    setSyncSettings(updated);
    localStorage.setItem('memory-sync-settings', JSON.stringify(updated));
  };
  
  // Validate and refresh session before sync
  const ensureValidSession = useCallback(async (): Promise<string | null> => {
    let { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Try to refresh
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (error || !refreshed.session) {
        return null;
      }
      session = refreshed.session;
    }
    
    return session.access_token;
  }, []);
  
  const handleSync = useCallback(async (connectorId: ConnectorType) => {
    if (!user?.id) {
      toast.error(t('memory.connectors.signInToSync', 'Please sign in to sync'));
      return;
    }
    
    // CRITICAL: Validate session BEFORE calling edge function
    const token = await ensureValidSession();
    if (!token) {
      toast.error(t('memory.connectors.sessionExpired', 'Session expired. Please sign in again.'), {
        action: {
          label: t('common.login'),
          onClick: () => window.location.href = '/auth',
        },
      });
      return;
    }
    
    // Get encryption key from props or context
    const encryptionKey = propKey || getMasterKey?.();
    if (!encryptionKey) {
      toast.error(t('memory.encryption.unlockVault'));
      return;
    }
    
    setSyncing(connectorId);
    
    try {
      // Get the integration ID for this connector
      const integrationId = await getIntegrationId(user.id, connectorId);
      
      if (!integrationId) {
        toast.error(t('memory.connectors.notConnected', '{{name}} is not connected. Please connect it first.').replace('{{name}}', connectorId));
        return;
      }
      
      toast.info(t('memory.connectors.syncing'));
      
      const result = await syncConnector(connectorId, integrationId, encryptionKey, token);
      
      if (result.success) {
        const updated = {
          ...syncResults,
          [connectorId]: { count: result.itemsAdded, date: new Date().toISOString() }
        };
        setSyncResults(updated);
        localStorage.setItem('memory-sync-results', JSON.stringify(updated));
        
        toast.success(t('memory.connectors.syncSuccess', 'Synced {{count}} items').replace('{{count}}', String(result.itemsAdded)));
      } else {
        const errorMsg = result.errors.join(', ');
        if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('unauthorized')) {
          toast.error(t('memory.connectors.reconnect'), {
            description: t('memory.connectors.authExpired', 'Authorization has expired.'),
          });
        } else {
          toast.error(t('memory.connectors.syncFailed') + `: ${errorMsg}`);
        }
      }
    } catch (err) {
      const error = err as Error;
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        toast.error(t('memory.connectors.sessionExpired', 'Session expired. Please sign in again.'));
      } else {
        toast.error(`${t('memory.connectors.syncError', 'Sync error')}: ${error.message}`);
      }
    } finally {
      setSyncing(null);
    }
  }, [user?.id, propKey, getMasterKey, syncResults, ensureValidSession]);
  
  const handleConnect = useCallback(async (connectorId: string) => {
    const token = await ensureValidSession();
    if (!token) {
      toast.error(t('memory.connectors.signInToConnect', 'Please sign in to connect integrations'), {
        action: {
          label: t('common.login'),
          onClick: () => window.location.href = '/auth',
        },
      });
      return;
    }
    
    const definition = INTEGRATION_DEFINITIONS.find(d => d.type === connectorId);
    if (definition) {
      connect(definition);
    }
  }, [connect, ensureValidSession]);
  
  const getIntegrationData = (id: string) => {
    const connected = isConnected(id);
    const integration = integrations?.find(i => i.integration_type === id);
    const syncResult = syncResults[id];
    return {
      connected,
      lastSync: syncResult?.date || integration?.last_synced_at,
      itemCount: syncResult?.count ?? integration?.metadata?.last_sync_stats?.items_synced
    };
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('memory.connectors.title')}</CardTitle>
        <CardDescription>
          {t('memory.connectors.description', 'Choose which integrations sync to your AI Memory. Data is encrypted and stored locally.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {CONNECTOR_CONFIGS.map(connector => {
          const data = getIntegrationData(connector.id);
          const syncEnabled = syncSettings[connector.id] || false;
          
          return (
            <div
              key={connector.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  {connector.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{connector.name}</span>
                    {data.connected ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        {t('memory.connectors.connected')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {t('memory.connectors.notConnected')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{connector.description}</p>
                  {data.itemCount !== undefined && data.itemCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {data.itemCount} {t('memory.connectors.itemsInMemory', 'items in memory')}
                      {data.lastSync && ` • ${t('memory.connectors.lastSync', 'Last sync')}: ${new Date(data.lastSync).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {data.connected ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t('memory.connectors.syncToMemory', 'Sync to Memory')}</span>
                      <Switch
                        checked={syncEnabled}
                        onCheckedChange={(checked) => handleToggleSync(connector.id, checked)}
                      />
                    </div>
                    
                    {syncEnabled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSync(connector.id)}
                        disabled={syncing === connector.id}
                        title={t('memory.connectors.syncNow')}
                      >
                        <RefreshCw className={`h-4 w-4 ${syncing === connector.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(connector.id)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {t('memory.connectors.connect')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          {t('memory.connectors.encryptedNote', 'All synced data is encrypted with your vault password and stored locally.')}
        </div>
      </CardContent>
    </Card>
  );
}
