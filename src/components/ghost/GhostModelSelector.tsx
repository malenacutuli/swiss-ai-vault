import { useState, useEffect } from 'react';
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

interface GhostModel {
  id: string;
  name: string;
  icon: string;
  params: string;
  context: string;
  credits: number;
  status: 'ready' | 'cold' | 'coming';
  description: string;
  disabled?: boolean;
}

interface GhostModelCategory {
  label: string;
  description: string;
  models: GhostModel[];
}

export const GHOST_MODELS: Record<string, GhostModelCategory> = {
  fast: {
    label: '⚡ Fast',
    description: 'Quick responses, smaller models',
    models: [
      { id: 'qwen2.5-3b', name: 'Qwen 2.5 3B', icon: '⚡', params: '3B', context: '32K', credits: 1, status: 'ready', description: 'Fast general-purpose chat' },
      { id: 'llama3.2-1b', name: 'Llama 3.2 1B', icon: '🦙', params: '1B', context: '128K', credits: 0.5, status: 'ready', description: 'Ultra-fast, basic tasks' },
      { id: 'llama3.2-3b', name: 'Llama 3.2 3B', icon: '🦙', params: '3B', context: '128K', credits: 1, status: 'ready', description: 'Fast with better reasoning' },
    ],
  },
  balanced: {
    label: '⚖️ Balanced',
    description: 'Best quality/speed tradeoff',
    models: [
      { id: 'mistral-7b', name: 'Mistral 7B', icon: '🌀', params: '7B', context: '32K', credits: 2, status: 'cold', description: 'Excellent all-rounder' },
      { id: 'qwen2.5-7b', name: 'Qwen 2.5 7B', icon: '⚡', params: '7B', context: '128K', credits: 2, status: 'cold', description: 'Strong multilingual support' },
      { id: 'llama3.1-8b', name: 'Llama 3.1 8B', icon: '🦙', params: '8B', context: '128K', credits: 3, status: 'cold', description: 'Latest Llama, great reasoning' },
    ],
  },
  quality: {
    label: '🧠 Quality',
    description: 'Best for complex tasks',
    models: [
      { id: 'qwen2.5-coder-7b', name: 'Qwen Coder 7B', icon: '💻', params: '7B', context: '128K', credits: 2, status: 'cold', description: 'Optimized for code generation' },
      { id: 'deepseek-coder-7b', name: 'DeepSeek Coder', icon: '🔍', params: '7B', context: '16K', credits: 2, status: 'cold', description: 'Advanced code understanding' },
    ],
  },
  comingSoon: {
    label: '🔮 Coming Soon',
    description: 'Requires GPU upgrade',
    models: [
      { id: 'llama4-scout', name: 'Llama 4 Scout', icon: '🦙', params: '17B (MoE)', context: '10M', credits: 5, status: 'coming', disabled: true, description: '10 million token context!' },
    ],
  },
};

const CATEGORY_ORDER = ['fast', 'balanced', 'quality', 'comingSoon'];

// Flatten for lookup
const ALL_MODELS = Object.values(GHOST_MODELS).flatMap(cat => cat.models);

// LocalStorage key
const STORAGE_KEY = 'ghost-selected-model';

interface StatusIndicatorProps {
  status: GhostModel['status'];
  showLabel?: boolean;
}

function StatusIndicator({ status, showLabel = false }: StatusIndicatorProps) {
  const config = {
    ready: { color: 'bg-green-500', label: 'Ready', textColor: 'text-green-400' },
    cold: { color: 'bg-yellow-500', label: '~30s', textColor: 'text-yellow-400' },
    coming: { color: 'bg-gray-400', label: 'Coming Soon', textColor: 'text-gray-400' },
  };

  const { color, label, textColor } = config[status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block w-2 h-2 rounded-full', color)} />
            {showLabel && <span className={cn('text-[10px]', textColor)}>{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-slate-800 border-purple-500/30 text-white text-xs">
          {status === 'ready' && 'Model is warm and ready'}
          {status === 'cold' && 'Cold start: ~30 seconds to load'}
          {status === 'coming' && 'Coming soon - requires GPU upgrade'}
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

  // Persist to localStorage
  useEffect(() => {
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    }
  }, [value]);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-64 bg-slate-800/50 border-purple-500/30 text-white hover:border-purple-500/50 hover:bg-slate-800/70 transition-all duration-200">
        <SelectValue>
          {selectedModel && (
            <div className="flex items-center gap-2">
              <span className="text-base">{selectedModel.icon}</span>
              <span className="truncate font-medium">{selectedModel.name}</span>
              <StatusIndicator status={selectedModel.status} />
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-purple-500/30 min-w-[320px] max-h-[400px]">
        {CATEGORY_ORDER.map(categoryKey => {
          const category = GHOST_MODELS[categoryKey];
          return (
            <SelectGroup key={categoryKey}>
              <SelectLabel className="text-purple-400 font-semibold px-3 py-2 text-sm flex items-center justify-between">
                <span>{category.label}</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {category.description}
                </span>
              </SelectLabel>
              {category.models.map(model => (
                <TooltipProvider key={model.id} delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <SelectItem
                          value={model.id}
                          disabled={model.disabled}
                          className={cn(
                            'text-white cursor-pointer py-2.5 px-3 focus:bg-purple-500/20 focus:text-white',
                            model.disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <span className="text-lg w-6 text-center">{model.icon}</span>
                            <span className="flex-1 font-medium">{model.name}</span>
                            <Badge 
                              variant="outline" 
                              className="text-[10px] border-purple-500/30 text-purple-300 px-1.5 py-0"
                            >
                              {model.params}
                            </Badge>
                            <StatusIndicator status={model.status} showLabel />
                          </div>
                        </SelectItem>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      align="start"
                      className="bg-slate-800 border-purple-500/30 text-white p-4 max-w-[250px]"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{model.icon}</span>
                          <span className="font-semibold text-purple-300">{model.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{model.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-purple-500/20">
                          <div>
                            <span className="text-muted-foreground">Parameters:</span>
                            <span className="ml-1 text-white">{model.params}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Context:</span>
                            <span className="ml-1 text-white">{model.context}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Credits/1K tokens:</span>
                            <span className="ml-1 text-purple-400 font-medium">{model.credits}</span>
                          </div>
                        </div>
                        {model.disabled && (
                          <div className="text-yellow-400 text-xs pt-1 border-t border-purple-500/20">
                            ⚠️ Coming soon - requires GPU upgrade
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Export default model ID for initial state
export const DEFAULT_GHOST_MODEL = 'qwen2.5-3b';

// Helper to get saved model from localStorage
export function getSavedGhostModel(): string {
  if (typeof window === 'undefined') return DEFAULT_GHOST_MODEL;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && ALL_MODELS.some(m => m.id === saved && !m.disabled)) {
    return saved;
  }
  return DEFAULT_GHOST_MODEL;
}
