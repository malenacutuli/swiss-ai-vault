import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Volume2, VolumeX, Loader2, Pause, Play } from '@/icons';

interface ReadAloudButtonProps {
  messageId: string;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  progress: number;
  currentMessageId: string | null;
  onSpeak: () => void;
  onStop: () => void;
  className?: string;
}

export function ReadAloudButton({
  messageId,
  isPlaying,
  isPaused,
  isLoading,
  progress,
  currentMessageId,
  onSpeak,
  onStop,
  className,
}: ReadAloudButtonProps) {
  const isThisMessage = currentMessageId === messageId;
  const isActive = isThisMessage && (isPlaying || isPaused || isLoading);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-7 w-7 transition-all duration-150',
            isActive && 'text-swiss-sapphire',
            className
          )}
          onClick={isActive ? (isPlaying ? onStop : onSpeak) : onSpeak}
        >
          {/* Progress ring */}
          {isThisMessage && (isPlaying || isPaused) && (
            <svg
              className="absolute inset-0 -rotate-90"
              viewBox="0 0 28 28"
            >
              <circle
                className="text-muted stroke-current"
                strokeWidth="2"
                fill="none"
                r="12"
                cx="14"
                cy="14"
              />
              <circle
                className="text-swiss-sapphire stroke-current transition-all duration-100"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                r="12"
                cx="14"
                cy="14"
                strokeDasharray={`${(progress / 100) * 75.4} 75.4`}
              />
            </svg>
          )}

          {isThisMessage && isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin relative z-10" />
          ) : isThisMessage && isPlaying ? (
            <Pause className="w-3.5 h-3.5 relative z-10" />
          ) : isThisMessage && isPaused ? (
            <Play className="w-3.5 h-3.5 relative z-10" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isThisMessage && isLoading
          ? 'Generating audio...'
          : isThisMessage && isPlaying
          ? 'Pause'
          : isThisMessage && isPaused
          ? 'Resume'
          : 'Read aloud'
        }
      </TooltipContent>
    </Tooltip>
  );
}
