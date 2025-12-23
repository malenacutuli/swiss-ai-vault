import { ImageGen } from '@/components/ghost/ImageGen';
import type { GhostSettings } from '@/hooks/useGhostSettings';

interface GhostImageViewProps {
  onNavigateToVideo?: (imageUrl: string) => void;
  globalSettings?: GhostSettings;
}

export function GhostImageView({ onNavigateToVideo, globalSettings }: GhostImageViewProps) {
  return (
    <div className="flex-1 flex flex-col h-full">
      <ImageGen onNavigateToVideo={onNavigateToVideo} globalSettings={globalSettings} />
    </div>
  );
}
