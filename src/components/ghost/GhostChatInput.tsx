import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GhostModelPicker } from './GhostModelPicker';
import {
  Settings2,
  Zap,
  Paperclip,
  Wand2,
  Send,
  Square,
  Loader2,
} from 'lucide-react';

type GhostMode = 'text' | 'image' | 'video' | 'search';

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
  credits?: number;
  enhancePrompt?: boolean;
  onToggleEnhance?: () => void;
  onOpenSettings?: () => void;
  onAttach?: () => void;
  disabled?: boolean;
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
  credits = 0,
  enhancePrompt = false,
  onToggleEnhance,
  onOpenSettings,
  onAttach,
  disabled = false,
  className,
}: GhostChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      if (!disabled && !isLoading && value.trim()) {
        onSubmit();
      }
    }
  };

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
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Zap className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Quick Actions</TooltipContent>
            </Tooltip>

            <GhostModelPicker
              mode={mode}
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
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

            {/* Credits display */}
            <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
              <Zap className="w-3 h-3" />
              <span>{credits.toLocaleString()}</span>
            </div>

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

        {/* Submit button */}
        <div className="absolute right-3 bottom-3">
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

      {/* Keyboard hint */}
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> to send,{' '}
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
