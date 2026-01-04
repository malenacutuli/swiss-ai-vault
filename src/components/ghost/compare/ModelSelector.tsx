import { useState } from 'react';
import { Check, Zap, Crown, Star, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AVAILABLE_MODELS, MODEL_PRESETS, type ModelOption } from '@/hooks/useCompareMode';

interface ModelSelectorProps {
  selectedModels: string[];
  onToggleModel: (modelId: string) => void;
  onApplyPreset: (preset: keyof typeof MODEL_PRESETS) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModels,
  onToggleModel,
  onApplyPreset,
  disabled,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedModelNames = AVAILABLE_MODELS
    .filter(m => selectedModels.includes(m.id))
    .map(m => m.name);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          <Crown className="h-4 w-4" />
          <span className="hidden sm:inline">
            {selectedModels.length} models
          </span>
          <Badge variant="secondary" className="ml-1">
            {selectedModels.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        {/* Header */}
        <div className="mb-4">
          <h4 className="font-medium text-foreground">
            Select Models
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Choose 2-4 models to compare
          </p>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset('frontier')}
            className="h-7 text-xs"
          >
            <Crown className="h-3 w-3 mr-1" />
            Frontier
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset('fast')}
            className="h-7 text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            Fast
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset('code')}
            className="h-7 text-xs"
          >
            <Code2 className="h-3 w-3 mr-1" />
            Code
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset('free')}
            className="h-7 text-xs"
          >
            <Star className="h-3 w-3 mr-1" />
            Free
          </Button>
        </div>

        {/* Model Grid */}
        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {AVAILABLE_MODELS.map((model) => {
            const isSelected = selectedModels.includes(model.id);
            return (
              <button
                key={model.id}
                onClick={() => onToggleModel(model.id)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {model.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {model.provider}
                  </div>
                </div>
                {model.tier === 'pro' && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    Pro
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Selection Summary */}
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground truncate">
            Selected: {selectedModelNames.join(', ')}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
