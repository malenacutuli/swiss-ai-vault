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
import { MemoryToggle } from '@/components/chat/MemoryToggle';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';
import { VoiceRecordingOverlay } from '@/components/voice/VoiceRecordingOverlay';
import { VoiceInputButton, VoiceOutputButton } from '@/components/voice/VoiceButtons';
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
  // Mirrors StreamStatus from useGhostInference
  streamStatus?: 'idle' | 'connecting' | 'generating' | 'complete' | 'error' | 'stuck' | 'timeout';
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
  // Initialization state props
  initPhase?: 'connecting' | 'ready' | 'error';
  hasPendingMessage?: boolean;
  // Personal Memory props
  memoryEnabled?: boolean;
  onToggleMemory?: () => void;
  memoryCount?: number;
  isMemorySearching?: boolean;
  memoryDisabled?: boolean;
  // TTS props
  lastAssistantMessage?: string;
}

// Text mode is default - only show other modes in dropdown when in text mode
// When in other modes, show "Chat" option to return
const MODE_CONFIG: { id: GhostMode; labelKey: string; fallback: string; icon: React.ElementType; badge?: 'new' | 'pro' }[] = [
  { id: 'text', labelKey: 'ghost.modes.text', fallback: 'Chat', icon: MessageSquare },
  { id: 'image', labelKey: 'ghost.modes.image', fallback: 'Image', icon: Image, badge: 'new' },
  { id: 'video', labelKey: 'ghost.modes.video', fallback: 'Video', icon: Video, badge: 'new' },
  { id: 'search', labelKey: 'ghost.modes.search', fallback: 'Search', icon: Globe },
  { id: 'research', labelKey: 'ghost.modes.research', fallback: 'Deep Research', icon: BookOpen, badge: 'pro' },
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
  streamStatus = 'idle',
  enhancePrompt = false,
  onToggleEnhance,
  onAttach,
  disabled = false,
  voiceLanguage = 'en',
  matureFilterEnabled = true,
  className,
  initPhase = 'ready',
  hasPendingMessage = false,
  // Memory props
  memoryEnabled = false,
  onToggleMemory,
  memoryCount = 0,
  isMemorySearching = false,
  memoryDisabled = false,
  // TTS props
  lastAssistantMessage,
}: GhostChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentModeConfig = MODE_CONFIG.find(m => m.id === mode) || MODE_CONFIG[0];
  const CurrentIcon = currentModeConfig.icon;

  // Voice Input Hook (STT)
  const voiceInput = useVoiceInput({
    onTranscription: (text) => {
      onChange(value ? `${value} ${text}` : text);
      textareaRef.current?.focus();
    },
    language: voiceLanguage,
  });

  // Voice Output Hook (TTS)
  const voiceOutput = useVoiceOutput({
    voice: 'nova',
    speed: 1.0,
  });

  const handleVoiceToggle = () => {
    if (voiceInput.isRecording) {
      voiceInput.stopRecording();
    } else {
      voiceInput.startRecording();
    }
  };

  const handleTTSToggle = () => {
    if (lastAssistantMessage) {
      voiceOutput.toggle(lastAssistantMessage);
    }
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

  const isActuallyStreaming = isStreaming && ['connecting', 'generating'].includes(streamStatus);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('w-full', className)}>
        {/* Mode & Model Selectors Row */}
        <div className="flex items-center gap-2 mb-2 px-1">
          {/* Mode Selector Dropdown - Only show when NOT in text mode, or show other modes when in text */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 px-3 bg-background">
                <CurrentIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{t(currentModeConfig.labelKey, currentModeConfig.fallback)}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-popover">
              {/* When in text mode, don't show text option (it's redundant) */}
              {/* When in other modes, show "Chat" option first to return */}
              {mode !== 'text' && (
                <DropdownMenuItem 
                  onSelect={() => onModeChange('text')}
                  className="gap-2 cursor-pointer"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="flex-1">{t('ghost.modes.text', 'Chat')}</span>
                </DropdownMenuItem>
              )}
              {MODE_CONFIG.filter(m => m.id !== 'text' && m.id !== mode).map(({ id, labelKey, fallback, icon: Icon, badge }) => (
                <DropdownMenuItem 
                  key={id}
                  onSelect={() => onModeChange(id)}
                  className="gap-2 cursor-pointer"
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{t(labelKey, fallback)}</span>
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
          {/* Connecting indicator - subtle bottom bar */}
          {initPhase === 'connecting' && !hasPendingMessage && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-pulse rounded-b-2xl" />
          )}

          {/* Pending message overlay */}
          {hasPendingMessage && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] rounded-2xl flex items-center justify-center pointer-events-none z-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/80 px-3 py-1.5 rounded-full shadow-sm border border-border/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Connecting to secure storage...</span>
              </div>
            </div>
          )}
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

            {/* Personal Memory Toggle - show in text mode */}
            {onToggleMemory && mode === 'text' && (
              <MemoryToggle
                enabled={memoryEnabled}
                onToggle={onToggleMemory}
                memoryCount={memoryCount}
                isSearching={isMemorySearching}
                disabled={memoryDisabled}
                className="h-8 w-8"
              />
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
                isRecording={voiceInput.isRecording}
                isProcessing={voiceInput.isProcessing}
                isSupported={voiceInput.isSupported}
                onToggle={handleVoiceToggle}
                disabled={disabled || isLoading}
                className="h-8 w-8"
              />
            )}

            {/* TTS Button - only show if there's a response to read */}
            {mode === 'text' && lastAssistantMessage && (
              <VoiceOutputButton
                isPlaying={voiceOutput.isPlaying}
                isLoading={voiceOutput.isLoading}
                onToggle={handleTTSToggle}
                disabled={disabled}
                className="h-8 w-8"
              />
            )}

            {isActuallyStreaming && onCancel ? (
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

        {/* Voice Recording Overlay */}
        <VoiceRecordingOverlay
          isRecording={voiceInput.isRecording}
          duration={voiceInput.duration}
          onStop={voiceInput.stopRecording}
          onCancel={voiceInput.cancelRecording}
          variant="ghost"
        />

        {/* Minimal hint */}
        <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
          <kbd className="px-1 py-0.5 bg-muted/40 rounded text-[10px]">↵</kbd> {t('ghost.input.send', 'send')} · <kbd className="px-1 py-0.5 bg-muted/40 rounded text-[10px]">⇧↵</kbd> {t('ghost.input.newLine', 'new line')}
        </p>
      </div>
    </TooltipProvider>
  );
}
