import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Zap, Scale, Brain, Sparkles } from 'lucide-react';

interface GhostModel {
  id: string;
  name: string;
  params: string;
  context?: string;
  credits: number;
  status: 'ready' | 'cold' | 'optimized';
  disabled?: boolean;
}

interface GhostModelCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  models: GhostModel[];
}

export const GHOST_MODELS: Record<string, GhostModel[]> = {
  fast: [
    { id: 'qwen2.5-3b', name: 'Qwen 2.5 3B', params: '3B', context: '32K', credits: 1, status: 'ready' },
    { id: 'llama3.2-1b', name: 'Llama 3.2 1B', params: '1B', context: '128K', credits: 0.5, status: 'ready' },
    { id: 'llama3.2-3b', name: 'Llama 3.2 3B', params: '3B', context: '128K', credits: 1, status: 'ready' },
  ],
  balanced: [
    { id: 'mistral-7b', name: 'Mistral 7B', params: '7B', context: '32K', credits: 2, status: 'cold' },
    { id: 'qwen2.5-7b', name: 'Qwen 2.5 7B', params: '7B', context: '128K', credits: 2, status: 'cold' },
    { id: 'llama3.1-8b', name: 'Llama 3.1 8B', params: '8B', context: '128K', credits: 3, status: 'cold' },
  ],
  quality: [
    { id: 'qwen2.5-coder-7b', name: 'Qwen Coder 7B', params: '7B', context: '128K', credits: 2, status: 'optimized' },
    { id: 'deepseek-coder-7b', name: 'DeepSeek Coder', params: '7B', context: '16K', credits: 2, status: 'cold' },
  ],
  comingSoon: [
    { id: 'llama4-scout', name: 'Llama 4 Scout', params: '17B', context: '10M', credits: 5, status: 'cold', disabled: true },
  ],
};

const CATEGORIES: GhostModelCategory[] = [
  { id: 'fast', label: '⚡ Fast', icon: Zap, models: GHOST_MODELS.fast },
  { id: 'balanced', label: '⚖️ Balanced', icon: Scale, models: GHOST_MODELS.balanced },
  { id: 'quality', label: '🧠 Quality', icon: Brain, models: GHOST_MODELS.quality },
  { id: 'comingSoon', label: '🔮 Coming Soon', icon: Sparkles, models: GHOST_MODELS.comingSoon },
];

// Flatten for lookup
const ALL_MODELS = Object.values(GHOST_MODELS).flat();

interface StatusIndicatorProps {
  status: GhostModel['status'];
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = {
    ready: { color: 'bg-green-500', label: 'Ready' },
    cold: { color: 'bg-yellow-500', label: 'Cold Start ~30s' },
    optimized: { color: 'bg-blue-500', label: 'Optimized' },
  };

  const { color, label } = config[status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-block w-2 h-2 rounded-full', color)} />
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-slate-800 border-purple-500/30 text-white text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface GhostModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function GhostModelSelector({ value, onValueChange, disabled }: GhostModelSelectorProps) {
  const selectedModel = ALL_MODELS.find(m => m.id === value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-56 bg-slate-800/50 border-purple-500/30 text-white hover:border-purple-500/50 transition-colors">
        <SelectValue>
          {selectedModel && (
            <div className="flex items-center gap-2">
              <StatusIndicator status={selectedModel.status} />
              <span className="truncate">{selectedModel.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-purple-500/30 min-w-[280px]">
        {CATEGORIES.map(category => (
          <SelectGroup key={category.id}>
            <SelectLabel className="text-purple-400 font-semibold px-2 py-1.5">
              {category.label}
            </SelectLabel>
            {category.models.map(model => (
              <TooltipProvider key={model.id} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <SelectItem
                        value={model.id}
                        disabled={model.disabled}
                        className={cn(
                          'text-white cursor-pointer',
                          model.disabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <StatusIndicator status={model.status} />
                          <span className="flex-1">{model.name}</span>
                          <Badge 
                            variant="outline" 
                            className="text-[10px] border-purple-500/30 text-purple-300 ml-auto"
                          >
                            {model.params}
                          </Badge>
                        </div>
                      </SelectItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="right" 
                    className="bg-slate-800 border-purple-500/30 text-white p-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold text-purple-300">{model.name}</div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Parameters:</span>
                        <span>{model.params}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Context:</span>
                        <span>{model.context || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Credits/1K:</span>
                        <span className="text-purple-400">{model.credits}</span>
                      </div>
                      {model.disabled && (
                        <div className="text-yellow-400 mt-1">Coming soon!</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

// Export default model ID for initial state
export const DEFAULT_GHOST_MODEL = 'qwen2.5-3b';
