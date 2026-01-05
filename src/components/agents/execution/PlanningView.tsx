import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface PlanningViewProps {
  className?: string;
}

const planningSteps = [
  'Analyzing your request',
  'Understanding context',
  'Identifying tools',
  'Creating plan',
];

export function PlanningView({ className }: PlanningViewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate through planning steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % planningSteps.length);
    }, 1800);

    // Animate progress smoothly
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) return prev;
        return prev + Math.random() * 8;
      });
    }, 400);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className={cn('flex flex-col items-center justify-center py-16', className)}>
      {/* Minimal pulsing indicator */}
      <div className="relative mb-10">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-primary animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
      </div>

      {/* Status Text - Swiss typography */}
      <h3 className="text-2xl font-light text-foreground tracking-tight mb-3">
        Planning
      </h3>
      
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">
          {planningSteps[currentStep]}...
        </p>
      </div>

      {/* Progress Bar - Minimal */}
      <div className="w-full max-w-xs">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Subtle hint */}
      <p className="text-xs text-muted-foreground mt-8">
        Usually takes a few seconds
      </p>
    </div>
  );
}
