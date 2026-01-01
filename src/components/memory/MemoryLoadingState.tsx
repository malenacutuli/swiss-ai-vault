import { Brain, Loader2, Download, Database, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface MemoryLoadingStateProps {
  stage: 'initializing' | 'downloading' | 'loading' | 'indexing' | 'ready';
  progress?: number;
  message?: string;
}

export function MemoryLoadingState({ 
  stage, 
  progress = 0, 
  message 
}: MemoryLoadingStateProps) {
  const stages = {
    initializing: {
      icon: Brain,
      title: 'Initializing Memory',
      description: 'Setting up your personal AI memory...'
    },
    downloading: {
      icon: Download,
      title: 'Downloading Model',
      description: 'Getting the embedding model (one-time download)...'
    },
    loading: {
      icon: Loader2,
      title: 'Loading Model',
      description: 'Preparing the AI for your memory...'
    },
    indexing: {
      icon: Database,
      title: 'Loading Memory',
      description: 'Accessing your encrypted knowledge base...'
    },
    ready: {
      icon: Sparkles,
      title: 'Memory Ready',
      description: 'Your AI memory is active!'
    }
  };

  const current = stages[stage];
  const Icon = current.icon;
  const isAnimated = stage !== 'ready';

  return (
    <Card>
      <CardContent className="py-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className={`p-4 rounded-full bg-primary/10 ${isAnimated ? 'animate-pulse' : ''}`}>
            <Icon className={`h-8 w-8 text-primary ${stage === 'loading' ? 'animate-spin' : ''}`} />
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-medium text-foreground">{current.title}</h3>
            <p className="text-sm text-muted-foreground">
              {message || current.description}
            </p>
          </div>
          
          {stage !== 'ready' && (
            <div className="w-full max-w-xs space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {progress > 0 ? `${progress}%` : 'Please wait...'}
              </p>
            </div>
          )}
          
          {stage === 'downloading' && (
            <p className="text-xs text-muted-foreground">
              ~30MB download, cached for future use
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
