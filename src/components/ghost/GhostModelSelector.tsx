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
import { Zap, Scale, Brain, Clock, Cpu, Code, Sparkles } from 'lucide-react';

interface GhostModel {
  id: string;
  name: string;
  icon: React.ReactNode;
  params: string;
  context: string;
  credits: number;
  status: 'ready' | 'cold' | 'coming';
  description: string;
  disabled?: boolean;
}

interface GhostModelCategory {
  label: string;
  icon: React.ReactNode;
  description: string;
  models: GhostModel[];
}

export const GHOST_MODELS: Record<string, GhostModelCategory> = {
  fast: {
    label: 'Fast',
    icon: <Zap className="w-3.5 h-3.5" />,
    description: 'Quick responses',
    models: [
      { id: 'qwen2.5-3b', name: 'Qwen 2.5 3B', icon: <Zap className="w-4 h-4" />, params: '3B', context: '32K', credits: 1, status: 'ready', description: 'Fast general-purpose chat' },
      { id: 'llama3.2-1b', name: 'Llama 3.2 1B', icon: <Cpu className="w-4 h-4" />, params: '1B', context: '128K', credits: 0.5, status: 'ready', description: 'Ultra-fast, basic tasks' },
      { id: 'llama3.2-3b', name: 'Llama 3.2 3B', icon: <Cpu className="w-4 h-4" />, params: '3B', context: '128K', credits: 1, status: 'ready', description: 'Fast with better reasoning' },
    ],
  },
  balanced: {
    label: 'Balanced',
    icon: <Scale className="w-3.5 h-3.5" />,
    description: 'Quality & speed',
    models: [
      { id: 'mistral-7b', name: 'Mistral 7B', icon: <Sparkles className="w-4 h-4" />, params: '7B', context: '32K', credits: 2, status: 'cold', description: 'Excellent all-rounder' },
      { id: 'qwen2.5-7b', name: 'Qwen 2.5 7B', icon: <Zap className="w-4 h-4" />, params: '7B', context: '128K', credits: 2, status: 'cold', description: 'Strong multilingual support' },
      { id: 'llama3.1-8b', name: 'Llama 3.1 8B', icon: <Cpu className="w-4 h-4" />, params: '8B', context: '128K', credits: 3, status: 'cold', description: 'Latest Llama, great reasoning' },
    ],
  },
  quality: {
    label: 'Quality',
    icon: <Brain className="w-3.5 h-3.5" />,
    description: 'Complex tasks',
    models: [
      { id: 'qwen2.5-coder-7b', name: 'Qwen Coder 7B', icon: <Code className="w-4 h-4" />, params: '7B', context: '128K', credits: 2, status: 'cold', description: 'Optimized for code generation' },
      { id: 'deepseek-coder-7b', name: 'DeepSeek Coder', icon: <Code className="w-4 h-4" />, params: '7B', context: '16K', credits: 2, status: 'cold', description: 'Advanced code understanding' },
    ],
  },
  comingSoon: {
    label: 'Coming Soon',
    icon: <Clock className="w-3.5 h-3.5" />,
    description: 'GPU upgrade required',
    models: [
      { id: 'llama4-scout', name: 'Llama 4 Scout', icon: <Cpu className="w-4 h-4" />, params: '17B (MoE)', context: '10M', credits: 5, status: 'coming', disabled: true, description: '10 million token context' },
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
    ready: { color: 'bg-success', label: 'Ready', textColor: 'text-success' },
    cold: { color: 'bg-warning', label: '~30s', textColor: 'text-warning' },
    coming: { color: 'bg-muted-foreground', label: 'Coming', textColor: 'text-muted-foreground' },
  };

  const { color, label, textColor } = config[status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block w-2 h-2 rounded-full', color)} />
            {showLabel && <span className={cn('text-[10px] tracking-wide', textColor)}>{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-xs">
          {status === 'ready' && 'Model is warm and ready'}
          {status === 'cold' && 'Cold start: approximately 30 seconds'}
          {status === 'coming' && 'Coming soon — requires GPU upgrade'}
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
      <SelectTrigger className="w-64 bg-background border-border text-foreground hover:border-primary/50 hover:bg-muted/50 transition-all duration-200">
        <SelectValue>
          {selectedModel && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{selectedModel.icon}</span>
              <span className="truncate font-medium">{selectedModel.name}</span>
              <StatusIndicator status={selectedModel.status} />
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border min-w-[340px] max-h-[420px]">
        {CATEGORY_ORDER.map(categoryKey => {
          const category = GHOST_MODELS[categoryKey];
          return (
            <SelectGroup key={categoryKey}>
              <SelectLabel className="text-muted-foreground font-medium px-4 py-3 text-xs flex items-center justify-between tracking-caps uppercase">
                <span className="flex items-center gap-2">
                  {category.icon}
                  {category.label}
                </span>
                <span className="text-[10px] font-normal normal-case tracking-normal">
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
                            'text-foreground cursor-pointer py-3 px-4 focus:bg-muted focus:text-foreground',
                            model.disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <span className="text-muted-foreground">{model.icon}</span>
                            <span className="flex-1 font-medium">{model.name}</span>
                            <Badge 
                              variant="outline" 
                              className="text-[10px] border-border text-muted-foreground px-2 py-0"
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
                      className="bg-popover border-border text-popover-foreground p-4 max-w-[260px]"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{model.icon}</span>
                          <span className="font-serif font-semibold text-foreground">{model.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{model.description}</p>
                        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-border">
                          <div>
                            <span className="text-muted-foreground uppercase tracking-caps text-[10px]">Parameters</span>
                            <p className="text-foreground mt-0.5">{model.params}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground uppercase tracking-caps text-[10px]">Context</span>
                            <p className="text-foreground mt-0.5">{model.context}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground uppercase tracking-caps text-[10px]">Credits per 1K tokens</span>
                            <p className="text-swiss-sapphire font-medium mt-0.5">{model.credits}</p>
                          </div>
                        </div>
                        {model.disabled && (
                          <div className="text-warning text-xs pt-2 border-t border-border flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            Coming soon — requires GPU upgrade
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
