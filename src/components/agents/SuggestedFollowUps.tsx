import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FollowUpSuggestion {
  id: string;
  prompt: string;
  description?: string;
  type: 'refine' | 'extend' | 'explore' | 'export';
}

interface SuggestedFollowUpsProps {
  taskPrompt: string;
  taskResult?: string | null;
  taskType?: string | null;
  onSelectFollowUp: (prompt: string) => void;
  className?: string;
}

// Generate intelligent follow-up suggestions based on task context
const generateFollowUps = (
  prompt: string,
  result?: string | null,
  taskType?: string | null
): FollowUpSuggestion[] => {
  const suggestions: FollowUpSuggestion[] = [];
  const promptLower = prompt.toLowerCase();

  // Research-related follow-ups
  if (promptLower.includes('research') || promptLower.includes('analyze') || taskType === 'research') {
    suggestions.push({
      id: 'deep-dive',
      prompt: `Dive deeper into the most important finding from: "${prompt.slice(0, 50)}..."`,
      description: 'Explore key insights in more detail',
      type: 'explore',
    });
    suggestions.push({
      id: 'create-presentation',
      prompt: `Create a presentation summarizing the key findings from my research`,
      description: 'Turn insights into slides',
      type: 'export',
    });
  }

  // Report/document follow-ups
  if (promptLower.includes('report') || promptLower.includes('document') || taskType === 'document') {
    suggestions.push({
      id: 'executive-summary',
      prompt: `Create an executive summary of this report for senior leadership`,
      description: 'Concise overview for stakeholders',
      type: 'refine',
    });
    suggestions.push({
      id: 'translate',
      prompt: `Translate this document to French while maintaining professional tone`,
      description: 'Localize for other markets',
      type: 'extend',
    });
  }

  // Presentation follow-ups
  if (promptLower.includes('slide') || promptLower.includes('presentation') || promptLower.includes('pitch') || taskType === 'slides') {
    suggestions.push({
      id: 'speaker-notes',
      prompt: `Add detailed speaker notes to each slide of this presentation`,
      description: 'Prepare for your delivery',
      type: 'extend',
    });
    suggestions.push({
      id: 'handout',
      prompt: `Create a one-page handout summarizing the key points from this presentation`,
      description: 'Leave-behind for audience',
      type: 'export',
    });
  }

  // Data analysis follow-ups
  if (promptLower.includes('data') || promptLower.includes('chart') || promptLower.includes('visualization') || taskType === 'visualization') {
    suggestions.push({
      id: 'additional-charts',
      prompt: `Create additional visualizations focusing on trends and outliers in this data`,
      description: 'Uncover hidden patterns',
      type: 'explore',
    });
    suggestions.push({
      id: 'export-report',
      prompt: `Generate a formal data analysis report with methodology and conclusions`,
      description: 'Document your findings',
      type: 'export',
    });
  }

  // Website/app follow-ups
  if (promptLower.includes('website') || promptLower.includes('web') || promptLower.includes('app') || taskType === 'website') {
    suggestions.push({
      id: 'mobile-optimize',
      prompt: `Optimize this design for mobile devices`,
      description: 'Ensure great mobile experience',
      type: 'refine',
    });
    suggestions.push({
      id: 'add-features',
      prompt: `Add a contact form and newsletter signup to this website`,
      description: 'Expand functionality',
      type: 'extend',
    });
  }

  // General fallback suggestions
  if (suggestions.length < 3) {
    suggestions.push({
      id: 'improve',
      prompt: `Improve and expand upon: "${prompt.slice(0, 60)}..."`,
      description: 'Enhance the output quality',
      type: 'refine',
    });
    suggestions.push({
      id: 'simplify',
      prompt: `Create a simplified version suitable for a general audience`,
      description: 'Make it more accessible',
      type: 'refine',
    });
    suggestions.push({
      id: 'export-pdf',
      prompt: `Format this as a professional PDF document ready for sharing`,
      description: 'Export for distribution',
      type: 'export',
    });
  }

  // Return top 4 suggestions
  return suggestions.slice(0, 4);
};

const typeIcons: Record<string, string> = {
  refine: 'Refine',
  extend: 'Extend',
  explore: 'Explore',
  export: 'Export',
};

const typeColors: Record<string, string> = {
  refine: 'bg-blue-500/10 text-blue-600',
  extend: 'bg-emerald-500/10 text-emerald-600',
  explore: 'bg-purple-500/10 text-purple-600',
  export: 'bg-orange-500/10 text-orange-600',
};

export function SuggestedFollowUps({
  taskPrompt,
  taskResult,
  taskType,
  onSelectFollowUp,
  className,
}: SuggestedFollowUpsProps) {
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    const generated = generateFollowUps(taskPrompt, taskResult, taskType);
    setSuggestions(generated);
  }, [taskPrompt, taskResult, taskType]);

  const handleRegenerate = () => {
    setIsRegenerating(true);
    // Simulate regeneration with slight randomization
    setTimeout(() => {
      const generated = generateFollowUps(taskPrompt, taskResult, taskType);
      // Shuffle to give appearance of new suggestions
      setSuggestions(generated.sort(() => Math.random() - 0.5));
      setIsRegenerating(false);
    }, 500);
  };

  if (suggestions.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="font-medium">Suggested next steps</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {isRegenerating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSelectFollowUp(suggestion.prompt)}
            className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded',
                  typeColors[suggestion.type]
                )}>
                  {typeIcons[suggestion.type]}
                </span>
              </div>
              <p className="text-sm text-foreground line-clamp-2">
                {suggestion.description || suggestion.prompt.slice(0, 60) + '...'}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default SuggestedFollowUps;
