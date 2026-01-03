import { Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceRecordingOverlayProps {
  isRecording: boolean;
  duration: number;
  onStop: () => void;
  onCancel: () => void;
  variant?: 'ghost' | 'vault';
}

export function VoiceRecordingOverlay({
  isRecording,
  duration,
  onStop,
  onCancel,
  variant = 'ghost',
}: VoiceRecordingOverlayProps) {
  if (!isRecording) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isGhost = variant === 'ghost';

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-background/95 backdrop-blur-sm border border-border shadow-lg animate-fade-in">
      {/* Recording indicator */}
      <div className="flex items-center gap-3">
        <div 
          className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            isGhost ? "bg-destructive" : "bg-primary"
          )} 
        />
        <span className="text-sm font-medium text-foreground">
          {isGhost ? 'Recording...' : 'Recording (Encrypted)'}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums font-mono">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          variant={isGhost ? "destructive" : "default"}
          size="sm"
          onClick={onStop}
        >
          <Square className="h-3 w-3 mr-1 fill-current" />
          Stop
        </Button>
      </div>
    </div>
  );
}
