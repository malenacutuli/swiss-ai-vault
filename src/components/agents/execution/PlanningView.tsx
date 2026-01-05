import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';

interface PlanningViewProps {
  className?: string;
}

const planningSteps = [
  'Analyzing your request...',
  'Understanding context...',
  'Identifying required tools...',
  'Creating execution plan...',
];

export function PlanningView({ className }: PlanningViewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate through planning steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % planningSteps.length);
    }, 2000);

    // Animate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 500);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      {/* Animated Icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping opacity-20">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <Sparkles className="h-12 w-12 text-primary animate-pulse" />
      </div>

      {/* Status Text */}
      <h3 className="text-xl font-light text-foreground mb-2">
        Planning Your Task
      </h3>
      
      <p className="text-sm text-muted-foreground mb-8 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {planningSteps[currentStep]}
      </p>

      {/* Progress Bar */}
      <div className="w-full max-w-xs">
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Reassurance */}
      <p className="text-xs text-muted-foreground mt-6">
        This usually takes a few seconds...
      </p>
    </div>
  );
}
