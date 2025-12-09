import { useState } from 'react';
import { Settings, Plug, Download, Key, Copy, Check, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { exportVaultBackup, getRecoveryKeyInfo, isVaultUnlocked } from '@/lib/crypto/key-vault';

// Available models from chat-completions edge function
const AVAILABLE_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'llama3.2-3b', name: 'Llama 3.2 3B', provider: 'Local/vLLM' },
  { id: 'llama3.2-1b', name: 'Llama 3.2 1B', provider: 'Local/vLLM' },
  { id: 'mistral-7b', name: 'Mistral 7B', provider: 'Local/vLLM' },
  { id: 'qwen2.5-3b', name: 'Qwen 2.5 3B', provider: 'Local/vLLM' },
  { id: 'qwen2.5-7b', name: 'Qwen 2.5 7B', provider: 'Local/vLLM' },
  { id: 'gemma2-2b', name: 'Gemma 2 2B', provider: 'Local/vLLM' },
];

const AUTO_LOCK_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '0', label: 'Never' },
];

interface ChatSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string | null;
  currentModel: string;
  onModelChange: (model: string) => void;
  zeroRetention: boolean;
  onZeroRetentionChange: (enabled: boolean) => void;
  systemPrompt?: string;
  onSystemPromptChange?: (prompt: string) => void;
  isZeroTrace?: boolean;
  onExportConversation?: () => void;
}

export function ChatSettingsModal({
  open,
  onOpenChange,
  currentModel,
  onModelChange,
  zeroRetention,
  onZeroRetentionChange,
  systemPrompt = '',
  onSystemPromptChange,
  isZeroTrace,
  onExportConversation,
}: ChatSettingsModalProps) {
  const { toast } = useToast();
  const [autoLockMinutes, setAutoLockMinutes] = useState('15');
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
  const [isExportingKeys, setIsExportingKeys] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [recoveryInfo, setRecoveryInfo] = useState<{ hash: string; keyCount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const handleExportKeys = async () => {
    if (!showPasswordInput) {
      setShowPasswordInput(true);
      return;
    }
    
    if (!backupPassword.trim()) {
      toast({
        title: 'Password Required',
        description: 'Please enter a backup password to encrypt your keys',
        variant: 'destructive',
      });
      return;
    }
    
    if (!isVaultUnlocked()) {
      toast({
        title: 'Vault Locked',
        description: 'Please unlock your vault first to export keys',
        variant: 'destructive',
      });
      return;
    }
    
    setIsExportingKeys(true);
    try {
      const blob = await exportVaultBackup(backupPassword);
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swissvault_keys_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Keys Exported',
        description: 'Your encryption keys have been exported. Store the backup file securely.',
      });
      setShowPasswordInput(false);
      setBackupPassword('');
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export keys',
        variant: 'destructive',
      });
    } finally {
      setIsExportingKeys(false);
    }
  };

  const handleViewRecoveryKey = async () => {
    if (showRecoveryKey) {
      setShowRecoveryKey(false);
      setRecoveryInfo(null);
      return;
    }
    
    try {
      const info = await getRecoveryKeyInfo();
      if (info) {
        setRecoveryInfo(info);
        setShowRecoveryKey(true);
      } else {
        toast({
          title: 'No Keys Found',
          description: 'Your vault has not been initialized yet',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to retrieve recovery information',
        variant: 'destructive',
      });
    }
  };
  
  const copyRecoveryKey = () => {
    if (recoveryInfo) {
      navigator.clipboard.writeText(recoveryInfo.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAutoLockChange = (value: string) => {
    setAutoLockMinutes(value);
    toast({
      title: 'Auto-lock Updated',
      description: value === '0' ? 'Auto-lock disabled' : `Vault will lock after ${value} minutes of inactivity`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Chat Settings
          </DialogTitle>
          <DialogDescription>
            Configure model, security, and integration settings for this conversation.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="integrations">Context</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select value={currentModel} onValueChange={onModelChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {model.provider}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Local models (vLLM) keep data on-premises. Cloud models send encrypted context.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Zero-Retention Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Messages are not logged or stored on servers
                </p>
              </div>
              <Switch
                checked={zeroRetention}
                onCheckedChange={onZeroRetentionChange}
              />
            </div>

            {onSystemPromptChange && (
              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt (Optional)</Label>
                <Textarea
                  id="system-prompt"
                  value={localSystemPrompt}
                  onChange={(e) => setLocalSystemPrompt(e.target.value)}
                  onBlur={() => onSystemPromptChange(localSystemPrompt)}
                  placeholder="Custom instructions for the AI..."
                  rows={3}
                />
              </div>
            )}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Auto-Lock Duration</Label>
              <Select value={autoLockMinutes} onValueChange={handleAutoLockChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTO_LOCK_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Automatically lock the vault after inactivity
              </p>
            </div>

            <div className="pt-4 space-y-3">
              {onExportConversation && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    onExportConversation();
                    onOpenChange(false);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export This Conversation
                </Button>
              )}
              {showPasswordInput ? (
                <div className="space-y-2">
                  <Label>Backup Password</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Enter backup password..."
                      value={backupPassword}
                      onChange={(e) => setBackupPassword(e.target.value)}
                    />
                    <Button onClick={handleExportKeys} disabled={isExportingKeys}>
                      {isExportingKeys ? 'Exporting...' : 'Export'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This password will encrypt your key backup. You'll need it to import keys.
                  </p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleExportKeys}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Encryption Keys
                </Button>
              )}
              
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleViewRecoveryKey}
              >
                {showRecoveryKey ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showRecoveryKey ? 'Hide Recovery Key' : 'View Recovery Key'}
              </Button>
              
              {showRecoveryKey && recoveryInfo && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Key Fingerprint</Label>
                    <Button variant="ghost" size="sm" onClick={copyRecoveryKey}>
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <code className="block text-sm font-mono bg-background p-2 rounded border break-all">
                    {recoveryInfo.hash}
                  </code>
                  <p className="text-xs text-muted-foreground">
                    {recoveryInfo.keyCount} conversation key(s) stored
                  </p>
                </div>
              )}
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-4">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Security Note:</strong> Your encryption keys are stored locally 
                in your browser. Exporting keys allows you to back them up or transfer 
                to another device.
              </p>
            </div>
          </TabsContent>

          {/* Integrations/Context Tab */}
          <TabsContent value="integrations" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Enable integrations to include their data as context in your conversations.
            </p>
            
            <div className="space-y-3">
              {['Slack', 'Notion', 'Gmail', 'GitHub'].map((integration) => (
                <div key={integration} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{integration}</span>
                  </div>
                  <Switch />
                </div>
              ))}
            </div>

            <Button
              variant="link"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                window.location.href = '/dashboard/vault-chat/integrations';
              }}
            >
              Manage All Integrations →
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
