import React from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MemoryToggleProps {
  enabled: boolean;
  onToggle: () => void;
  memoryCount?: number;
  isSearching?: boolean;
  disabled?: boolean;
  className?: string;
}

export const MemoryToggle: React.FC<MemoryToggleProps> = ({
  enabled,
  onToggle,
  memoryCount = 0,
  isSearching = false,
  disabled = false,
  className,
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn(
              "relative h-9 w-9 transition-colors",
              enabled 
                ? "text-primary bg-primary/10 hover:bg-primary/20" 
                : "text-muted-foreground hover:text-foreground",
              disabled && "opacity-50",
              className
            )}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            {enabled && memoryCount > 0 && !isSearching && (
              <Badge 
                variant="secondary" 
                className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground"
              >
                {memoryCount > 9 ? '9+' : memoryCount}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">
            {enabled ? 'Personal Memory Active' : 'Activate Personal Memory'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {disabled 
              ? 'Unlock your vault to enable memory'
              : enabled 
                ? 'AI will reference your uploaded documents and notes' 
                : 'Click to enable context from your personal knowledge base'
            }
          </p>
          {enabled && memoryCount > 0 && (
            <p className="text-xs text-primary mt-1">
              {memoryCount} relevant {memoryCount === 1 ? 'memory' : 'memories'} found
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
