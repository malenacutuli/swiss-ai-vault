import { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { useIntegrations } from '@/hooks/useIntegrations';

interface ConnectorConfig {
  id: string;
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

export function ConnectorSettings() {
  const { integrations, isConnected } = useIntegrations();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncSettings, setSyncSettings] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('memory-sync-settings');
    return saved ? JSON.parse(saved) : {};
  });
  
  const handleToggleSync = (connectorId: string, enabled: boolean) => {
    const updated = { ...syncSettings, [connectorId]: enabled };
    setSyncSettings(updated);
    localStorage.setItem('memory-sync-settings', JSON.stringify(updated));
  };
  
  const handleSync = async (connectorId: string) => {
    setSyncing(connectorId);
    try {
      // Trigger sync to memory - this would call the integration sync
      await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
      setSyncing(null);
    }
  };
  
  const getIntegrationData = (id: string) => {
    const connected = isConnected(id);
    const integration = integrations?.find(i => i.integration_type === id);
    return {
      connected,
      lastSync: integration?.last_synced_at,
      itemCount: integration?.metadata?.last_sync_stats?.items_synced
    };
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory Connectors</CardTitle>
        <CardDescription>
          Choose which integrations sync to your AI Memory. 
          Data is encrypted and stored locally.
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
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{connector.description}</p>
                  {data.itemCount !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {data.itemCount} items synced
                      {data.lastSync && ` • Last sync: ${new Date(data.lastSync).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {data.connected ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Sync to Memory</span>
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
                      >
                        <RefreshCw className={`h-4 w-4 ${syncing === connector.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = `/settings`}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          All synced data is encrypted with your vault password and stored locally.
        </div>
      </CardContent>
    </Card>
  );
}
