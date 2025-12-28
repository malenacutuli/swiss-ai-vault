import { useState, useEffect, useMemo } from 'react';
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
import { Zap, Scale, Brain, Clock, Cpu, Code, Sparkles, Lock, Eye, Shield, Globe } from 'lucide-react';
import { TEXT_MODELS, type GhostModel, getModelsByModality } from '@/lib/ghost-models';

// LocalStorage key
const STORAGE_KEY = 'ghost-selected-model';

// Map tags to icons
function getTagIcon(tag: string) {
  switch (tag) {
    case 'private':
    case 'swiss':
      return <Lock className="w-3 h-3" />;
    case 'vision':
      return <Eye className="w-3 h-3" />;
    case 'reasoning':
      return <Brain className="w-3 h-3" />;
    case 'code':
      return <Code className="w-3 h-3" />;
    case 'fast':
      return <Zap className="w-3 h-3" />;
    case 'flagship':
      return <Sparkles className="w-3 h-3" />;
    default:
      return null;
  }
}

// Provider display configuration
const PROVIDER_CONFIG: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  'SwissVault': { label: 'SwissVault 🇨🇭', icon: <Shield className="w-3.5 h-3.5" />, description: 'Private & Swiss-hosted' },
  'Open Source': { label: 'Open Source 🇨🇭', icon: <Globe className="w-3.5 h-3.5" />, description: 'Swiss-hosted open models' },
  'OpenAI': { label: 'OpenAI', icon: <Sparkles className="w-3.5 h-3.5" />, description: 'GPT models' },
  'Anthropic': { label: 'Anthropic', icon: <Brain className="w-3.5 h-3.5" />, description: 'Claude models' },
  'Google': { label: 'Google', icon: <Globe className="w-3.5 h-3.5" />, description: 'Gemini models' },
  'xAI': { label: 'xAI (Grok)', icon: <Zap className="w-3.5 h-3.5" />, description: 'Grok models' },
  'DeepSeek': { label: 'DeepSeek', icon: <Code className="w-3.5 h-3.5" />, description: 'Affordable & capable' },
};

// Provider ordering
const PROVIDER_ORDER = ['SwissVault', 'Open Source', 'OpenAI', 'Anthropic', 'Google', 'xAI', 'DeepSeek'];

interface StatusIndicatorProps {
  model: GhostModel;
  showLabel?: boolean;
}

function StatusIndicator({ model, showLabel = false }: StatusIndicatorProps) {
  const status = model.comingSoon ? 'coming' : model.enabled ? 'ready' : 'cold';
  
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
          {status === 'ready' && 'Model is available'}
          {status === 'cold' && 'Cold start: approximately 30 seconds'}
          {status === 'coming' && 'Coming soon'}
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
  // Get all enabled text models from central catalog
  const models = useMemo(() => getModelsByModality('text', true), []);
  
  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, GhostModel[]> = {};
    models.forEach(model => {
      if (!groups[model.provider]) {
        groups[model.provider] = [];
      }
      groups[model.provider].push(model);
    });
    return groups;
  }, [models]);
  
  const selectedModel = models.find(m => m.id === value);

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
              <span className="text-muted-foreground">
                {selectedModel.tags.includes('private') ? <Lock className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </span>
              <span className="truncate font-medium">{selectedModel.name}</span>
              <StatusIndicator model={selectedModel} />
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border min-w-[340px] max-h-[420px]">
        {PROVIDER_ORDER.map(providerKey => {
          const providerModels = groupedModels[providerKey];
          if (!providerModels || providerModels.length === 0) return null;
          
          const config = PROVIDER_CONFIG[providerKey] || { label: providerKey, icon: <Sparkles className="w-3.5 h-3.5" />, description: '' };
          
          return (
            <SelectGroup key={providerKey}>
              <SelectLabel className="text-muted-foreground font-medium px-4 py-3 text-xs flex items-center justify-between tracking-caps uppercase">
                <span className="flex items-center gap-2">
                  {config.icon}
                  {config.label}
                </span>
                <span className="text-[10px] font-normal normal-case tracking-normal">
                  {config.description}
                </span>
              </SelectLabel>
              {providerModels.map(model => (
                <TooltipProvider key={model.id} delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <SelectItem
                          value={model.id}
                          disabled={model.comingSoon}
                          className={cn(
                            'text-foreground cursor-pointer py-3 px-4 focus:bg-muted focus:text-foreground',
                            model.comingSoon && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <span className="text-muted-foreground">
                              {getTagIcon(model.tags[0]) || <Sparkles className="w-4 h-4" />}
                            </span>
                            <span className="flex-1 font-medium">{model.name}</span>
                            <Badge 
                              variant="outline" 
                              className="text-[10px] border-border text-muted-foreground px-2 py-0"
                            >
                              {model.creditCost} cr
                            </Badge>
                            <StatusIndicator model={model} showLabel />
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
                          <span className="text-muted-foreground">
                            {getTagIcon(model.tags[0]) || <Sparkles className="w-4 h-4" />}
                          </span>
                          <span className="font-serif font-semibold text-foreground">{model.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{model.description}</p>
                        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-border">
                          {model.contextWindow && (
                            <div>
                              <span className="text-muted-foreground uppercase tracking-caps text-[10px]">Context</span>
                              <p className="text-foreground mt-0.5">{(model.contextWindow / 1000).toFixed(0)}K</p>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground uppercase tracking-caps text-[10px]">Credits</span>
                            <p className="text-swiss-sapphire font-medium mt-0.5">{model.creditCost}</p>
                          </div>
                        </div>
                        {model.comingSoon && (
                          <div className="text-warning text-xs pt-2 border-t border-border flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            Coming soon
                          </div>
                        )}
                        {model.requiresPro && (
                          <div className="text-primary text-xs flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5" />
                            Requires Pro
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
export const DEFAULT_GHOST_MODEL = 'swissvault-1.0';

// Helper to get saved model from localStorage
export function getSavedGhostModel(): string {
  if (typeof window === 'undefined') return DEFAULT_GHOST_MODEL;
  const saved = localStorage.getItem(STORAGE_KEY);
  const models = getModelsByModality('text', true);
  if (saved && models.some(m => m.id === saved && !m.comingSoon)) {
    return saved;
  }
  return DEFAULT_GHOST_MODEL;
}