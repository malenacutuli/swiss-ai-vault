import React from 'react';
import { Briefcase, Sparkles, GraduationCap, Minus, BookOpen, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StylePreset, stylePresets } from '@/lib/stylePresets';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StyleSelectorProps {
  selected: StylePreset;
  onChange: (style: StylePreset) => void;
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  Briefcase,
  Sparkles,
  GraduationCap,
  Minus,
  BookOpen,
};

export function StyleSelector({ selected, onChange, className }: StyleSelectorProps) {
  const styles = Object.entries(stylePresets).map(([id, config]) => ({
    id: id as StylePreset,
    ...config,
    IconComponent: iconMap[config.icon] || Briefcase,
  }));

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex gap-2', className)}>
        {styles.map((style) => {
          const Icon = style.IconComponent;
          const isSelected = selected === style.id;
          
          return (
            <Tooltip key={style.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onChange(style.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all duration-200 min-w-[64px]',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-transparent hover:border-muted-foreground/20 hover:bg-muted/50'
                  )}
                >
                  {/* Gradient preview swatch */}
                  <div className={cn('w-full h-2 rounded-sm', style.preview)} />
                  
                  {/* Icon */}
                  <Icon 
                    className={cn(
                      'w-5 h-5 transition-colors',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )} 
                  />
                  
                  {/* Abbreviated name (first word) */}
                  <span className={cn(
                    'text-[10px] font-medium truncate max-w-[56px]',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {style.name.split(' ')[0]}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="font-medium">{style.name}</p>
                <p className="text-xs text-muted-foreground">{style.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
