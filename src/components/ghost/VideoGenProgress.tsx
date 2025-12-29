import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, Video } from '@/icons';
import { Progress } from '@/components/ui/progress';
import { SwissCard } from '@/components/ui/swiss';
import { cn } from '@/lib/utils';

export interface VideoJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  prompt: string;
  model: string;
  startedAt: number;
  completedAt?: number;
  videoUrl?: string;
  error?: string;
  estimatedTime?: number;
}

interface VideoGenProgressProps {
  job: VideoJob;
  onComplete?: (videoUrl: string) => void;
  onCancel?: () => void;
  className?: string;
}

const STATUS_MESSAGES: Record<string, string[]> = {
  queued: ['Waiting in queue...', 'Preparing your request...'],
  processing: [
    'Analyzing your prompt...',
    'Generating frames...',
    'Adding motion...',
    'Rendering video...',
    'Almost there...',
  ],
  completed: ['Video ready!'],
  failed: ['Generation failed'],
};

export function VideoGenProgress({ job, onComplete, onCancel, className }: VideoGenProgressProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Cycle through messages
  useEffect(() => {
    if (job.status === 'queued' || job.status === 'processing') {
      const interval = setInterval(() => {
        const messages = STATUS_MESSAGES[job.status];
        setMessageIndex(prev => (prev + 1) % messages.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [job.status]);

  // Track elapsed time
  useEffect(() => {
    if (job.status === 'processing') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - job.startedAt) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [job.status, job.startedAt]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (job.status) {
      case 'queued':
        return <Clock className="w-5 h-5 text-muted-foreground animate-pulse" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-swiss-teal animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-destructive" />;
    }
  };

  const currentMessage = STATUS_MESSAGES[job.status][messageIndex] || STATUS_MESSAGES[job.status][0];

  return (
    <SwissCard className={cn('p-4', className)}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
          {getStatusIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium truncate">{job.model}</p>
            {job.status === 'processing' && (
              <span className="text-xs text-muted-foreground">
                {formatTime(elapsedTime)}
                {job.estimatedTime && ` / ~${formatTime(job.estimatedTime)}`}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-3 truncate">
            {currentMessage}
          </p>

          {(job.status === 'queued' || job.status === 'processing') && (
            <Progress value={job.progress} className="h-1.5" />
          )}

          {job.status === 'failed' && job.error && (
            <p className="text-xs text-destructive mt-2">{job.error}</p>
          )}

          <p className="text-xs text-muted-foreground/70 mt-2 truncate">
            {job.prompt.length > 60 ? job.prompt.slice(0, 60) + '...' : job.prompt}
          </p>
        </div>
      </div>
    </SwissCard>
  );
}

// Hook to manage video generation jobs
export function useVideoJobs() {
  const [jobs, setJobs] = useState<VideoJob[]>(() => {
    const saved = localStorage.getItem('ghost-video-jobs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('ghost-video-jobs', JSON.stringify(jobs));
  }, [jobs]);

  const addJob = (job: Omit<VideoJob, 'id' | 'startedAt' | 'status' | 'progress'>) => {
    const newJob: VideoJob = {
      ...job,
      id: crypto.randomUUID(),
      status: 'queued',
      progress: 0,
      startedAt: Date.now(),
    };
    setJobs(prev => [newJob, ...prev]);
    return newJob.id;
  };

  const updateJob = (id: string, updates: Partial<VideoJob>) => {
    setJobs(prev => prev.map(job => 
      job.id === id ? { ...job, ...updates } : job
    ));
  };

  const removeJob = (id: string) => {
    setJobs(prev => prev.filter(job => job.id !== id));
  };

  const clearCompleted = () => {
    setJobs(prev => prev.filter(job => job.status !== 'completed' && job.status !== 'failed'));
  };

  return { jobs, addJob, updateJob, removeJob, clearCompleted };
}
