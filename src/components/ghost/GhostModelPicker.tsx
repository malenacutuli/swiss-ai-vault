import { useState, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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

// Provider display names
const PROVIDER_LABELS: Record<string, string> = {
  modal: 'Swiss-Hosted',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  replicate: 'Replicate',
  runway: 'Runway',
  sora: 'OpenAI',
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
            'h-9 px-3 gap-2 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/50',
            className
          )}
        >
          {currentModel && (
            <>
              <span className="truncate max-w-[120px]">{currentModel.name}</span>
              {currentModel.tags.includes('private') && (
                <Lock className="w-3 h-3 text-swiss-navy" />
              )}
            </>
          )}
          <ChevronDown className="w-4 h-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[320px] bg-popover border-border"
      >
        <ScrollArea className="max-h-[400px]">
          {/* Auto option at top */}
          {hasAutoOption && (
            <>
              {models
                .filter(m => m.id.startsWith('auto'))
                .map(model => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => {
                      onSelectModel(model.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex items-start gap-3 p-3 cursor-pointer',
                      selectedModel === model.id && 'bg-swiss-navy/10'
                    )}
                  >
                    <div className="w-8 h-8 rounded-md bg-gradient-to-br from-swiss-navy to-swiss-sapphire flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        <SwissBadge variant="success" size="sm">Recommended</SwissBadge>
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
              <div key={provider}>
                {idx > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                  {PROVIDER_LABELS[provider] || provider}
                </DropdownMenuLabel>
                {filteredModels.map(model => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => {
                      if (!model.comingSoon) {
                        onSelectModel(model.id);
                        setOpen(false);
                      }
                    }}
                    disabled={model.comingSoon}
                    className={cn(
                      'flex items-start gap-3 p-3 cursor-pointer',
                      selectedModel === model.id && 'bg-swiss-navy/10',
                      model.comingSoon && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{model.name}</span>
                        {model.tags.slice(0, 3).map(tag => (
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
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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
              </div>
            );
          })}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
