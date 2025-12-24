import React, { useState } from 'react';
import { ChevronDown, Sparkles, Zap, Crown, Image as ImageIcon, Check } from 'lucide-react';
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

export interface ImageModel {
  id: string;
  name: string;
  provider: 'auto' | 'replicate' | 'openai' | 'google';
  description: string;
  creditCost: number;
  tags: Array<'default' | 'new' | 'premium' | 'fast'>;
  isDefault?: boolean;
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
  // Google Imagen
  {
    id: 'imagen-3',
    name: 'Imagen 3',
    provider: 'google',
    description: 'Best photorealism from Google.',
    creditCost: 5,
    tags: ['new', 'premium'],
  },
  {
    id: 'imagen-3-fast',
    name: 'Imagen 3 Fast',
    provider: 'google',
    description: 'Faster version of Imagen 3.',
    creditCost: 3,
    tags: ['new', 'fast'],
  },
  // Black Forest Labs (Flux)
  {
    id: 'flux-1.1-pro-ultra',
    name: 'Flux 1.1 Pro Ultra',
    provider: 'replicate',
    description: 'Up to 4K resolution. Best quality.',
    creditCost: 8,
    tags: ['new', 'premium'],
  },
  {
    id: 'flux-1.1-pro',
    name: 'Flux 1.1 Pro',
    provider: 'replicate',
    description: 'Black Forest Labs flagship.',
    creditCost: 5,
    tags: ['premium'],
  },
  {
    id: 'flux-schnell',
    name: 'Flux Schnell',
    provider: 'replicate',
    description: 'Fast Flux variant. Great for iteration.',
    creditCost: 1,
    tags: ['fast'],
  },
  // OpenAI
  {
    id: 'dall-e-3',
    name: 'DALL·E 3',
    provider: 'openai',
    description: 'OpenAI\'s image model. Great prompt adherence.',
    creditCost: 4,
    tags: ['premium'],
  },
  // Stability AI
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
];

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  auto: Sparkles,
  replicate: ImageIcon,
  openai: Sparkles,
  google: Crown,
};

interface ImageGenModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
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
    default:
      return null;
  }
}

export function ImageGenModelSelector({
  selectedModel,
  onModelChange,
  matureFilterEnabled = true,
}: ImageGenModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const availableModels = IMAGE_MODELS;
  const currentModel = availableModels.find(m => m.id === selectedModel) || availableModels[0];
  const ProviderIcon = PROVIDER_ICONS[currentModel.provider] || ImageIcon;

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
            {currentModel.tags.filter(t => t !== 'default').map(tag => (
              <span key={tag}>{getTagBadge(tag)}</span>
            ))}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Image Generation Models
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {availableModels.map((model) => {
          const Icon = PROVIDER_ICONS[model.provider] || ImageIcon;
          const isSelected = model.id === selectedModel;
          
          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => {
                onModelChange(model.id);
                setOpen(false);
              }}
              className="flex items-start gap-3 p-3 cursor-pointer"
            >
              <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{model.name}</span>
                  {model.tags.filter(t => t !== 'default').map(tag => (
                    <span key={tag}>{getTagBadge(tag)}</span>
                  ))}
                  {isSelected && (
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
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
