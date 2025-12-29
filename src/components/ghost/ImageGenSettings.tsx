import { useState } from 'react';
import { ChevronDown, ChevronUp } from '@/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
export type StylePreset = 'none' | 'photorealistic' | 'artistic' | 'anime' | '3d-render';

export interface ImageGenSettingsState {
  aspectRatio: AspectRatio;
  style: StylePreset;
  negativePrompt: string;
  seed: string;
  count: number;
}

interface ImageGenSettingsProps {
  settings: ImageGenSettingsState;
  onSettingsChange: (settings: ImageGenSettingsState) => void;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: '1:1', label: 'Square', icon: '◼' },
  { value: '3:4', label: 'Portrait', icon: '▮' },
  { value: '4:3', label: 'Landscape', icon: '▬' },
  { value: '16:9', label: 'Wide', icon: '━' },
  { value: '9:16', label: 'Tall', icon: '┃' },
];

const STYLE_PRESETS: { value: StylePreset; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'artistic', label: 'Artistic' },
  { value: 'anime', label: 'Anime' },
  { value: '3d-render', label: '3D Render' },
];

export function ImageGenSettings({ settings, onSettingsChange }: ImageGenSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateSetting = <K extends keyof ImageGenSettingsState>(
    key: K,
    value: ImageGenSettingsState[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-4 py-2 text-muted-foreground hover:text-foreground"
        >
          <span className="text-sm">Settings</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="px-4 pb-4 pt-2 space-y-6">
        {/* Aspect Ratio */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Aspect Ratio
          </Label>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map((ratio) => (
              <Button
                key={ratio.value}
                variant="outline"
                size="sm"
                onClick={() => updateSetting('aspectRatio', ratio.value)}
                className={cn(
                  'min-w-[80px] text-xs transition-all',
                  settings.aspectRatio === ratio.value
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'hover:bg-muted/50'
                )}
              >
                <span className="mr-1.5 opacity-60">{ratio.icon}</span>
                {ratio.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Style Preset */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Style
          </Label>
          <div className="flex flex-wrap gap-2">
            {STYLE_PRESETS.map((style) => (
              <Button
                key={style.value}
                variant="outline"
                size="sm"
                onClick={() => updateSetting('style', style.value)}
                className={cn(
                  'text-xs transition-all',
                  settings.style === style.value
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'hover:bg-muted/50'
                )}
              >
                {style.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Number of Images */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Number of Images
            </Label>
            <span className="text-sm font-medium">{settings.count}</span>
          </div>
          <Slider
            value={[settings.count]}
            onValueChange={([value]) => updateSetting('count', value)}
            min={1}
            max={4}
            step={1}
            className="w-full"
          />
        </div>

        {/* Negative Prompt */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Negative Prompt
          </Label>
          <Textarea
            value={settings.negativePrompt}
            onChange={(e) => updateSetting('negativePrompt', e.target.value)}
            placeholder="What to avoid in the image..."
            className="min-h-[60px] text-sm resize-none bg-background/50"
          />
        </div>

        {/* Seed */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Seed (optional)
          </Label>
          <Input
            type="text"
            value={settings.seed}
            onChange={(e) => updateSetting('seed', e.target.value.replace(/\D/g, ''))}
            placeholder="For reproducible results"
            className="text-sm bg-background/50"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
