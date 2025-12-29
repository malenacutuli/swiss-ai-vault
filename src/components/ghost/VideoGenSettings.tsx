import { useState } from 'react';
import { ChevronDown, ChevronUp } from '@/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export type VideoResolution = '720p' | '1080p';
export type VideoStyle = 'realistic' | 'cinematic' | 'animation';
export type CameraMotion = 'none' | 'pan' | 'zoom' | 'orbit';
export type VideoDuration = 5 | 10 | 15;

export interface VideoGenSettingsState {
  resolution: VideoResolution;
  style: VideoStyle;
  cameraMotion: CameraMotion;
  duration: VideoDuration;
}

interface VideoGenSettingsProps {
  settings: VideoGenSettingsState;
  onSettingsChange: (settings: VideoGenSettingsState) => void;
}

const RESOLUTIONS: { value: VideoResolution; label: string }[] = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

const STYLES: { value: VideoStyle; label: string }[] = [
  { value: 'realistic', label: 'Realistic' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'animation', label: 'Animation' },
];

const CAMERA_MOTIONS: { value: CameraMotion; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'Static camera' },
  { value: 'pan', label: 'Pan', description: 'Horizontal movement' },
  { value: 'zoom', label: 'Zoom', description: 'Forward/backward' },
  { value: 'orbit', label: 'Orbit', description: 'Circular movement' },
];

const DURATIONS: { value: VideoDuration; label: string; credits: number }[] = [
  { value: 5, label: '5 seconds', credits: 20 },
  { value: 10, label: '10 seconds', credits: 35 },
  { value: 15, label: '15 seconds', credits: 50 },
];

export function VideoGenSettings({ settings, onSettingsChange }: VideoGenSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateSetting = <K extends keyof VideoGenSettingsState>(
    key: K,
    value: VideoGenSettingsState[K]
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
        {/* Duration */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Duration
          </Label>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((dur) => (
              <Button
                key={dur.value}
                variant="outline"
                size="sm"
                onClick={() => updateSetting('duration', dur.value)}
                className={cn(
                  'text-xs transition-all',
                  settings.duration === dur.value
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'hover:bg-muted/50'
                )}
              >
                {dur.label}
                <span className="ml-1.5 text-muted-foreground">({dur.credits}cr)</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Resolution
          </Label>
          <div className="flex gap-2">
            {RESOLUTIONS.map((res) => (
              <Button
                key={res.value}
                variant="outline"
                size="sm"
                onClick={() => updateSetting('resolution', res.value)}
                className={cn(
                  'text-xs transition-all',
                  settings.resolution === res.value
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'hover:bg-muted/50'
                )}
              >
                {res.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Style
          </Label>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => (
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

        {/* Camera Motion */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Camera Motion
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {CAMERA_MOTIONS.map((motion) => (
              <Button
                key={motion.value}
                variant="outline"
                size="sm"
                onClick={() => updateSetting('cameraMotion', motion.value)}
                className={cn(
                  'text-xs transition-all justify-start',
                  settings.cameraMotion === motion.value
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'hover:bg-muted/50'
                )}
              >
                <div className="text-left">
                  <div>{motion.label}</div>
                  <div className="text-[10px] text-muted-foreground">{motion.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
