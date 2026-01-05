import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { ExecutionTask } from '@/hooks/useAgentExecution';

interface SuggestedFollowupsProps {
  task: ExecutionTask;
  onSelect?: (suggestion: string) => void;
  className?: string;
}

// Generate contextual follow-up suggestions based on task
function generateFollowups(task: ExecutionTask): string[] {
  const prompt = task.prompt.toLowerCase();
  const suggestions: string[] = [];
  
  // Document-related follow-ups
  if (prompt.includes('report') || prompt.includes('document') || prompt.includes('analysis')) {
    suggestions.push('Create an executive summary of this report');
    suggestions.push('Generate a presentation from this analysis');
    suggestions.push('Translate this document to another language');
  }
  
  // Presentation-related follow-ups
  if (prompt.includes('presentation') || prompt.includes('slides') || prompt.includes('pptx')) {
    suggestions.push('Add speaker notes to each slide');
    suggestions.push('Create a handout version of this presentation');
    suggestions.push('Generate an executive summary');
  }
  
  // Research-related follow-ups
  if (prompt.includes('research') || prompt.includes('find') || prompt.includes('search')) {
    suggestions.push('Dive deeper into the key findings');
    suggestions.push('Create a comparison table of alternatives');
    suggestions.push('Summarize the main insights');
  }
  
  // Image-related follow-ups
  if (prompt.includes('image') || prompt.includes('design') || prompt.includes('visual')) {
    suggestions.push('Create variations of this design');
    suggestions.push('Adjust the color scheme');
    suggestions.push('Generate additional sizes for social media');
  }
  
  // Data-related follow-ups
  if (prompt.includes('data') || prompt.includes('spreadsheet') || prompt.includes('excel')) {
    suggestions.push('Create charts to visualize this data');
    suggestions.push('Add statistical analysis');
    suggestions.push('Generate a summary report');
  }
  
  // Generic fallbacks
  if (suggestions.length === 0) {
    suggestions.push('Refine and improve this output');
    suggestions.push('Create a summary version');
    suggestions.push('Export in a different format');
  }
  
  // Return first 3 suggestions
  return suggestions.slice(0, 3);
}

export function SuggestedFollowups({ task, onSelect, className }: SuggestedFollowupsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  useEffect(() => {
    // Only generate suggestions for completed tasks
    if (task.status === 'completed') {
      setSuggestions(generateFollowups(task));
    }
  }, [task]);
  
  if (suggestions.length === 0) return null;
  
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-muted-foreground">Suggested follow-ups</p>
      <div className="space-y-1.5">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => onSelect?.(suggestion)}
            className={cn(
              'w-full text-left px-3 py-2 text-sm rounded-lg',
              'border border-border bg-background',
              'hover:bg-muted/50 hover:border-primary/20 transition-all duration-200',
              'group flex items-center justify-between'
            )}
          >
            <span className="text-foreground/90">{suggestion}</span>
            <span className="text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
