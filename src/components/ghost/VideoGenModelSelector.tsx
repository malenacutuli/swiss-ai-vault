import { useState } from 'react';
import { Check, ChevronDown, Video, Sparkles, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface VideoModel {
  id: string;
  name: string;
  provider: 'runway' | 'google' | 'openai';
  description: string;
  creditCost: number;
  tags: string[];
  isComingSoon?: boolean;
  supportsI2V?: boolean;
  supportsT2V?: boolean;
}

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: 'runway-gen3-turbo',
    name: 'Gen-3 Alpha Turbo',
    provider: 'runway',
    description: 'Fast video generation from Runway. Great for iteration.',
    creditCost: 20,
    tags: ['fast'],
    supportsI2V: true,
    supportsT2V: true,
  },
  {
    id: 'runway-gen3',
    name: 'Gen-3 Alpha',
    provider: 'runway',
    description: 'Highest quality video from Runway.',
    creditCost: 40,
    tags: ['premium'],
    supportsI2V: true,
    supportsT2V: true,
  },
  {
    id: 'veo-2',
    name: 'Veo 2',
    provider: 'google',
    description: 'Google\'s video generation model with audio.',
    creditCost: 50,
    tags: ['new', 'audio'],
    supportsI2V: true,
    supportsT2V: true,
  },
  {
    id: 'sora',
    name: 'Sora',
    provider: 'openai',
    description: 'OpenAI\'s revolutionary video model.',
    creditCost: 100,
    tags: ['coming-soon'],
    isComingSoon: true,
    supportsI2V: true,
    supportsT2V: true,
  },
];

const PROVIDER_ICONS: Record<string, typeof Video> = {
  runway: Video,
  google: Zap,
  openai: Sparkles,
};

interface VideoGenModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  mode: 'i2v' | 't2v';
}

export function VideoGenModelSelector({ selectedModel, onModelChange, mode }: VideoGenModelSelectorProps) {
  const [open, setOpen] = useState(false);
  
  const availableModels = VIDEO_MODELS.filter(m => 
    mode === 'i2v' ? m.supportsI2V : m.supportsT2V
  );
  
  const currentModel = availableModels.find(m => m.id === selectedModel) || availableModels[0];
  const Icon = PROVIDER_ICONS[currentModel.provider] || Video;

  const getTagBadge = (tag: string) => {
    switch (tag) {
      case 'new':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-swiss-burgundy/30 text-swiss-burgundy">NEW</Badge>;
      case 'premium':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-600">PREMIUM</Badge>;
      case 'fast':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-600">FAST</Badge>;
      case 'audio':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-600">AUDIO</Badge>;
      case 'coming-soon':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">COMING SOON</Badge>;
      default:
        return null;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-background/50 hover:bg-muted/50 border-border/50"
        >
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{currentModel.name}</span>
            {currentModel.tags.slice(0, 1).map(tag => (
              <span key={tag}>{getTagBadge(tag)}</span>
            ))}
          </div>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-[320px]">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Select Model
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {availableModels.map((model) => {
          const ModelIcon = PROVIDER_ICONS[model.provider] || Video;
          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => {
                if (!model.isComingSoon) {
                  onModelChange(model.id);
                  setOpen(false);
                }
              }}
              disabled={model.isComingSoon}
              className={cn(
                'flex items-start gap-3 p-3 cursor-pointer',
                selectedModel === model.id && 'bg-muted/50',
                model.isComingSoon && 'opacity-50 cursor-not-allowed'
              )}
            >
              <ModelIcon className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.name}</span>
                  {model.tags.map(tag => (
                    <span key={tag}>{getTagBadge(tag)}</span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {model.description}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  ~{model.creditCost} credits per 5s
                </p>
              </div>
              {selectedModel === model.id && !model.isComingSoon && (
                <Check className="w-4 h-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
