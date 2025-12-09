import { useState } from 'react';
import { Settings, Plug, Download, Key } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

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

  const handleExportKeys = async () => {
    // TODO: Implement key export from key-vault
    toast({
      title: 'Export Keys',
      description: 'Key export functionality coming soon',
    });
  };

  const handleViewRecoveryKey = async () => {
    // TODO: Implement recovery key view
    toast({
      title: 'Recovery Key',
      description: 'Recovery key functionality coming soon',
    });
  };

  const handleAutoLockChange = (value: string) => {
    setAutoLockMinutes(value);
    // TODO: Save to user_encryption_settings table
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
              {isZeroTrace && onExportConversation && (
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
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleExportKeys}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Encryption Keys
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleViewRecoveryKey}
              >
                <Key className="h-4 w-4 mr-2" />
                View Recovery Key
              </Button>
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
