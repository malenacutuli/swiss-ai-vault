/**
 * SwissBrAIn Generation Trigger Button
 * High-fidelity button that manages the generation lifecycle with visual feedback
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Loader2, Lock, CheckCircle2, AlertCircle, 
  Network, Presentation, Mic, HelpCircle, Video,
  FileBarChart, BookOpen, MessageSquare, Clock, GraduationCap, Table2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type ArtifactType = 
  | 'mindmap' | 'slides' | 'podcast' | 'quiz' | 'video'
  | 'report' | 'flashcards' | 'faq' | 'timeline' | 'study_guide' | 'table';

type ButtonStatus = 'idle' | 'processing' | 'success' | 'error';

interface GenerationTriggerProps {
  artifactType: ArtifactType;
  onGenerate: () => Promise<void>;
  onAbort?: () => void;
  disabled?: boolean;
  estimatedCredits?: number;
  sourceCount?: number;
  selectedTheme?: string;
  className?: string;
}

const labels: Record<ArtifactType, string> = {
  mindmap: 'Generate Mind Map',
  slides: 'Build Slide Deck',
  podcast: 'Create Podcast',
  quiz: 'Generate Quiz',
  video: 'Render Video',
  report: 'Create Report',
  flashcards: 'Generate Flashcards',
  faq: 'Generate FAQ',
  timeline: 'Create Timeline',
  study_guide: 'Create Study Guide',
  table: 'Generate Table',
};

const icons: Record<ArtifactType, string> = {
  mindmap: '🗺️',
  slides: '📊',
  podcast: '🎙️',
  quiz: '❓',
  video: '🎬',
  report: '📄',
  flashcards: '📚',
  faq: '💬',
  timeline: '⏳',
  study_guide: '📖',
  table: '📋',
};

const IconComponents: Record<ArtifactType, React.ComponentType<{ className?: string }>> = {
  mindmap: Network,
  slides: Presentation,
  podcast: Mic,
  quiz: HelpCircle,
  video: Video,
  report: FileBarChart,
  flashcards: BookOpen,
  faq: MessageSquare,
  timeline: Clock,
  study_guide: GraduationCap,
  table: Table2,
};

const statusMessages: Record<ArtifactType, string[]> = {
  mindmap: ['Analyzing relationships...', 'Building concept graph...', 'Laying out nodes...'],
  slides: ['Extracting key points...', 'Designing layouts...', 'Adding visuals...'],
  podcast: ['Processing audio...', 'Generating dialogue...', 'Mixing tracks...'],
  quiz: ['Creating questions...', 'Validating answers...', 'Finalizing quiz...'],
  video: ['Rendering frames...', 'Adding motion...', 'Encoding video...'],
  report: ['Analyzing content...', 'Structuring report...', 'Adding citations...'],
  flashcards: ['Creating cards...', 'Organizing topics...', 'Finalizing deck...'],
  faq: ['Identifying questions...', 'Generating answers...', 'Organizing FAQ...'],
  timeline: ['Extracting events...', 'Ordering chronologically...', 'Creating timeline...'],
  study_guide: ['Summarizing content...', 'Creating sections...', 'Adding review materials...'],
  table: ['Extracting data...', 'Structuring columns...', 'Formatting table...'],
};

// High-credit operations that require confirmation
const HIGH_CREDIT_TYPES: ArtifactType[] = ['video', 'podcast'];

export function GenerationTrigger({
  artifactType,
  onGenerate,
  onAbort,
  disabled = false,
  estimatedCredits,
  sourceCount,
  selectedTheme,
  className,
}: GenerationTriggerProps) {
  const [status, setStatus] = useState<ButtonStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const Icon = IconComponents[artifactType];
  const requiresConfirmation = HIGH_CREDIT_TYPES.includes(artifactType) && (estimatedCredits || 0) > 10;

  const handleClick = async () => {
    if (status === 'processing') {
      onAbort?.();
      setStatus('idle');
      setProgress(0);
      return;
    }

    if (requiresConfirmation) {
      setShowConfirmation(true);
      return;
    }

    await executeGeneration();
  };

  const executeGeneration = async () => {
    setStatus('processing');
    setProgress(0);
    setStatusMessage(statusMessages[artifactType][0]);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = Math.min(prev + Math.random() * 15, 90);
        const msgIndex = Math.floor((next / 100) * statusMessages[artifactType].length);
        setStatusMessage(statusMessages[artifactType][Math.min(msgIndex, statusMessages[artifactType].length - 1)]);
        return next;
      });
    }, 800);

    try {
      await onGenerate();
      clearInterval(progressInterval);
      setProgress(100);
      setStatus('success');
      setStatusMessage('Complete!');
      
      // Reset to idle after success
      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
      }, 2000);
    } catch (error) {
      clearInterval(progressInterval);
      setStatus('error');
      setProgress(0);
    }
  };

  // Processing state - morphs into progress pill
  if (status === 'processing') {
    return (
      <div className={cn('relative', className)}>
        <button
          onClick={handleClick}
          className="w-full relative overflow-hidden rounded-xl border border-[#1D4E5F]/30 bg-[#1D4E5F]/5 p-4"
        >
          {/* Progress bar */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#1D4E5F]/20 to-[#2a6577]/20 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[#1D4E5F] animate-spin" />
              <span className="text-sm font-medium text-[#1D4E5F]">Stop Generating</span>
            </div>
            <span className="text-sm font-semibold text-[#1D4E5F]">{Math.round(progress)}%</span>
          </div>
        </button>
        <p className="text-xs text-muted-foreground text-center mt-2">{statusMessage}</p>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <button
        className={cn(
          'w-full px-6 py-4 rounded-xl font-semibold transition-all',
          'bg-green-500 text-white',
          className
        )}
      >
        <span className="flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Complete!
        </span>
      </button>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'w-full px-6 py-4 rounded-xl font-semibold transition-all',
          'bg-red-500 text-white hover:bg-red-600',
          className
        )}
      >
        <span className="flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Failed - Retry?
        </span>
      </button>
    );
  }

  // Disabled state
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            disabled
            className={cn(
              'w-full px-6 py-4 rounded-xl font-semibold transition-all',
              'bg-muted text-muted-foreground cursor-not-allowed',
              className
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" />
              {labels[artifactType]}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Select sources and theme to continue</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Ready state
  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          'w-full px-6 py-4 rounded-xl font-semibold transition-all',
          'bg-gradient-to-r from-[#1D4E5F] to-[#2a6577] text-white',
          'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
          className
        )}
      >
        <span className="flex items-center justify-center gap-2">
          <span className="text-lg">{icons[artifactType]}</span>
          {labels[artifactType]}
        </span>
        
        {estimatedCredits && (
          <span className="block text-xs opacity-70 mt-1">
            ~{estimatedCredits} credits
          </span>
        )}
      </button>

      {/* Confirmation dialog for high-credit operations */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Generation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  This will use approximately <strong>{estimatedCredits}</strong> credits.
                </p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {selectedTheme && <li>• Style: {selectedTheme}</li>}
                  {sourceCount && <li>• Sources: {sourceCount} document(s)</li>}
                  <li>• Output: {labels[artifactType].replace('Generate ', '').replace('Create ', '').replace('Build ', '')}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeGeneration}
              className="bg-[#1D4E5F] hover:bg-[#2a6577]"
            >
              <span className="text-lg mr-2">{icons[artifactType]}</span>
              Generate Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default GenerationTrigger;
