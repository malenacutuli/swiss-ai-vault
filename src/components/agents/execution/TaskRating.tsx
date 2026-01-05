import { useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TaskRatingProps {
  taskId: string;
  className?: string;
}

export function TaskRating({ taskId, className }: TaskRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  
  const handleRate = async (value: number) => {
    if (submitted) return;
    
    setRating(value);
    setSubmitted(true);
    
    try {
      // Note: This requires a user_rating column in agent_tasks
      // For now we'll just show the UI feedback
      // await supabase.from('agent_tasks').update({ user_rating: value }).eq('id', taskId);
      
      // Log to console for debugging
      console.log('[TaskRating] User rated task:', taskId, 'with rating:', value);
    } catch (err) {
      console.error('[TaskRating] Failed to save rating:', err);
    }
  };
  
  const displayRating = hoveredRating ?? rating;
  
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-xs text-muted-foreground">Rate this result</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => !submitted && setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(null)}
            disabled={submitted}
            className={cn(
              'text-lg transition-all duration-150 p-0.5',
              'hover:scale-110 active:scale-95',
              displayRating && star <= displayRating
                ? 'text-amber-400'
                : 'text-muted-foreground/30',
              submitted && 'cursor-default'
            )}
            aria-label={`Rate ${star} stars`}
          >
            ★
          </button>
        ))}
      </div>
      {submitted && (
        <span className="text-xs text-muted-foreground animate-fade-in">
          Thanks!
        </span>
      )}
    </div>
  );
}
