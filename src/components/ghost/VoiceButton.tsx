import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceButtonProps {
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  onClick: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceButton({
  isRecording,
  isTranscribing,
  audioLevel,
  onClick,
  onCancel,
  disabled = false,
  className,
}: VoiceButtonProps) {
  // Calculate ring size based on audio level
  const ringScale = 1 + (audioLevel / 100) * 0.5;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-8 w-8 transition-all duration-150',
            isRecording && 'text-swiss-burgundy',
            isTranscribing && 'text-swiss-sapphire',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
          onClick={onClick}
          onContextMenu={(e) => {
            e.preventDefault();
            if (isRecording && onCancel) {
              onCancel();
            }
          }}
          disabled={disabled || isTranscribing}
        >
          {/* Audio level ring animation */}
          {isRecording && (
            <span
              className="absolute inset-0 rounded-lg bg-swiss-burgundy/20 transition-transform duration-75"
              style={{
                transform: `scale(${ringScale})`,
              }}
            />
          )}
          
          {/* Pulse animation when recording */}
          {isRecording && (
            <span className="absolute inset-0 rounded-lg bg-swiss-burgundy/10 animate-ping" />
          )}

          {isTranscribing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-4 h-4 relative z-10" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isTranscribing
          ? 'Transcribing...'
          : isRecording
          ? 'Click to stop recording'
          : 'Voice input'
        }
      </TooltipContent>
    </Tooltip>
  );
}
