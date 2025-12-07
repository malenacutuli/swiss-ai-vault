import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Link2, 
  RefreshCw, 
  Settings, 
  Trash2, 
  Clock, 
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { 
  useIntegrations, 
  useIntegrationSync, 
  useIntegrationConfig,
  useIntegrationData,
  INTEGRATION_DEFINITIONS,
  type Integration,
  type IntegrationDefinition
} from '@/hooks/useIntegrations';

// Import logos
import slackLogo from '@/assets/integrations/slack-logo.png';
import notionLogo from '@/assets/integrations/notion-logo.png';
import gmailLogo from '@/assets/integrations/gmail-logo.png';
import githubLogo from '@/assets/integrations/github-logo.png';

const LOGO_MAP: Record<string, string> = {
  slack: slackLogo,
  notion: notionLogo,
  gmail: gmailLogo,
  github: githubLogo,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

interface IntegrationCardProps {
  definition: IntegrationDefinition;
  integration?: Integration;
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  onSync: (id: string) => void;
  onConfigure: (id: string) => void;
}

function IntegrationCard({ 
  definition, 
  integration, 
  onConnect, 
  onDisconnect, 
  onSync, 
  onConfigure 
}: IntegrationCardProps) {
  const isConnected = !!integration?.is_active;
  const logo = LOGO_MAP[definition.icon];
  
  return (
    <Card className="relative overflow-hidden">
      {definition.comingSoon && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <Badge variant="secondary" className="text-sm">Coming Soon</Badge>
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt={definition.name} className="h-10 w-10 object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Link2 className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{definition.name}</CardTitle>
              <CardDescription className="text-sm">{definition.description}</CardDescription>
            </div>
          </div>
          
          <Badge 
            variant={isConnected ? 'default' : 'secondary'}
            className={isConnected ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}
          >
            {isConnected ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              'Not Connected'
            )}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isConnected && integration && (
          <div className="space-y-2 text-sm">
            {integration.metadata?.workspace_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>{integration.metadata.workspace_name}</span>
              </div>
            )}
            {integration.metadata?.username && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>@{integration.metadata.username}</span>
              </div>
            )}
            {integration.metadata?.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>{integration.metadata.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last synced: {formatTimeAgo(integration.last_synced_at)}</span>
            </div>
            {integration.metadata?.last_sync_stats && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>
                  {integration.metadata.last_sync_stats.items_synced || 
                   integration.metadata.last_sync_stats.threads_synced ||
                   integration.metadata.last_sync_stats.repos_synced || 0} items synced
                </span>
              </div>
            )}
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          {isConnected ? (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onSync(integration!.id)}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Sync Now
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onConfigure(integration!.id)}
              >
                <Settings className="h-4 w-4 mr-1" />
                Configure
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onDisconnect(integration!.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button 
              size="sm"
              onClick={onConnect}
              disabled={!definition.available}
            >
              <Link2 className="h-4 w-4 mr-1" />
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SyncProgressModalProps {
  open: boolean;
  onClose: () => void;
  integrationName: string;
  progress: number;
  syncing: boolean;
  syncStats: { itemsSynced?: number } | null;
}

function SyncProgressModal({ 
  open, 
  onClose, 
  integrationName, 
  progress, 
  syncing,
  syncStats 
}: SyncProgressModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Syncing {integrationName}</DialogTitle>
          <DialogDescription>
            {syncing 
              ? 'Please wait while we sync your data...'
              : 'Sync complete!'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Progress value={progress} className="h-2" />
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {syncing ? 'Syncing...' : 'Complete'}
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          
          {syncStats && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{syncStats.itemsSynced} items synced</span>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={onClose} disabled={syncing}>
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : 'Done'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfigureModalProps {
  open: boolean;
  onClose: () => void;
  integration: Integration | null;
  integrationType: string;
}

function ConfigureModal({ open, onClose, integration, integrationType }: ConfigureModalProps) {
  const { config, updateConfig } = useIntegrationConfig(integration?.id || null);
  const { data: integrationData } = useIntegrationData(integration?.id || null);
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});

  const handleSave = () => {
    updateConfig(localConfig);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure {integrationType}</DialogTitle>
          <DialogDescription>
            Customize sync settings for this integration
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Data Statistics */}
          {integrationData && (
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="font-medium">Synced Data</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Items</span>
                  <p className="font-medium">{integrationData.totalItems}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Storage Used</span>
                  <p className="font-medium">{formatBytes(integrationData.storageUsed)}</p>
                </div>
              </div>
              {Object.entries(integrationData.dataTypes).length > 0 && (
                <div className="pt-2 border-t">
                  <span className="text-sm text-muted-foreground">By Type</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(integrationData.dataTypes).map(([type, count]) => (
                      <Badge key={type} variant="secondary">
                        {type}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Integration-specific settings */}
          {integrationType === 'Slack' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Channels to Sync</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="all-channels" 
                      checked={localConfig.allChannels as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, allChannels: checked }))
                      }
                    />
                    <Label htmlFor="all-channels" className="font-normal">All public channels</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="private-channels"
                      checked={localConfig.privateChannels as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, privateChannels: checked }))
                      }
                    />
                    <Label htmlFor="private-channels" className="font-normal">Include private channels</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="dms"
                      checked={localConfig.directMessages as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, directMessages: checked }))
                      }
                    />
                    <Label htmlFor="dms" className="font-normal">Include direct messages</Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {integrationType === 'Gmail' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Labels to Sync</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="inbox"
                      checked={localConfig.inbox as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, inbox: checked }))
                      }
                    />
                    <Label htmlFor="inbox" className="font-normal">Inbox</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="sent"
                      checked={localConfig.sent as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, sent: checked }))
                      }
                    />
                    <Label htmlFor="sent" className="font-normal">Sent</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="starred"
                      checked={localConfig.starred as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, starred: checked }))
                      }
                    />
                    <Label htmlFor="starred" className="font-normal">Starred</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date Range (days)</Label>
                <Input 
                  type="number" 
                  value={localConfig.dateRange as number || 30}
                  onChange={(e) => 
                    setLocalConfig(prev => ({ ...prev, dateRange: parseInt(e.target.value) }))
                  }
                />
              </div>
            </div>
          )}

          {integrationType === 'GitHub' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sync Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="issues"
                      checked={localConfig.includeIssues as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, includeIssues: checked }))
                      }
                    />
                    <Label htmlFor="issues" className="font-normal">Include Issues</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="prs"
                      checked={localConfig.includePRs as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, includePRs: checked }))
                      }
                    />
                    <Label htmlFor="prs" className="font-normal">Include Pull Requests</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="code"
                      checked={localConfig.includeCode as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, includeCode: checked }))
                      }
                    />
                    <Label htmlFor="code" className="font-normal">Include Code Files</Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {integrationType === 'Notion' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sync Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="pages"
                      checked={localConfig.includePages as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, includePages: checked }))
                      }
                    />
                    <Label htmlFor="pages" className="font-normal">Include Pages</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="databases"
                      checked={localConfig.includeDatabases as boolean}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, includeDatabases: checked }))
                      }
                    />
                    <Label htmlFor="databases" className="font-normal">Include Databases</Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VaultChatIntegrations() {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { 
    integrations, 
    loading, 
    getIntegrationByType, 
    connect, 
    disconnect 
  } = useIntegrations();
  
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncIntegrationName, setSyncIntegrationName] = useState('');
  
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [configuringType, setConfiguringType] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  
  const { sync, syncing, progress, syncStats } = useIntegrationSync(syncingId);

  const handleConnect = (definition: IntegrationDefinition) => {
    connect(definition);
  };

  const handleSync = async (id: string) => {
    const integration = integrations.find(i => i.id === id);
    if (!integration) return;
    
    const definition = INTEGRATION_DEFINITIONS.find(d => d.type === integration.integration_type);
    if (!definition) return;
    
    setSyncingId(id);
    setSyncIntegrationName(definition.name);
    setShowSyncModal(true);
    
    await sync();
  };

  const handleConfigure = (id: string) => {
    const integration = integrations.find(i => i.id === id);
    if (!integration) return;
    
    const definition = INTEGRATION_DEFINITIONS.find(d => d.type === integration.integration_type);
    if (!definition) return;
    
    setConfiguringId(id);
    setConfiguringType(definition.name);
    setShowConfigModal(true);
  };

  const handleDisconnect = (id: string) => {
    setDisconnectId(id);
    setShowDisconnectDialog(true);
  };

  const confirmDisconnect = () => {
    if (disconnectId) {
      disconnect(disconnectId);
    }
    setShowDisconnectDialog(false);
    setDisconnectId(null);
  };

  return (
    <>
    <div className="min-h-screen flex w-full bg-background">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col">
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
        <main className="flex-1 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Back Button */}
              <Link 
                to="/chat" 
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Vault Chat
              </Link>

              {/* Header */}
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Data Integrations</h1>
                <p className="text-muted-foreground mt-1">
                  Connect your apps and services to enhance your AI assistant with your organization's data
                </p>
              </div>

              {/* Info Banner */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">How it works</p>
                    <p className="text-muted-foreground mt-1">
                      Connected integrations allow you to chat with your data. All synced content is encrypted 
                      and processed for semantic search, enabling AI-powered answers from your organization's knowledge base.
                    </p>
                  </div>
                </div>
              </div>

              {/* Integration Cards Grid */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {INTEGRATION_DEFINITIONS.map((definition) => (
                    <IntegrationCard
                      key={definition.type}
                      definition={definition}
                      integration={getIntegrationByType(definition.type)}
                      onConnect={() => handleConnect(definition)}
                      onDisconnect={handleDisconnect}
                      onSync={handleSync}
                      onConfigure={handleConfigure}
                    />
                  ))}
                </div>
              )}

              {/* Connected Summary */}
              {integrations.length > 0 && (
                <div className="rounded-lg border p-4">
                  <h3 className="font-medium mb-3">Connected Integrations Summary</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <span className="text-sm text-muted-foreground">Active Connections</span>
                      <p className="text-2xl font-bold">{integrations.length}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Total Items Synced</span>
                      <p className="text-2xl font-bold">
                        {integrations.reduce((acc, i) => {
                          const stats = i.metadata?.last_sync_stats;
                          return acc + (stats?.items_synced || stats?.threads_synced || stats?.repos_synced || 0);
                        }, 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Last Sync</span>
                      <p className="text-2xl font-bold">
                        {formatTimeAgo(
                          integrations.reduce((latest, i) => {
                            if (!i.last_synced_at) return latest;
                            if (!latest) return i.last_synced_at;
                            return new Date(i.last_synced_at) > new Date(latest) 
                              ? i.last_synced_at 
                              : latest;
                          }, null as string | null)
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </main>
      </div>
    </div>

      {/* Sync Progress Modal */}
      <SyncProgressModal
        open={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        integrationName={syncIntegrationName}
        progress={progress}
        syncing={syncing}
        syncStats={syncStats}
      />

      {/* Configure Modal */}
      <ConfigureModal
        open={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        integration={integrations.find(i => i.id === configuringId) || null}
        integrationType={configuringType}
      />

      {/* Disconnect Confirmation */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Integration?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this integration? This will remove all synced data 
              and you'll need to reconnect to sync again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
