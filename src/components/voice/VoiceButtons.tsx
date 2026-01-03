import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VoiceInputButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInputButton({
  isRecording,
  isProcessing,
  isSupported,
  onToggle,
  disabled,
  className,
}: VoiceInputButtonProps) {
  if (!isSupported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled
            className={cn("h-10 w-10 shrink-0 opacity-50", className)}
          >
            <MicOff className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Voice input not supported</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isRecording ? "destructive" : "outline"}
          size="icon"
          onClick={onToggle}
          disabled={disabled || isProcessing}
          className={cn(
            "h-10 w-10 shrink-0 transition-all",
            isRecording && "animate-pulse",
            className
          )}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isProcessing ? 'Transcribing...' : isRecording ? 'Stop recording' : 'Voice input'}
      </TooltipContent>
    </Tooltip>
  );
}

interface VoiceOutputButtonProps {
  isPlaying: boolean;
  isLoading: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceOutputButton({
  isPlaying,
  isLoading,
  onToggle,
  disabled,
  className,
}: VoiceOutputButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={onToggle}
          disabled={disabled || isLoading}
          className={cn("h-10 w-10 shrink-0", className)}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isLoading ? 'Loading audio...' : isPlaying ? 'Stop reading' : 'Read aloud'}
      </TooltipContent>
    </Tooltip>
  );
}
