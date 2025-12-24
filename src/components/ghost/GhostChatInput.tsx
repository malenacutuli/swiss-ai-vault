import { useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GhostModelPicker } from './GhostModelPicker';
import { VoiceInputButton } from './VoiceInputButton';
import {
  Settings2,
  Zap,
  Paperclip,
  Wand2,
  Send,
  Square,
  Loader2,
  FileText,
  RotateCcw,
  Lightbulb,
  Code,
  Coins,
  Timer,
} from 'lucide-react';

type GhostMode = 'text' | 'image' | 'video' | 'search';

// Estimate credits based on mode and model
function estimateCost(
  mode: GhostMode,
  model: string,
  options?: { tokens?: number }
): number {
  const tokenCount = options?.tokens ?? 0;
  
  switch (mode) {
    case 'text':
      // Rough estimate: ~4 chars per token, cost based on model
      const estimatedTokens = Math.ceil(tokenCount / 4);
      // Most models cost around 0.001-0.01 per 1k tokens
      if (model.includes('gpt-4') || model.includes('claude-3')) {
        return Math.max(1, Math.ceil(estimatedTokens / 100)); // ~1 credit per 100 tokens
      }
      return Math.max(1, Math.ceil(estimatedTokens / 500)); // cheaper models
      
    case 'image':
      // Image generation typically costs more
      if (model.includes('flux') || model.includes('dalle')) {
        return 5; // Premium image models
      }
      return 3; // Standard image generation
      
    case 'video':
      // Video generation is most expensive
      return 10;
      
    case 'search':
      // Web search is relatively cheap
      return 2;
      
    default:
      return 1;
  }
}


interface GhostChatInputProps {
  mode: GhostMode;
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

const PLACEHOLDERS: Record<GhostMode, string> = {
  text: 'Ask anything privately...',
  image: 'Describe the image you want to create...',
  video: 'Describe the video you want to generate...',
  search: 'Search the web privately...',
};

export function GhostChatInput({
  mode,
  selectedModel,
  onSelectModel,
  value,
  onChange,
  onSubmit,
  onCancel,
  isLoading = false,
  isStreaming = false,
  elapsedTime = 0,
  credits = 0,
  enhancePrompt = false,
  onToggleEnhance,
  onOpenSettings,
  onAttach,
  disabled = false,
  voiceLanguage = 'en',
  matureFilterEnabled = true,
  className,
}: GhostChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle voice transcript - only used when VoiceInputButton is rendered
  const handleVoiceTranscript = (text: string) => {
    onChange(value ? `${value} ${text}` : text);
    textareaRef.current?.focus();
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
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

  // Estimate cost based on mode and input
  const estimatedCost = useMemo(() => {
    if (mode === 'text') {
      return estimateCost('text', selectedModel, { tokens: value.length });
    }
    if (mode === 'image') {
      return estimateCost('image', selectedModel);
    }
    if (mode === 'video') {
      return estimateCost('video', selectedModel);
    }
    if (mode === 'search') {
      return estimateCost('search', selectedModel);
    }
    return 1;
  }, [mode, selectedModel, value.length]);

  const canSubmit = value.trim().length > 0 && !disabled && !isLoading;

  return (
    <div className={cn('w-full', className)}>
      <div className="relative bg-card border border-border rounded-xl shadow-sm">
        {/* Top controls row */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          {/* Left controls */}
          <div className="flex items-center gap-1">
            {onOpenSettings && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onOpenSettings}
                  >
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
            )}
            
            {/* Quick Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Zap className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover border-border z-50">
                <DropdownMenuItem onClick={() => onChange('Summarize this conversation')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Summarize Chat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChange('Continue from where we left off')}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Continue
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChange('Explain this in simpler terms')}>
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Simplify
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChange('Generate code for this')}>
                  <Code className="w-4 h-4 mr-2" />
                  Generate Code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <GhostModelPicker
              mode={mode}
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
              matureFilterEnabled={matureFilterEnabled}
            />
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            {onAttach && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onAttach}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach file</TooltipContent>
              </Tooltip>
            )}

            {/* Credits and estimated cost display */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground cursor-default">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>{credits.toLocaleString()}</span>
                  </div>
                  {value.trim().length > 0 && (
                    <>
                      <span className="text-border">|</span>
                      <div className="flex items-center gap-1 text-swiss-burgundy">
                        <Coins className="w-3 h-3" />
                        <span>~{estimatedCost}</span>
                      </div>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <p>Balance: {credits.toLocaleString()} credits</p>
                  {value.trim().length > 0 && (
                    <p className="text-muted-foreground">Est. cost: ~{estimatedCost} credits</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>

            {/* Enhance prompt toggle */}
            {onToggleEnhance && (mode === 'image' || mode === 'video') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-8 w-8',
                      enhancePrompt
                        ? 'text-swiss-burgundy bg-swiss-burgundy/10'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={onToggleEnhance}
                  >
                    <Wand2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {enhancePrompt ? 'Prompt enhancement on' : 'Enhance prompt'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Textarea */}
        <div className="px-4 py-3">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDERS[mode]}
            disabled={disabled || isLoading}
            className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0 placeholder:text-muted-foreground/60"
            rows={1}
          />
        </div>

        {/* Bottom action row */}
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          {/* Streaming timer */}
          {isStreaming && elapsedTime > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-md">
              <Timer className="w-3.5 h-3.5 text-swiss-navy animate-pulse" />
              <span className="text-xs text-muted-foreground tabular-nums font-mono">
                {elapsedTime.toFixed(1)}s
              </span>
            </div>
          )}

          {/* Voice input button - self-contained, only in text mode */}
          {mode === 'text' && (
            <VoiceInputButton
              onTranscript={handleVoiceTranscript}
              disabled={disabled || isLoading}
              language={voiceLanguage}
            />
          )}

          {/* Submit/Cancel button */}
          {isStreaming && onCancel ? (
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-lg border-destructive text-destructive hover:bg-destructive/10"
              onClick={onCancel}
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className={cn(
                'h-9 w-9 rounded-lg transition-all',
                canSubmit
                  ? 'bg-swiss-navy hover:bg-swiss-navy/90 text-white'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSubmit();
              }}
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

      {/* Keyboard hint */}
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> to send,{' '}
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
