/**
 * SwissBrAIn Studio State Orchestrator
 * Coordinates AI generation lifecycle with visual feedback
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface BboxHighlight {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceId: string;
  text: string;
}

export interface Artifact {
  type: string;
  data: any;
  generatedAt: Date;
  groundingMetadata?: {
    chunks: Array<{
      source_id: string;
      title: string;
      text: string;
      bbox?: BboxHighlight;
    }>;
  };
}

export interface StudioState {
  activeArtifact: Artifact | null;
  bboxHighlights: BboxHighlight[];
  isReady: boolean;
  generationStatus: 'idle' | 'processing' | 'success' | 'error';
  currentOperation: string | null;
  progress: number;
  statusMessage: string;
}

interface StudioStateContextValue extends StudioState {
  startGeneration: (type: string, label?: string) => string;
  updateProgress: (toastId: string, progress: number, message: string) => void;
  onGenerationComplete: (toastId: string, artifact: Artifact) => void;
  onGenerationError: (toastId: string, error: Error | string, onRetry?: () => void) => void;
  setActiveArtifact: (artifact: Artifact | null) => void;
  addBboxHighlight: (highlight: BboxHighlight) => void;
  clearBboxHighlights: () => void;
  dismissToast: (toastId: string) => void;
}

const StudioStateContext = createContext<StudioStateContextValue | null>(null);

// Custom toast components
const ProcessingToast = ({ 
  label, 
  progress, 
  message 
}: { 
  label: string; 
  progress: number; 
  message: string;
}) => (
  <div className="flex items-center gap-3 min-w-[280px]">
    <div className="relative">
      <div className="w-10 h-10 rounded-full bg-[#1D4E5F]/10 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#1D4E5F] animate-spin" />
      </div>
      <svg className="absolute inset-0 w-10 h-10 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="#1D4E5F"
          strokeWidth="3"
          strokeDasharray={100}
          strokeDashoffset={100 - progress}
          className="transition-all duration-300"
        />
      </svg>
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-foreground">Generating {label}...</p>
      <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
    </div>
    <span className="text-sm font-semibold text-[#1D4E5F]">{Math.round(progress)}%</span>
  </div>
);

const SuccessToast = ({ 
  label, 
  onView 
}: { 
  label: string; 
  onView?: () => void;
}) => (
  <div className="flex items-center gap-3 min-w-[280px]">
    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
      <CheckCircle2 className="w-5 h-5 text-green-600" />
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-foreground">Presentation ready!</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label} generated successfully</p>
    </div>
    {onView && (
      <button
        onClick={onView}
        className="px-3 py-1.5 text-xs font-medium bg-[#1D4E5F] text-white rounded-lg hover:bg-[#2a6577] transition-colors"
      >
        View
      </button>
    )}
  </div>
);

const ErrorToast = ({ 
  message, 
  onRetry,
  onDismiss
}: { 
  message: string; 
  onRetry?: () => void;
  onDismiss: () => void;
}) => (
  <div className="flex items-center gap-3 min-w-[280px]">
    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
      <AlertCircle className="w-5 h-5 text-red-600" />
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-foreground">Generation failed</p>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{message}</p>
    </div>
    <div className="flex items-center gap-2">
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      )}
      <button onClick={onDismiss} className="p-1 hover:bg-muted rounded">
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  </div>
);

interface StudioStateProviderProps {
  children: ReactNode;
}

export function StudioStateProvider({ children }: StudioStateProviderProps) {
  const [state, setState] = useState<StudioState>({
    activeArtifact: null,
    bboxHighlights: [],
    isReady: true,
    generationStatus: 'idle',
    currentOperation: null,
    progress: 0,
    statusMessage: '',
  });

  const startGeneration = useCallback((type: string, label?: string): string => {
    const displayLabel = label || type.replace(/_/g, ' ');
    
    setState(prev => ({
      ...prev,
      generationStatus: 'processing',
      currentOperation: type,
      progress: 0,
      statusMessage: 'Starting generation...',
    }));

    const toastId = toast.custom(
      (t) => (
        <div
          className={cn(
            'bg-background border border-border rounded-xl shadow-lg p-4 transition-all',
            t.visible ? 'animate-enter' : 'animate-leave'
          )}
        >
          <ProcessingToast label={displayLabel} progress={0} message="Starting generation..." />
        </div>
      ),
      { duration: Infinity, position: 'bottom-right', id: `gen-${Date.now()}` }
    );

    return toastId;
  }, []);

  const updateProgress = useCallback((toastId: string, progress: number, message: string) => {
    setState(prev => ({
      ...prev,
      progress,
      statusMessage: message,
    }));

    toast.custom(
      (t) => (
        <div
          className={cn(
            'bg-background border border-border rounded-xl shadow-lg p-4 transition-all',
            t.visible ? 'animate-enter' : 'animate-leave'
          )}
        >
          <ProcessingToast 
            label={state.currentOperation?.replace(/_/g, ' ') || 'content'} 
            progress={progress} 
            message={message} 
          />
        </div>
      ),
      { id: toastId, duration: Infinity }
    );
  }, [state.currentOperation]);

  const onGenerationComplete = useCallback((toastId: string, artifact: Artifact) => {
    setState(prev => ({
      ...prev,
      activeArtifact: artifact,
      bboxHighlights: artifact.groundingMetadata?.chunks
        ?.filter(c => c.bbox)
        .map(c => c.bbox!) || [],
      generationStatus: 'success',
      currentOperation: null,
      progress: 100,
      statusMessage: 'Complete!',
    }));

    toast.dismiss(toastId);
    
    toast.custom(
      (t) => (
        <div
          className={cn(
            'bg-background border border-border rounded-xl shadow-lg p-4 transition-all',
            t.visible ? 'animate-enter' : 'animate-leave'
          )}
        >
          <SuccessToast 
            label={artifact.type.replace(/_/g, ' ')} 
          />
        </div>
      ),
      { duration: 5000, position: 'bottom-right' }
    );

    // Reset to idle after showing success
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        generationStatus: 'idle',
      }));
    }, 2000);
  }, []);

  const onGenerationError = useCallback((
    toastId: string, 
    error: Error | string, 
    onRetry?: () => void
  ) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    setState(prev => ({
      ...prev,
      generationStatus: 'error',
      currentOperation: null,
      progress: 0,
      statusMessage: errorMessage,
    }));

    toast.dismiss(toastId);
    
    const errorToastId = toast.custom(
      (t) => (
        <div
          className={cn(
            'bg-background border border-border rounded-xl shadow-lg p-4 transition-all',
            t.visible ? 'animate-enter' : 'animate-leave'
          )}
        >
          <ErrorToast 
            message={errorMessage} 
            onRetry={onRetry}
            onDismiss={() => toast.dismiss(errorToastId)}
          />
        </div>
      ),
      { duration: 10000, position: 'bottom-right' }
    );
  }, []);

  const setActiveArtifact = useCallback((artifact: Artifact | null) => {
    setState(prev => ({
      ...prev,
      activeArtifact: artifact,
      bboxHighlights: artifact?.groundingMetadata?.chunks
        ?.filter(c => c.bbox)
        .map(c => c.bbox!) || [],
    }));
  }, []);

  const addBboxHighlight = useCallback((highlight: BboxHighlight) => {
    setState(prev => ({
      ...prev,
      bboxHighlights: [...prev.bboxHighlights, highlight],
    }));
  }, []);

  const clearBboxHighlights = useCallback(() => {
    setState(prev => ({
      ...prev,
      bboxHighlights: [],
    }));
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    toast.dismiss(toastId);
  }, []);

  const value: StudioStateContextValue = {
    ...state,
    startGeneration,
    updateProgress,
    onGenerationComplete,
    onGenerationError,
    setActiveArtifact,
    addBboxHighlight,
    clearBboxHighlights,
    dismissToast,
  };

  return (
    <StudioStateContext.Provider value={value}>
      {children}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          className: '',
          style: {
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
          },
        }}
      />
    </StudioStateContext.Provider>
  );
}

export function useStudioState(): StudioStateContextValue {
  const context = useContext(StudioStateContext);
  if (!context) {
    throw new Error('useStudioState must be used within a StudioStateProvider');
  }
  return context;
}

export default StudioStateContext;
