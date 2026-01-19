import { motion } from 'framer-motion';
import {
  Clock,
  Save,
  Zap,
  Shield,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
  GitCompare,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ServerCheckpoint } from '@/hooks/useCheckpoints';

interface CheckpointTimelineProps {
  checkpoints: ServerCheckpoint[];
  selectedId?: string;
  compareId?: string;
  onSelect: (checkpoint: ServerCheckpoint) => void;
  onCompare?: (checkpoint: ServerCheckpoint) => void;
  onRestore: (checkpoint: ServerCheckpoint) => void;
  isLoading?: boolean;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  manual: { icon: Save, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900', label: 'Manual' },
  auto: { icon: Clock, color: 'text-gray-500 bg-gray-100 dark:bg-gray-800', label: 'Auto' },
  pre_tool: { icon: Shield, color: 'text-amber-500 bg-amber-100 dark:bg-amber-900', label: 'Pre-Tool' },
  post_step: { icon: Zap, color: 'text-green-500 bg-green-100 dark:bg-green-900', label: 'Post-Step' },
};

export function CheckpointTimeline({
  checkpoints,
  selectedId,
  compareId,
  onSelect,
  onCompare,
  onRestore,
  isLoading,
}: CheckpointTimelineProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-5 w-5 animate-spin mr-2" />
        Loading checkpoint history...
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <RotateCcw className="h-12 w-12 mb-4 opacity-30" />
        <h3 className="font-medium mb-1">No checkpoints yet</h3>
        <p className="text-sm">Checkpoints will appear here as the run progresses</p>
      </div>
    );
  }

  // Group by date
  const grouped = checkpoints.reduce((acc, cp) => {
    const date = new Date(cp.created_at).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(cp);
    return acc;
  }, {} as Record<string, ServerCheckpoint[]>);

  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-6">
      {sortedDates.map((dateStr) => (
        <div key={dateStr}>
          <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-2 mb-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              {new Date(dateStr).toDateString() === new Date().toDateString()
                ? 'Today'
                : format(new Date(dateStr), 'EEEE, MMMM d')}
            </h4>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-3">
              {grouped[dateStr].map((checkpoint, i) => {
                const config = typeConfig[checkpoint.checkpoint_type] || typeConfig.auto;
                const Icon = config.icon;
                const isSelected = selectedId === checkpoint.id;
                const isCompare = compareId === checkpoint.id;
                const isLatest = i === 0 && dateStr === sortedDates[0];

                return (
                  <motion.div
                    key={checkpoint.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      'relative flex items-start gap-4 pl-10 pr-3 py-3 rounded-lg transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 border border-primary/30'
                        : isCompare
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => onSelect(checkpoint)}
                  >
                    {/* Timeline node */}
                    <div
                      className={cn(
                        'absolute left-2 w-7 h-7 rounded-full flex items-center justify-center border-2 border-background',
                        config.color,
                        !checkpoint.is_valid && 'opacity-50'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          v{checkpoint.version}
                        </Badge>
                        <Badge className={cn('text-xs', config.color)}>
                          {config.label}
                        </Badge>
                        {isLatest && (
                          <Badge variant="default" className="text-xs">
                            Latest
                          </Badge>
                        )}
                        {!checkpoint.is_valid && (
                          <Badge variant="destructive" className="text-xs">
                            Invalid
                          </Badge>
                        )}
                        {isCompare && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                            Comparing
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1 text-sm">
                        <span className="font-medium">Step {checkpoint.step_number}</span>
                        {checkpoint.description && (
                          <span className="text-muted-foreground ml-2">
                            - {checkpoint.description}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{checkpoint.tokens_used.toLocaleString()} tokens</span>
                        <span>{(checkpoint.execution_time_ms / 1000).toFixed(1)}s</span>
                        <span>
                          {formatDistanceToNow(new Date(checkpoint.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(checkpoint);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View details</TooltipContent>
                      </Tooltip>

                      {onCompare && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant={isCompare ? 'secondary' : 'ghost'}
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCompare(checkpoint);
                              }}
                            >
                              <GitCompare className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Compare</TooltipContent>
                        </Tooltip>
                      )}

                      {checkpoint.is_valid && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestore(checkpoint);
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Restore to this checkpoint</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
