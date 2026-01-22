import React, { useEffect, useState } from 'react';
import {
  Globe,
  Code,
  FileText,
  Search,
  Presentation,
  BarChart3,
  Table,
  Palette,
  Calendar,
  Video,
  Music,
  Brain,
  BookOpen,
  Map,
  Loader2,
  Check,
  Clock,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { routeTask, getRouteDescription, getToolsDescription, type TaskRouteResult } from '@/lib/agents/TaskRouter';
import type { TaskMode } from './AgentsTaskInput';

interface TaskRoutingIndicatorProps {
  prompt: string;
  className?: string;
  showDetails?: boolean;
  onRouteChange?: (route: TaskRouteResult) => void;
}

const MODE_ICONS: Record<TaskMode, React.ReactNode> = {
  default: <Brain className="w-4 h-4" />,
  slides: <Presentation className="w-4 h-4" />,
  research: <Search className="w-4 h-4" />,
  website: <Globe className="w-4 h-4" />,
  apps: <Code className="w-4 h-4" />,
  design: <Palette className="w-4 h-4" />,
  schedule: <Calendar className="w-4 h-4" />,
  spreadsheet: <Table className="w-4 h-4" />,
  visualization: <BarChart3 className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  audio: <Music className="w-4 h-4" />,
  podcast: <Music className="w-4 h-4" />,
  chat: <Brain className="w-4 h-4" />,
  playbook: <FileText className="w-4 h-4" />,
  flashcards: <BookOpen className="w-4 h-4" />,
  quiz: <BookOpen className="w-4 h-4" />,
  mindmap: <Map className="w-4 h-4" />,
  studyguide: <BookOpen className="w-4 h-4" />,
};

const DURATION_LABELS: Record<string, { label: string; color: string }> = {
  quick: { label: '~1 min', color: 'text-green-600 bg-green-100' },
  medium: { label: '2-5 min', color: 'text-amber-600 bg-amber-100' },
  long: { label: '5+ min', color: 'text-orange-600 bg-orange-100' },
};

export function TaskRoutingIndicator({
  prompt,
  className,
  showDetails = true,
  onRouteChange,
}: TaskRoutingIndicatorProps) {
  const [route, setRoute] = useState<TaskRouteResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!prompt || prompt.length < 5) {
      setRoute(null);
      return;
    }

    // Debounce the analysis
    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      const result = routeTask(prompt);
      setRoute(result);
      setIsAnalyzing(false);
      onRouteChange?.(result);
    }, 300);

    return () => clearTimeout(timer);
  }, [prompt, onRouteChange]);

  if (!prompt || prompt.length < 5) {
    return null;
  }

  if (isAnalyzing) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Analyzing task...</span>
      </div>
    );
  }

  if (!route) {
    return null;
  }

  const durationInfo = DURATION_LABELS[route.estimatedDuration || 'medium'];

  return (
    <div className={cn('space-y-2', className)}>
      {/* Main Route Indicator */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary">
          {MODE_ICONS[route.mode]}
          <span className="font-medium">{getRouteDescription(route)}</span>
        </div>

        {/* Confidence indicator */}
        {route.confidenceScore >= 0.7 && (
          <div className="flex items-center gap-1 text-green-600">
            <Check className="w-3.5 h-3.5" />
            <span className="text-xs">Detected</span>
          </div>
        )}

        {/* Duration estimate */}
        <Badge variant="outline" className={cn('text-xs', durationInfo.color)}>
          <Clock className="w-3 h-3 mr-1" />
          {durationInfo.label}
        </Badge>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="flex flex-wrap gap-2 text-xs">
          {/* Required capabilities */}
          {route.requiresBrowser && (
            <Badge variant="secondary" className="text-xs">
              <Globe className="w-3 h-3 mr-1" />
              Browser
            </Badge>
          )}
          {route.requiresCode && (
            <Badge variant="secondary" className="text-xs">
              <Code className="w-3 h-3 mr-1" />
              Code
            </Badge>
          )}
          {route.requiresFiles && (
            <Badge variant="secondary" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              Files
            </Badge>
          )}
          {route.requiresResearch && (
            <Badge variant="secondary" className="text-xs">
              <Search className="w-3 h-3 mr-1" />
              Research
            </Badge>
          )}

          {/* Tools being used */}
          {route.toolsRequired.length > 0 && (
            <span className="text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {getToolsDescription(route)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Compact version for inline display
export function TaskRoutingBadge({
  prompt,
  className,
}: {
  prompt: string;
  className?: string;
}) {
  const [route, setRoute] = useState<TaskRouteResult | null>(null);

  useEffect(() => {
    if (prompt && prompt.length >= 5) {
      const result = routeTask(prompt);
      setRoute(result);
    }
  }, [prompt]);

  if (!route) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-normal',
        route.confidenceScore >= 0.7 && 'border-primary/30 bg-primary/5',
        className
      )}
    >
      {MODE_ICONS[route.mode]}
      <span className="ml-1.5">{getRouteDescription(route)}</span>
    </Badge>
  );
}

export default TaskRoutingIndicator;
