import { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, Copy, Volume2, VolumeX, Pencil, Image, Video,
  MoreHorizontal, Minus, Plus, ThumbsUp, ThumbsDown,
  Share2, Flag, Trash2, GitFork, Timer, Hash,
  StopCircle
} from '@/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GhostMessageActionsProps {
  content: string;
  messageId: string;
  responseTimeMs?: number;
  tokenCount?: number;
  contextUsagePercent?: number;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onFork?: () => void;
  onShorten?: () => void;
  onElaborate?: () => void;
  onCreateImage?: () => void;
  onCreateVideo?: () => void;
  onFeedback?: (type: 'good' | 'bad') => void;
  onShare?: () => void;
  onReport?: () => void;
  onStopGeneration?: () => void;
  className?: string;
}

export function GhostMessageActions({
  content,
  messageId,
  responseTimeMs,
  tokenCount,
  contextUsagePercent,
  isStreaming,
  onRegenerate,
  onEdit,
  onDelete,
  onFork,
  onShorten,
  onElaborate,
  onCreateImage,
  onCreateVideo,
  onFeedback,
  onShare,
  onReport,
  onStopGeneration,
  className,
}: GhostMessageActionsProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<'good' | 'bad' | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isMountedRef = useRef<boolean>(true);

  // Lifecycle management for TTS
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Stop speech on unmount
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSpeak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast.error('Text-to-speech not supported');
      return;
    }

    // Stop if already speaking
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      if (isMountedRef.current) setIsSpeaking(false);
      return;
    }

    // Don't speak empty content
    if (!content?.trim()) {
      toast.error('No content to read');
      return;
    }

    try {
      // Cancel any existing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(content);

      // Get voices and prefer English
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en-'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (isMountedRef.current) setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        if (isMountedRef.current) setIsSpeaking(false);
      };
      
      utterance.onerror = () => {
        if (isMountedRef.current) setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('[TTS] Error:', e);
      if (isMountedRef.current) setIsSpeaking(false);
    }
  };

  const handleFeedback = (type: 'good' | 'bad') => {
    setFeedbackGiven(type);
    onFeedback?.(type);
    toast.success(type === 'good' ? 'Thanks for the feedback!' : 'Feedback recorded');
  };

  // Show stop button while streaming
  if (isStreaming && onStopGeneration) {
    return (
      <div className={cn('flex items-center gap-2 pt-2', className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={onStopGeneration}
          className="h-7 gap-1.5 text-destructive border-destructive/50 hover:bg-destructive/10"
        >
          <StopCircle className="w-3.5 h-3.5" />
          Stop generating
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn('flex flex-wrap items-center gap-1 pt-2', className)}>
        {/* Primary Actions Row */}
        <div className="flex items-center gap-0.5">
          {onRegenerate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRegenerate}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regenerate</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>

          {onEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          )}

          {onFork && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFork}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  <GitFork className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fork conversation</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSpeak}
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-foreground",
                  isSpeaking && "text-primary"
                )}
              >
                {isSpeaking ? (
                  <VolumeX className="w-3.5 h-3.5 animate-pulse" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isSpeaking ? 'Stop reading' : 'Read aloud'}</TooltipContent>
          </Tooltip>

          {/* Create Image */}
          {onCreateImage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCreateImage}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  <Image className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create image from this</TooltipContent>
            </Tooltip>
          )}

          {/* Create Video */}
          {onCreateVideo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCreateVideo}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  <Video className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create video from this</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-border mx-1" />

        {/* Feedback Buttons */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback('good')}
                disabled={feedbackGiven !== null}
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-foreground",
                  feedbackGiven === 'good' && "text-success"
                )}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Good response</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback('bad')}
                disabled={feedbackGiven !== null}
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-foreground",
                  feedbackGiven === 'bad' && "text-destructive"
                )}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bad response</TooltipContent>
          </Tooltip>
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-border mx-1" />

        {/* Metrics Display */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {tokenCount !== undefined && tokenCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 tabular-nums">
                  <Hash className="w-3 h-3" />
                  {tokenCount}
                </span>
              </TooltipTrigger>
              <TooltipContent>{tokenCount} tokens</TooltipContent>
            </Tooltip>
          )}

          {contextUsagePercent !== undefined && contextUsagePercent > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="tabular-nums px-1.5 py-0.5 rounded bg-muted/50">
                  {contextUsagePercent}%
                </span>
              </TooltipTrigger>
              <TooltipContent>Context window usage</TooltipContent>
            </Tooltip>
          )}

          {responseTimeMs !== undefined && responseTimeMs > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 tabular-nums">
                  <Timer className="w-3 h-3" />
                  {(responseTimeMs / 1000).toFixed(1)}s
                </span>
              </TooltipTrigger>
              <TooltipContent>Response time</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* More Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onShorten && (
              <DropdownMenuItem onClick={onShorten} className="gap-2 cursor-pointer">
                <Minus className="w-4 h-4" />
                Shorten response
              </DropdownMenuItem>
            )}
            {onElaborate && (
              <DropdownMenuItem onClick={onElaborate} className="gap-2 cursor-pointer">
                <Plus className="w-4 h-4" />
                Elaborate more
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onShare && (
              <DropdownMenuItem onClick={onShare} className="gap-2 cursor-pointer">
                <Share2 className="w-4 h-4" />
                Encrypt & share
              </DropdownMenuItem>
            )}
            {onReport && (
              <DropdownMenuItem onClick={onReport} className="gap-2 cursor-pointer">
                <Flag className="w-4 h-4" />
                Report conversation
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onDelete} 
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete message
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
