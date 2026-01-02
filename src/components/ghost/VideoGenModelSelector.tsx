import React, { useState } from 'react';
import { ChevronDown, Video, Zap, Crown, Clock, Check, Volume2 } from '@/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export interface VideoModel {
  id: string;
  name: string;
  provider: 'runway' | 'google' | 'openai' | 'luma' | 'pika' | 'replicate';
  description: string;
  creditCost: number;
  tags: Array<'new' | 'premium' | 'fast' | 'audio' | 'coming-soon'>;
  supportsI2V: boolean;
  supportsT2V: boolean;
  isComingSoon?: boolean;
  maxDuration?: number;
}

export const VIDEO_MODELS: VideoModel[] = [
  // Replicate models - Working alternatives (show first)
  {
    id: 'replicate-svd',
    name: 'Stable Video Diffusion',
    provider: 'replicate',
    description: 'High quality image-to-video. Smooth motion.',
    creditCost: 15,
    tags: ['fast'],
    supportsI2V: true,
    supportsT2V: false,
    maxDuration: 4,
  },
  {
    id: 'replicate-animatediff',
    name: 'AnimateDiff Lightning',
    provider: 'replicate',
    description: 'Fast text-to-video generation.',
    creditCost: 10,
    tags: ['fast', 'new'],
    supportsI2V: false,
    supportsT2V: true,
    maxDuration: 3,
  },
  // Runway
  {
    id: 'runway-gen3-alpha-turbo',
    name: 'Gen-3 Alpha Turbo',
    provider: 'runway',
    description: 'Fast video generation from Runway. 5-10s.',
    creditCost: 25,
    tags: ['fast'],
    supportsI2V: true,
    supportsT2V: true,
    maxDuration: 10,
  },
  {
    id: 'runway-gen3-alpha',
    name: 'Gen-3 Alpha',
    provider: 'runway',
    description: 'Highest quality video from Runway.',
    creditCost: 50,
    tags: ['premium'],
    supportsI2V: true,
    supportsT2V: true,
    maxDuration: 10,
  },
  // Luma (disabled for now)
  {
    id: 'dream-machine-1.5',
    name: 'Dream Machine 1.5',
    provider: 'luma',
    description: 'Cinematic video generation.',
    creditCost: 35,
    tags: ['coming-soon'],
    supportsI2V: true,
    supportsT2V: true,
    isComingSoon: true,
    maxDuration: 5,
  },
  // Google Veo (LIVE)
  {
    id: 'veo-3',
    name: 'Veo 3',
    provider: 'google',
    description: 'High quality video with audio. Up to 30s.',
    creditCost: 120,
    tags: ['new', 'premium', 'audio'],
    supportsI2V: true,
    supportsT2V: true,
    isComingSoon: false,
    maxDuration: 30,
  },
  {
    id: 'veo-2',
    name: 'Veo 2',
    provider: 'google',
    description: 'Google\'s video generation. Up to 15s.',
    creditCost: 80,
    tags: ['new'],
    supportsI2V: true,
    supportsT2V: true,
    isComingSoon: false,
    maxDuration: 15,
  },
  // OpenAI Sora (coming soon)
  {
    id: 'sora',
    name: 'Sora',
    provider: 'openai',
    description: 'OpenAI\'s video model. Up to 20s.',
    creditCost: 100,
    tags: ['premium', 'coming-soon'],
    supportsI2V: true,
    supportsT2V: true,
    isComingSoon: true,
    maxDuration: 20,
  },
  {
    id: 'sora-turbo',
    name: 'Sora Turbo',
    provider: 'openai',
    description: 'Faster Sora. Up to 10s.',
    creditCost: 50,
    tags: ['fast', 'coming-soon'],
    supportsI2V: true,
    supportsT2V: true,
    isComingSoon: true,
    maxDuration: 10,
  },
  // Pika (coming soon)
  {
    id: 'pika-2.0',
    name: 'Pika 2.0',
    provider: 'pika',
    description: 'Creative effects and motion.',
    creditCost: 30,
    tags: ['new', 'coming-soon'],
    supportsI2V: true,
    supportsT2V: true,
    isComingSoon: true,
    maxDuration: 5,
  },
];

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  runway: Video,
  google: Crown,
  openai: Zap,
  luma: Video,
  pika: Video,
  replicate: Zap,
};

interface VideoGenModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  mode: 'i2v' | 't2v';
  matureFilterEnabled?: boolean;
}

function getTagBadge(tag: string) {
  switch (tag) {
    case 'new':
      return <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-0">New</Badge>;
    case 'premium':
      return <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-amber-500/20 text-amber-400 border-0">Premium</Badge>;
    case 'fast':
      return <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-500/20 text-blue-400 border-0">Fast</Badge>;
    case 'audio':
      return <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-purple-500/20 text-purple-400 border-0 flex items-center gap-1"><Volume2 className="h-3 w-3" />Audio</Badge>;
    case 'coming-soon':
      return <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-muted text-muted-foreground border-0 flex items-center gap-1"><Clock className="h-3 w-3" />Soon</Badge>;
    default:
      return null;
  }
}

export function VideoGenModelSelector({
  selectedModel,
  onModelChange,
  mode,
  matureFilterEnabled = true,
}: VideoGenModelSelectorProps) {
  const [open, setOpen] = useState(false);

  // Filter models based on mode
  const availableModels = VIDEO_MODELS.filter(model => {
    if (mode === 'i2v') return model.supportsI2V;
    if (mode === 't2v') return model.supportsT2V;
    return true;
  });

  const currentModel = availableModels.find(m => m.id === selectedModel) || availableModels[0];
  const ProviderIcon = PROVIDER_ICONS[currentModel.provider] || Video;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-background/50 border-border/50 hover:bg-background/80"
        >
          <div className="flex items-center gap-2">
            <ProviderIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{currentModel.name}</span>
            {currentModel.isComingSoon && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-muted text-muted-foreground border-0">
                <Clock className="h-3 w-3 mr-1" />
                Soon
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[340px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Video Generation Models
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {availableModels.map((model) => {
          const Icon = PROVIDER_ICONS[model.provider] || Video;
          const isSelected = model.id === selectedModel;
          
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
              className={`flex items-start gap-3 p-3 cursor-pointer ${model.isComingSoon ? 'opacity-60' : ''}`}
            >
              <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{model.name}</span>
                  {model.tags.filter(t => t !== 'coming-soon').map(tag => (
                    <span key={tag}>{getTagBadge(tag)}</span>
                  ))}
                  {model.isComingSoon && getTagBadge('coming-soon')}
                  {isSelected && !model.isComingSoon && (
                    <Check className="h-4 w-4 text-primary ml-auto" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {model.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {model.creditCost} credits
                  </Badge>
                  {model.maxDuration && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      Max {model.maxDuration}s
                    </Badge>
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
