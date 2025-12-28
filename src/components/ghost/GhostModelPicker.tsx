import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SwissBadge, getTagBadgeVariant } from '@/components/ui/swiss';
import {
  ChevronDown,
  Sparkles,
  Zap,
  Lock,
  Eye,
  Brain,
  Mic,
  Globe,
  FlaskConical,
  Check,
} from 'lucide-react';
import {
  type GhostModel,
  TEXT_MODELS,
  IMAGE_MODELS,
  VIDEO_MODELS,
  getModelsByModality,
} from '@/lib/ghost-models';

type GhostMode = 'text' | 'image' | 'video' | 'search';

interface GhostModelPickerProps {
  mode: GhostMode;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  matureFilterEnabled?: boolean;
  className?: string;
}

// Group models by provider
function groupModelsByProvider(models: GhostModel[]) {
  const groups: Record<string, GhostModel[]> = {};
  
  models.forEach(model => {
    if (!groups[model.provider]) {
      groups[model.provider] = [];
    }
    groups[model.provider].push(model);
  });
  
  return groups;
}

// Provider display names (must match provider values in ghost-models.ts exactly)
const PROVIDER_LABELS: Record<string, string> = {
  // Text model providers
  'SwissVault': 'SwissVault 🇨🇭',
  'Open Source': 'Open Source 🇨🇭',
  'OpenAI': 'OpenAI',
  'Anthropic': 'Anthropic',
  'Google': 'Google',
  'xAI': 'xAI (Grok)',
  'DeepSeek': 'DeepSeek',
  // Image model providers
  'Black Forest Labs': 'Black Forest Labs',
  'Stability AI': 'Stability AI',
  // Video model providers
  'Replicate': 'Replicate',
  'Runway': 'Runway',
  'Luma': 'Luma',
  'Pika': 'Pika',
};

// Tag icons
function TagIcon({ tag }: { tag: string }) {
  switch (tag) {
    case 'private':
      return <Lock className="w-3 h-3" />;
    case 'vision':
      return <Eye className="w-3 h-3" />;
    case 'reasoning':
      return <Brain className="w-3 h-3" />;
    case 'audio':
      return <Mic className="w-3 h-3" />;
    case 'beta':
      return <FlaskConical className="w-3 h-3" />;
    default:
      return null;
  }
}

export function GhostModelPicker({
  mode,
  selectedModel,
  onSelectModel,
  matureFilterEnabled = true,
  className,
}: GhostModelPickerProps) {
  const [open, setOpen] = useState(false);

  // Get models for current mode (search uses text models)
  const models = useMemo(() => {
    if (mode === 'search') {
      // For search, only show models suitable for search (could filter by specific tags)
      return getModelsByModality('text', matureFilterEnabled);
    }
    return getModelsByModality(mode, matureFilterEnabled);
  }, [mode, matureFilterEnabled]);

  // Group models by provider
  const groupedModels = useMemo(() => groupModelsByProvider(models), [models]);

  // Find selected model
  const currentModel = models.find(m => m.id === selectedModel) || models[0];

  // Check if there's an "Auto" option
  const hasAutoOption = models.some(m => m.id.startsWith('auto'));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-8 px-2.5 gap-1.5 text-[13px] font-medium text-foreground/80 hover:text-foreground hover:bg-muted/50',
            className
          )}
        >
          {currentModel && (
            <>
              <span className="truncate max-w-[100px]">{currentModel.name}</span>
              {currentModel.tags.includes('private') && (
                <Lock className="w-3 h-3 text-primary" />
              )}
            </>
          )}
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[300px] max-h-[400px] overflow-auto bg-popover border-border shadow-elevated z-50"
      >
        {/* Auto option at top */}
        {hasAutoOption && (
          <>
            {models
              .filter(m => m.id.startsWith('auto'))
              .map(model => (
                <DropdownMenuItem
                  key={model.id}
                  onSelect={() => {
                    onSelectModel(model.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex items-start gap-3 p-3 cursor-pointer rounded-lg',
                    selectedModel === model.id && 'bg-muted'
                  )}
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13px]">{model.name}</span>
                      {selectedModel === model.id && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Models grouped by provider */}
        {Object.entries(groupedModels).map(([provider, providerModels], idx) => {
          // Skip auto models (already shown)
          const filteredModels = providerModels.filter(m => !m.id.startsWith('auto'));
          if (filteredModels.length === 0) return null;

          return (
            <React.Fragment key={provider}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-3 py-1.5">
                {PROVIDER_LABELS[provider] || provider}
              </DropdownMenuLabel>
              {filteredModels.map(model => (
                <DropdownMenuItem
                  key={model.id}
                  onSelect={() => {
                    if (!model.comingSoon) {
                      onSelectModel(model.id);
                      setOpen(false);
                    }
                  }}
                  disabled={model.comingSoon}
                  className={cn(
                    'flex items-start gap-3 p-3 cursor-pointer rounded-lg mx-1',
                    selectedModel === model.id && 'bg-muted',
                    model.comingSoon && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[13px]">{model.name}</span>
                      {selectedModel === model.id && <Check className="w-3.5 h-3.5 text-primary" />}
                      {model.tags.slice(0, 2).map(tag => (
                        <SwissBadge
                          key={tag}
                          variant={getTagBadgeVariant(tag)}
                          size="sm"
                          icon={<TagIcon tag={tag} />}
                        >
                          {tag.replace(/-/g, ' ')}
                        </SwissBadge>
                      ))}
                      {model.comingSoon && (
                        <SwissBadge variant="outline" size="sm">Soon</SwissBadge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      {model.contextWindow && (
                        <span>{(model.contextWindow / 1000).toFixed(0)}K context</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {model.creditCost} credits
                      </span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}