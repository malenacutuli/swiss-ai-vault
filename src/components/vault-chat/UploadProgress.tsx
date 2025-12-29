import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, FileSearch, Brain, CheckCircle, Loader2, 
  FileText, Zap 
} from '@/icons';

export type ProcessingStage = 'uploading' | 'extracting' | 'embedding' | 'complete' | 'error';

interface UploadProgressProps {
  progress: number;
  stage: ProcessingStage;
  fileName: string;
  fileSize: string;
  error?: string;
  className?: string;
}

const STAGE_CONFIG = {
  uploading: {
    icon: Upload,
    label: 'Uploading',
    description: 'Sending file to server...',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  extracting: {
    icon: FileSearch,
    label: 'Extracting',
    description: 'Reading document content...',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  embedding: {
    icon: Brain,
    label: 'Embedding',
    description: 'Generating semantic vectors...',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  complete: {
    icon: CheckCircle,
    label: 'Complete',
    description: 'Document ready for search',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  error: {
    icon: FileText,
    label: 'Error',
    description: 'Processing failed',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
};

const STAGES: ProcessingStage[] = ['uploading', 'extracting', 'embedding', 'complete'];

export function UploadProgress({
  progress,
  stage,
  fileName,
  fileSize,
  error,
  className,
}: UploadProgressProps) {
  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;
  const currentStageIndex = STAGES.indexOf(stage);

  return (
    <div className={cn(
      "p-4 rounded-lg border border-border bg-card/95 backdrop-blur-sm",
      "animate-in fade-in slide-in-from-bottom-2 duration-200",
      className
    )}>
      {/* File Info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate">{fileName}</span>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{fileSize}</span>
      </div>

      {/* Stage Indicator Pills */}
      <div className="flex items-center gap-1.5 mb-3">
        {STAGES.map((s, idx) => {
          const isActive = s === stage;
          const isPast = idx < currentStageIndex;
          const stageConfig = STAGE_CONFIG[s];
          const StageIcon = stageConfig.icon;

          return (
            <div
              key={s}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all",
                isActive && cn(stageConfig.bgColor, stageConfig.color, "font-medium"),
                isPast && "bg-emerald-500/10 text-emerald-500",
                !isActive && !isPast && "bg-muted/50 text-muted-foreground"
              )}
            >
              {isActive && stage !== 'complete' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <StageIcon className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">{stageConfig.label}</span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <Progress 
          value={progress} 
          className={cn(
            "h-2",
            stage === 'complete' && "[&>div]:bg-emerald-500",
            stage === 'error' && "[&>div]:bg-destructive"
          )} 
        />
        <div className="flex items-center justify-between text-xs">
          <span className={cn("flex items-center gap-1", config.color)}>
            {stage !== 'complete' && stage !== 'error' && (
              <Zap className="h-3 w-3" />
            )}
            {error || config.description}
          </span>
          <span className="font-medium text-muted-foreground">{progress}%</span>
        </div>
      </div>
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
