import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GhostModelPicker } from './GhostModelPicker';
import { VoiceInputButton } from './VoiceInputButton';
import {
  Paperclip,
  Wand2,
  Send,
  Square,
  Loader2,
  MessageSquare,
  Image,
  Video,
  Globe,
  BookOpen,
  ChevronDown,
} from '@/icons';

export type GhostMode = 'text' | 'image' | 'video' | 'search' | 'research';

interface GhostChatInputProps {
  mode: GhostMode;
  onModeChange: (mode: GhostMode) => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  elapsedTime?: number;
  credits?: number;
  enhancePrompt?: boolean;
  onToggleEnhance?: () => void;
  onOpenSettings?: () => void;
  onAttach?: () => void;
  disabled?: boolean;
  voiceLanguage?: string;
  matureFilterEnabled?: boolean;
  className?: string;
}

const MODE_CONFIG: { id: GhostMode; labelKey: string; icon: React.ElementType; badge?: 'new' | 'pro' }[] = [
  { id: 'text', labelKey: 'ghost.modes.text', icon: MessageSquare },
  { id: 'image', labelKey: 'ghost.modes.image', icon: Image, badge: 'new' },
  { id: 'video', labelKey: 'ghost.modes.video', icon: Video, badge: 'new' },
  { id: 'search', labelKey: 'ghost.modes.search', icon: Globe },
  { id: 'research', labelKey: 'ghost.modes.research', icon: BookOpen, badge: 'pro' },
];

const getPlaceholder = (mode: GhostMode, t: (key: string, fallback: string) => string): string => {
  switch (mode) {
    case 'text':
      return t('ghost.input.textPlaceholder', 'Ask anything privately...');
    case 'image':
      return t('ghost.input.imagePlaceholder', 'Describe the image you want to create...');
    case 'video':
      return t('ghost.input.videoPlaceholder', 'Describe the video you want to generate...');
    case 'search':
      return t('ghost.input.searchPlaceholder', 'Search the web privately...');
    case 'research':
      return t('ghost.input.researchPlaceholder', 'What would you like to research in depth?');
    default:
      return t('ghost.input.textPlaceholder', 'Ask anything privately...');
  }
};

export function GhostChatInput({
  mode,
  onModeChange,
  selectedModel,
  onSelectModel,
  value,
  onChange,
  onSubmit,
  onCancel,
  isLoading = false,
  isStreaming = false,
  enhancePrompt = false,
  onToggleEnhance,
  onAttach,
  disabled = false,
  voiceLanguage = 'en',
  matureFilterEnabled = true,
  className,
}: GhostChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentModeConfig = MODE_CONFIG.find(m => m.id === mode) || MODE_CONFIG[0];
  const CurrentIcon = currentModeConfig.icon;

  const handleVoiceTranscript = (text: string) => {
    onChange(value ? `${value} ${text}` : text);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isLoading && value.trim()) {
        onSubmit();
      }
    }
  };

  const canSubmit = value.trim().length > 0 && !disabled && !isLoading;

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('w-full', className)}>
        {/* Mode & Model Selectors Row */}
        <div className="flex items-center gap-2 mb-2 px-1">
          {/* Mode Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 px-3 bg-background">
                <CurrentIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{t(currentModeConfig.labelKey)}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-popover">
              {MODE_CONFIG.map(({ id, labelKey, icon: Icon, badge }) => (
                <DropdownMenuItem 
                  key={id}
                  onSelect={() => onModeChange(id)}
                  className="gap-2 cursor-pointer"
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{t(labelKey)}</span>
                  {badge === 'new' && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">NEW</Badge>
                  )}
                  {badge === 'pro' && (
                    <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-500/20 text-amber-600 border-amber-500/30">PRO</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Model Selector */}
          <GhostModelPicker
            mode={mode}
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            matureFilterEnabled={matureFilterEnabled}
          />
        </div>

        {/* Input Area */}
        <div className="relative flex items-end gap-2 bg-background border border-border rounded-2xl px-3 py-2.5 shadow-card focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all duration-150">
          {/* Left icons */}
          <div className="flex items-center gap-0.5 pb-0.5">
            {onAttach && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
                    onClick={onAttach}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('ghost.input.attach', 'Attach')}</TooltipContent>
              </Tooltip>
            )}

            {onToggleEnhance && (mode === 'image' || mode === 'video') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-8 w-8 transition-colors duration-150',
                      enhancePrompt
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                    onClick={onToggleEnhance}
                  >
                    <Wand2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {enhancePrompt ? t('ghost.input.enhanced', 'Enhanced') : t('ghost.input.enhancePrompt', 'Enhance prompt')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder(mode, t)}
            disabled={disabled || isLoading}
            className="flex-1 min-h-[36px] max-h-[160px] resize-none border-0 bg-transparent p-0 py-1.5 text-[15px] leading-relaxed focus-visible:ring-0 placeholder:text-muted-foreground/60"
            rows={1}
          />

          {/* Right icons */}
          <div className="flex items-center gap-0.5 pb-0.5">
            {mode === 'text' && (
              <VoiceInputButton
                onTranscript={handleVoiceTranscript}
                disabled={disabled || isLoading}
                language={voiceLanguage}
              />
            )}

            {isStreaming && onCancel ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={onCancel}
              >
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  'h-8 w-8 transition-colors duration-150',
                  canSubmit
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-muted-foreground/40'
                )}
                onClick={onSubmit}
                disabled={!canSubmit}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Minimal hint */}
        <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
          <kbd className="px-1 py-0.5 bg-muted/40 rounded text-[10px]">↵</kbd> {t('ghost.input.send', 'send')} · <kbd className="px-1 py-0.5 bg-muted/40 rounded text-[10px]">⇧↵</kbd> {t('ghost.input.newLine', 'new line')}
        </p>
      </div>
    </TooltipProvider>
  );
}
