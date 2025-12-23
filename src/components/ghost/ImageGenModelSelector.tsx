import { useState } from 'react';
import { Check, ChevronDown, Sparkles, Zap, Crown, Image } from 'lucide-react';
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

export interface ImageModel {
  id: string;
  name: string;
  provider: 'replicate' | 'openai' | 'google' | 'auto';
  description: string;
  creditCost: number;
  tags: string[];
  isDefault?: boolean;
  isUncensored?: boolean;  // Models that allow mature content
  isMature?: boolean;      // Models primarily for mature content
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'auto',
    name: 'Auto',
    provider: 'auto',
    description: 'Automatically selects the best model for your prompt',
    creditCost: 2,
    tags: ['default'],
    isDefault: true,
  },
  {
    id: 'flux-1.1-pro',
    name: 'Flux 1.1 Pro',
    provider: 'replicate',
    description: 'Black Forest Labs flagship. Best quality.',
    creditCost: 5,
    tags: ['new', 'premium'],
  },
  {
    id: 'flux-schnell',
    name: 'Flux Schnell',
    provider: 'replicate',
    description: 'Fast Flux variant. Great for iteration.',
    creditCost: 1,
    tags: ['fast'],
  },
  {
    id: 'sdxl',
    name: 'SDXL',
    provider: 'replicate',
    description: 'Stable Diffusion XL. Industry standard.',
    creditCost: 1,
    tags: [],
  },
  {
    id: 'sd3-medium',
    name: 'SD3 Medium',
    provider: 'replicate',
    description: 'Stable Diffusion 3. Better text rendering.',
    creditCost: 2,
    tags: [],
  },
  {
    id: 'dall-e-3',
    name: 'DALL·E 3',
    provider: 'openai',
    description: 'OpenAI\'s image model. Great prompt adherence.',
    creditCost: 4,
    tags: ['premium'],
  },
  {
    id: 'imagen-3',
    name: 'Imagen 3',
    provider: 'google',
    description: 'Google\'s state-of-the-art image model.',
    creditCost: 5,
    tags: ['new', 'premium'],
  },
];

const PROVIDER_ICONS: Record<string, typeof Image> = {
  replicate: Image,
  openai: Sparkles,
  google: Zap,
  auto: Crown,
};

interface ImageGenModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  matureFilterEnabled?: boolean;
}

export function ImageGenModelSelector({ selectedModel, onModelChange, matureFilterEnabled = true }: ImageGenModelSelectorProps) {
  const [open, setOpen] = useState(false);
  
  // Filter models based on mature filter setting
  const availableModels = matureFilterEnabled 
    ? IMAGE_MODELS.filter(m => !m.isUncensored && !m.isMature)
    : IMAGE_MODELS;
  
  const currentModel = availableModels.find(m => m.id === selectedModel) || availableModels[0];
  const Icon = PROVIDER_ICONS[currentModel.provider] || Image;

  const getTagBadge = (tag: string) => {
    switch (tag) {
      case 'new':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-swiss-burgundy/30 text-swiss-burgundy">NEW</Badge>;
      case 'premium':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-600">PREMIUM</Badge>;
      case 'fast':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-600">FAST</Badge>;
      case 'default':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">DEFAULT</Badge>;
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
          const ModelIcon = PROVIDER_ICONS[model.provider] || Image;
          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => {
                onModelChange(model.id);
                setOpen(false);
              }}
              className={cn(
                'flex items-start gap-3 p-3 cursor-pointer',
                selectedModel === model.id && 'bg-muted/50'
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
                  {model.creditCost} credits per image
                </p>
              </div>
              {selectedModel === model.id && (
                <Check className="w-4 h-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
