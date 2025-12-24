import { 
  RefreshCw, Copy, Volume2, 
  MoreHorizontal, Minus, Plus, ThumbsUp, 
  ThumbsDown, Share2, Flag, Trash2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GhostMessageActionsProps {
  content: string;
  messageId: string;
  onRegenerate?: () => void;
  onShorten?: () => void;
  onElaborate?: () => void;
  onSpeak?: () => void;
  onDelete?: () => void;
  responseTimeMs?: number;
  tokenCount?: number;
  className?: string;
}

export function GhostMessageActions({
  content,
  messageId,
  onRegenerate,
  onShorten,
  onElaborate,
  onSpeak,
  onDelete,
  responseTimeMs,
  tokenCount,
  className,
}: GhostMessageActionsProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSpeak = () => {
    if (onSpeak) {
      onSpeak();
    } else {
      // Fallback to browser speech synthesis
      const utterance = new SpeechSynthesisUtterance(content);
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className={cn(
      'flex items-center gap-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity',
      className
    )}>
      {/* Primary Actions */}
      {onRegenerate && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={onRegenerate}
          title="Regenerate"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      )}
      
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        title="Copy"
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-muted-foreground hover:text-foreground"
        onClick={handleSpeak}
        title="Read aloud"
      >
        <Volume2 className="w-3.5 h-3.5" />
      </Button>
      
      {/* Token count */}
      {tokenCount && (
        <span className="text-xs text-muted-foreground px-2 tabular-nums">
          {tokenCount} tokens
        </span>
      )}
      
      {/* Response time */}
      {responseTimeMs && (
        <span className="text-xs text-muted-foreground px-2 tabular-nums">
          {(responseTimeMs / 1000).toFixed(1)}s
        </span>
      )}
      
      {/* More menu */}
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
              Shorten
            </DropdownMenuItem>
          )}
          {onElaborate && (
            <DropdownMenuItem onClick={onElaborate} className="gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              Elaborate
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer">
            <ThumbsUp className="w-4 h-4" />
            Good response
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 cursor-pointer">
            <ThumbsDown className="w-4 h-4" />
            Bad response
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 cursor-pointer">
            <Share2 className="w-4 h-4" />
            Share conversation
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 cursor-pointer">
            <Flag className="w-4 h-4" />
            Report issue
          </DropdownMenuItem>
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete} 
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}