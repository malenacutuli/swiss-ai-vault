/**
 * SwissBrAIn Error Recovery Component
 * Guides users to refine prompts or adjust inputs when generation fails
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  AlertCircle, ChevronDown, ChevronUp, 
  RefreshCw, FileEdit, Plus, HeadphonesIcon,
  Sparkles, ThumbsUp, ThumbsDown, Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export type ErrorType = 
  | 'timeout'
  | 'context_limit'
  | 'rate_limit'
  | 'parsing_error'
  | 'insufficient_sources'
  | 'model_unavailable'
  | 'unknown';

interface RecoveryPath {
  title: string;
  description: string;
  action: string;
  actionType: 'retry' | 'simplify' | 'change_format' | 'add_sources' | 'contact_support';
  icon: React.ComponentType<{ className?: string }>;
}

const recoveryPaths: Record<ErrorType, RecoveryPath> = {
  timeout: {
    title: 'Generation took too long',
    description: 'Your document is quite large. Try focusing on a specific chapter or section.',
    action: 'Retry with narrower focus',
    actionType: 'simplify',
    icon: RefreshCw,
  },
  context_limit: {
    title: 'Too much content',
    description: 'The AI reached its context limit. Try selecting fewer sources or shorter documents.',
    action: 'Reduce source count',
    actionType: 'simplify',
    icon: FileEdit,
  },
  rate_limit: {
    title: 'Too many requests',
    description: 'Please wait a moment before trying again. This usually resolves within 30 seconds.',
    action: 'Retry in 30 seconds',
    actionType: 'retry',
    icon: RefreshCw,
  },
  parsing_error: {
    title: 'Structure issue',
    description: 'The AI had trouble understanding the content structure. Try reformatting your input.',
    action: 'Use our template',
    actionType: 'change_format',
    icon: FileEdit,
  },
  insufficient_sources: {
    title: 'Need more content',
    description: 'Add more sources for the AI to analyze. We recommend at least 2-3 sources for best results.',
    action: 'Add sources',
    actionType: 'add_sources',
    icon: Plus,
  },
  model_unavailable: {
    title: 'Service temporarily unavailable',
    description: 'The AI model is being updated or experiencing high traffic. Please try again shortly.',
    action: 'Retry',
    actionType: 'retry',
    icon: RefreshCw,
  },
  unknown: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Our team has been notified.',
    action: 'Contact support',
    actionType: 'contact_support',
    icon: HeadphonesIcon,
  },
};

interface ErrorRecoveryProps {
  errorType: ErrorType;
  errorMessage?: string;
  prompt?: string;
  onRetry?: () => void;
  onSimplify?: () => void;
  onRewritePrompt?: () => void;
  onAddSources?: () => void;
  onContactSupport?: () => void;
  className?: string;
}

// Prompt critic utility
function analyzeFailedPrompt(prompt: string, errorType: ErrorType): string[] {
  const suggestions: string[] = [];

  if (!prompt) return suggestions;

  if (prompt.length < 20) {
    suggestions.push('Your prompt is quite short. Add more context about the desired outcome.');
  }

  if (prompt.length > 5000) {
    suggestions.push('Your prompt is very long. Consider breaking it into smaller, focused requests.');
  }

  if (!prompt.includes('format') && !prompt.includes('structure') && !prompt.includes('style')) {
    suggestions.push('Try specifying the output format (e.g., "as bullet points" or "with citations").');
  }

  if (errorType === 'parsing_error' && !prompt.includes('---')) {
    suggestions.push('Use delimiters like "---" to separate instructions from content.');
  }

  if (errorType === 'context_limit') {
    suggestions.push('Focus on a specific section rather than the entire document.');
    suggestions.push('Try generating one artifact type at a time instead of multiple.');
  }

  if (errorType === 'timeout') {
    suggestions.push('Break your request into smaller, incremental steps.');
    suggestions.push('Start with a summary, then request details for specific sections.');
  }

  return suggestions;
}

export function ErrorRecovery({
  errorType,
  errorMessage,
  prompt,
  onRetry,
  onSimplify,
  onRewritePrompt,
  onAddSources,
  onContactSupport,
  className,
}: ErrorRecoveryProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  
  const recovery = recoveryPaths[errorType] || recoveryPaths.unknown;
  const Icon = recovery.icon;
  const suggestions = prompt ? analyzeFailedPrompt(prompt, errorType) : [];

  const handleAction = () => {
    switch (recovery.actionType) {
      case 'retry':
        onRetry?.();
        break;
      case 'simplify':
        onSimplify?.();
        break;
      case 'change_format':
        onRewritePrompt?.();
        break;
      case 'add_sources':
        onAddSources?.();
        break;
      case 'contact_support':
        onContactSupport?.();
        break;
    }
  };

  return (
    <div className={cn('bg-red-50 border border-red-200 rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{recovery.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{recovery.description}</p>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Suggestions</span>
          </div>
          <ul className="space-y-1">
            {suggestions.map((suggestion, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Technical details (collapsible) */}
      {errorMessage && (
        <Collapsible open={showDetails} onOpenChange={setShowDetails} className="mb-4">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Technical details
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="bg-muted rounded-lg p-3 text-xs text-muted-foreground overflow-auto max-h-32">
              {errorMessage}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Recovery Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleAction}
          className="bg-[#1D4E5F] hover:bg-[#2a6577] text-white"
        >
          <Icon className="w-4 h-4 mr-2" />
          {recovery.action}
        </Button>
        
        {onRewritePrompt && recovery.actionType !== 'change_format' && (
          <Button
            variant="outline"
            onClick={onRewritePrompt}
            className="border-[#1D4E5F] text-[#1D4E5F] hover:bg-[#1D4E5F]/5"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Rewrite for me
          </Button>
        )}
      </div>

      {/* Feedback */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-red-200">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFeedback('helpful')}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              feedback === 'helpful' 
                ? 'bg-green-100 text-green-600' 
                : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFeedback('not_helpful')}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              feedback === 'not_helpful' 
                ? 'bg-red-100 text-red-600' 
                : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to classify error messages into error types
export function classifyError(error: Error | string): ErrorType {
  const message = typeof error === 'string' ? error.toLowerCase() : error.message.toLowerCase();
  
  if (message.includes('timeout') || message.includes('timed out') || message.includes('took too long')) {
    return 'timeout';
  }
  if (message.includes('context') || message.includes('token limit') || message.includes('too long')) {
    return 'context_limit';
  }
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
    return 'rate_limit';
  }
  if (message.includes('parse') || message.includes('format') || message.includes('invalid json')) {
    return 'parsing_error';
  }
  if (message.includes('no sources') || message.includes('insufficient') || message.includes('need more')) {
    return 'insufficient_sources';
  }
  if (message.includes('unavailable') || message.includes('503') || message.includes('model not found')) {
    return 'model_unavailable';
  }
  
  return 'unknown';
}

export default ErrorRecovery;
