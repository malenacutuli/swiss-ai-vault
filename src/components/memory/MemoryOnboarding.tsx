import { useState } from 'react';
import { 
  Brain, 
  Shield, 
  Search, 
  Cloud, 
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check
} from '@/icons';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  features?: string[];
  highlight?: 'privacy' | 'search' | 'sync';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    icon: <Brain className="w-8 h-8" />,
    title: 'Welcome to Personal AI Memory',
    description: 'Your private knowledge base that makes every AI conversation smarter. Unlike other AI tools, your memory stays on YOUR device.',
    features: [
      'Store documents, notes, and chat excerpts',
      'AI automatically finds relevant context',
      'Works with any AI model you choose'
    ]
  },
  {
    id: 'privacy',
    icon: <Shield className="w-8 h-8" />,
    title: 'Your Privacy, Guaranteed',
    description: 'SwissVault Memory uses client-side encryption. Your data never leaves your device unencrypted.',
    features: [
      'AES-256-GCM encryption (bank-grade)',
      'Embeddings generated locally in your browser',
      'We literally cannot read your data',
      'Swiss jurisdiction protection'
    ],
    highlight: 'privacy'
  },
  {
    id: 'search',
    icon: <Search className="w-8 h-8" />,
    title: 'Smart Semantic Search',
    description: 'Memory uses AI to understand meaning, not just keywords. Ask questions naturally and get relevant results.',
    features: [
      '"What did I learn about Swiss tax law?"',
      '"Find my notes on the Johnson deal"',
      '"What were the key points from that research paper?"'
    ],
    highlight: 'search'
  },
  {
    id: 'sync',
    icon: <Cloud className="w-8 h-8" />,
    title: 'Sync on Your Terms',
    description: "Optionally backup to YOUR cloud storage. We never see your data - it's encrypted before it leaves your device.",
    features: [
      'Google Drive for personal use',
      'Amazon S3 for enterprise',
      'Or keep it 100% local - your choice'
    ],
    highlight: 'sync'
  },
  {
    id: 'ready',
    icon: <Sparkles className="w-8 h-8" />,
    title: "You're Ready!",
    description: 'Start building your AI memory. Upload a document, save a note, or just start chatting - Memory will help you remember everything.',
    features: [
      'Upload your first document',
      'Create a quick note',
      'Enable memory in chat with the brain icon'
    ]
  }
];

interface MemoryOnboardingProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function MemoryOnboarding({ open, onComplete, onSkip }: MemoryOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  
  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  
  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const handlePrev = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg p-0 overflow-hidden" 
        hideClose
      >
        {/* Progress bar */}
        <div className="px-6 pt-6">
          <Progress value={progress} className="h-1" />
        </div>
        
        <div className="p-6 pt-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {ONBOARDING_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === currentStep 
                    ? "w-6 bg-primary" 
                    : i < currentStep
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          
          {/* Content */}
          <div className="text-center space-y-4">
            {/* Icon */}
            <div className={cn(
              "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center",
              step.highlight === 'privacy' ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" :
              step.highlight === 'search' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" :
              step.highlight === 'sync' ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" :
              "bg-primary/10 text-primary"
            )}>
              {step.icon}
            </div>
            
            {/* Title & Description */}
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">{step.title}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
            
            {/* Features */}
            {step.features && (
              <div className="pt-2">
                <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                  {step.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Comparison (for privacy step) */}
            {step.id === 'privacy' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-muted/50 rounded-lg p-3 text-left">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Others
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>• Data on their servers</p>
                    <p>• "Trust us" privacy</p>
                    <p>• May train on your data</p>
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-left border border-green-200 dark:border-green-800">
                  <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                    SwissVault
                  </div>
                  <div className="space-y-1 text-xs text-green-700 dark:text-green-400">
                    <p>• Data on YOUR device</p>
                    <p>• Verifiable encryption</p>
                    <p>• Zero access architecture</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Skip
            </Button>
            
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={handlePrev}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              
              <Button size="sm" onClick={handleNext}>
                {isLastStep ? (
                  <>
                    Get Started
                    <Sparkles className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
