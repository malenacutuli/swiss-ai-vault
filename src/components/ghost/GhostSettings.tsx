import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  User,
  Settings as SettingsIcon,
  HardDrive,
  MessageSquare,
  Image,
  Trash2,
  RotateCcw,
  Play,
  Zap,
  Shield,
  Volume2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useGhostSettings, type GhostSettings as GhostSettingsType } from '@/hooks/useGhostSettings';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GhostSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCENT_COLORS = [
  { id: 'swiss-navy', name: 'Swiss Navy', color: 'hsl(213 55% 23%)' },
  { id: 'sapphire', name: 'Sapphire', color: 'hsl(207 79% 28%)' },
  { id: 'burgundy', name: 'Burgundy', color: 'hsl(355 42% 32%)' },
  { id: 'teal', name: 'Teal', color: 'hsl(193 53% 24%)' },
] as const;

const VOICE_OPTIONS = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'echo', name: 'Echo' },
  { id: 'fable', name: 'Fable' },
  { id: 'onyx', name: 'Onyx' },
  { id: 'nova', name: 'Nova' },
  { id: 'shimmer', name: 'Shimmer' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
];

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const IMAGE_FORMATS = ['png', 'jpg', 'webp'];

export function GhostSettings({ open, onOpenChange }: GhostSettingsProps) {
  const { user } = useAuth();
  const { balance, formattedBalance } = useGhostCredits();
  const { settings, updateSettings, resetToDefaults, isLoading, isSaving } = useGhostSettings();
  const [activeTab, setActiveTab] = useState('profile');
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageQuota, setStorageQuota] = useState(100);

  // Get storage estimate
  useState(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage.estimate().then(estimate => {
        setStorageUsed(Math.round((estimate.usage || 0) / 1024 / 1024 * 100) / 100);
        setStorageQuota(Math.round((estimate.quota || 0) / 1024 / 1024 / 1024 * 100) / 100);
      });
    }
  });

  const handleDeleteChatHistory = async () => {
    if (!confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
      return;
    }
    localStorage.removeItem('ghost-conversations');
    toast.success('Chat history deleted');
  };

  const handlePersistStorage = async () => {
    if (navigator.storage?.persist) {
      const persisted = await navigator.storage.persist();
      if (persisted) {
        toast.success('Storage persisted successfully');
      } else {
        toast.error('Could not persist storage');
      }
    }
  };

  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-caps mb-4">
      {children}
    </h4>
  );

  const SettingRow = ({ 
    label, 
    description, 
    children 
  }: { 
    label: string; 
    description?: string; 
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
      <div className="space-y-0.5 flex-1 mr-4">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] p-0 gap-0 bg-card">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-lg font-serif">Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-5 h-auto p-1">
              <TabsTrigger value="profile" className="flex-col gap-1 py-2 text-xs">
                <User className="w-4 h-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="general" className="flex-col gap-1 py-2 text-xs">
                <SettingsIcon className="w-4 h-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="storage" className="flex-col gap-1 py-2 text-xs">
                <HardDrive className="w-4 h-4" />
                Storage
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-col gap-1 py-2 text-xs">
                <MessageSquare className="w-4 h-4" />
                Text
              </TabsTrigger>
              <TabsTrigger value="image" className="flex-col gap-1 py-2 text-xs">
                <Image className="w-4 h-4" />
                Image
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-6 py-4">
            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-0 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{user?.email?.split('@')[0] || 'User'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Account Type</span>
                  <span className="text-sm font-medium">Free</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Credit Balance
                  </span>
                  <span className="text-sm font-medium">{formattedBalance}</span>
                </div>
              </div>
            </TabsContent>

            {/* General Tab */}
            <TabsContent value="general" className="mt-0 space-y-6">
              <div>
                <SectionHeader>Content</SectionHeader>
                <SettingRow 
                  label="Mature Filter" 
                  description="Suppress mature content and restrict adult models"
                >
                  <Switch
                    checked={settings.mature_filter_enabled}
                    onCheckedChange={(v) => updateSettings({ mature_filter_enabled: v })}
                  />
                </SettingRow>
              </div>

              <div>
                <SectionHeader>Chat Behavior</SectionHeader>
                <SettingRow label="Start new chats as Temporary">
                  <Switch
                    checked={settings.start_temporary}
                    onCheckedChange={(v) => updateSettings({ start_temporary: v })}
                  />
                </SettingRow>
                <SettingRow label="Show Message Date">
                  <Switch
                    checked={settings.show_message_date}
                    onCheckedChange={(v) => updateSettings({ show_message_date: v })}
                  />
                </SettingRow>
                <SettingRow label="Enter Submits Chat">
                  <Switch
                    checked={settings.enter_submits}
                    onCheckedChange={(v) => updateSettings({ enter_submits: v })}
                  />
                </SettingRow>
                <SettingRow label="Arrow Key Navigation">
                  <Switch
                    checked={settings.arrow_key_nav}
                    onCheckedChange={(v) => updateSettings({ arrow_key_nav: v })}
                  />
                </SettingRow>
                <SettingRow label="After editing a message">
                  <RadioGroup
                    value={settings.enter_after_edit}
                    onValueChange={(v) => updateSettings({ enter_after_edit: v as 'regenerate' | 'fork' })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="regenerate" id="regenerate" />
                      <Label htmlFor="regenerate" className="text-sm">Regenerate</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fork" id="fork" />
                      <Label htmlFor="fork" className="text-sm">Fork</Label>
                    </div>
                  </RadioGroup>
                </SettingRow>
              </div>

              <div>
                <SectionHeader>Privacy</SectionHeader>
                <SettingRow label="Show External Link Warning">
                  <Switch
                    checked={settings.show_external_link_warning}
                    onCheckedChange={(v) => updateSettings({ show_external_link_warning: v })}
                  />
                </SettingRow>
                <SettingRow label="Disable Telemetry Collection">
                  <Switch
                    checked={settings.disable_telemetry}
                    onCheckedChange={(v) => updateSettings({ disable_telemetry: v })}
                  />
                </SettingRow>
                <SettingRow label="Hide Personal Information">
                  <Switch
                    checked={settings.hide_personal_info}
                    onCheckedChange={(v) => updateSettings({ hide_personal_info: v })}
                  />
                </SettingRow>
              </div>

              <div>
                <SectionHeader>Theme</SectionHeader>
                <SettingRow label="Color Scheme">
                  <Select
                    value={settings.theme}
                    onValueChange={(v) => updateSettings({ theme: v as 'light' | 'dark' | 'system' })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                <SettingRow label="Accent Color">
                  <div className="flex gap-2">
                    {ACCENT_COLORS.map(color => (
                      <button
                        key={color.id}
                        onClick={() => updateSettings({ accent_color: color.id as GhostSettingsType['accent_color'] })}
                        className={cn(
                          'w-8 h-8 rounded-full border-2 transition-all',
                          settings.accent_color === color.id
                            ? 'border-foreground scale-110'
                            : 'border-transparent hover:scale-105'
                        )}
                        style={{ backgroundColor: color.color }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </SettingRow>
              </div>
            </TabsContent>

            {/* Storage Tab */}
            <TabsContent value="storage" className="mt-0 space-y-6">
              <div>
                <SectionHeader>Usage Limits</SectionHeader>
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Text</span>
                    <span className="font-medium text-success">Unlimited</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Image</span>
                    <span className="font-medium">{balance} remaining</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Video</span>
                    <span className="font-medium">{Math.floor(balance / 10)} remaining</span>
                  </div>
                </div>
              </div>

              <div>
                <SectionHeader>Chat Data</SectionHeader>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Local Storage</span>
                      <span>{storageUsed} MB / {storageQuota} GB</span>
                    </div>
                    <Progress value={(storageUsed / (storageQuota * 1024)) * 100} className="h-2" />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handlePersistStorage}
                      className="flex-1"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Persist Storage
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleDeleteChatHistory}
                      className="flex-1"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete History
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Text Tab */}
            <TabsContent value="text" className="mt-0 space-y-6">
              <div>
                <SectionHeader>Web Features</SectionHeader>
                <SettingRow 
                  label="Web Enabled" 
                  description="Search the entire internet"
                >
                  <Switch
                    checked={settings.web_enabled}
                    onCheckedChange={(v) => updateSettings({ web_enabled: v })}
                  />
                </SettingRow>
                <SettingRow 
                  label="URL Scraping" 
                  description="Extract content from URLs in your messages"
                >
                  <Switch
                    checked={settings.url_scraping}
                    onCheckedChange={(v) => updateSettings({ url_scraping: v })}
                  />
                </SettingRow>
              </div>

              <div>
                <SectionHeader>System Prompt</SectionHeader>
                <p className="text-xs text-muted-foreground mb-3">
                  Control the AI's behavior. Create a System Prompt.
                </p>
                <Textarea
                  value={settings.system_prompt || ''}
                  onChange={(e) => updateSettings({ system_prompt: e.target.value || null })}
                  placeholder="You are a helpful assistant..."
                  className="min-h-[100px] text-sm"
                />
              </div>

              <div>
                <SectionHeader>Voice</SectionHeader>
                <SettingRow label="Read Responses">
                  <Switch
                    checked={settings.voice_read_responses}
                    onCheckedChange={(v) => updateSettings({ voice_read_responses: v })}
                  />
                </SettingRow>
                <SettingRow label="Language">
                  <Select
                    value={settings.voice_language}
                    onValueChange={(v) => updateSettings({ voice_language: v })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <SettingRow label="Voice">
                  <div className="flex items-center gap-2">
                    <Select
                      value={settings.voice_id}
                      onValueChange={(v) => updateSettings({ voice_id: v })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICE_OPTIONS.map(voice => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Play className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </SettingRow>
                <SettingRow label="Speed">
                  <Select
                    value={settings.voice_speed.toString()}
                    onValueChange={(v) => updateSettings({ voice_speed: parseFloat(v) })}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">0.5x</SelectItem>
                      <SelectItem value="0.75">0.75x</SelectItem>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="1.25">1.25x</SelectItem>
                      <SelectItem value="1.5">1.5x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
              </div>

              <div>
                <SectionHeader>Advanced Settings</SectionHeader>
                <SettingRow label="Disable System Prompt">
                  <Switch
                    checked={settings.disable_system_prompt}
                    onCheckedChange={(v) => updateSettings({ disable_system_prompt: v })}
                  />
                </SettingRow>
                <div className="py-3 border-b border-border/30">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">Temperature</Label>
                    <span className="text-sm text-muted-foreground">{settings.default_temperature}</span>
                  </div>
                  <Slider
                    value={[settings.default_temperature]}
                    onValueChange={([v]) => updateSettings({ default_temperature: v })}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <div className="py-3">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">Top P</Label>
                    <span className="text-sm text-muted-foreground">{settings.default_top_p}</span>
                  </div>
                  <Slider
                    value={[settings.default_top_p]}
                    onValueChange={([v]) => updateSettings({ default_top_p: v })}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Image Tab */}
            <TabsContent value="image" className="mt-0 space-y-6">
              <div>
                <SectionHeader>Generation Settings</SectionHeader>
                <SettingRow label="Default Aspect Ratio">
                  <Select
                    value={settings.image_aspect_ratio}
                    onValueChange={(v) => updateSettings({ image_aspect_ratio: v })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASPECT_RATIOS.map(ratio => (
                        <SelectItem key={ratio} value={ratio}>
                          {ratio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <SettingRow label="Hide Watermark">
                  <Switch
                    checked={settings.image_hide_watermark}
                    onCheckedChange={(v) => updateSettings({ image_hide_watermark: v })}
                  />
                </SettingRow>
                <SettingRow label="Enhance Prompts">
                  <Switch
                    checked={settings.image_enhance_prompts}
                    onCheckedChange={(v) => updateSettings({ image_enhance_prompts: v })}
                  />
                </SettingRow>
              </div>

              <div>
                <SectionHeader>Advanced</SectionHeader>
                <SettingRow label="Image Format">
                  <Select
                    value={settings.image_format}
                    onValueChange={(v) => updateSettings({ image_format: v })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_FORMATS.map(format => (
                        <SelectItem key={format} value={format}>
                          {format.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <SettingRow label="Embed EXIF Metadata">
                  <Switch
                    checked={settings.image_embed_exif}
                    onCheckedChange={(v) => updateSettings({ image_embed_exif: v })}
                  />
                </SettingRow>
              </div>

              <Button 
                variant="outline" 
                onClick={resetToDefaults}
                className="w-full"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Defaults
              </Button>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
