import { ImageGen } from '@/components/ghost/ImageGen';

interface GhostImageViewProps {
  onNavigateToVideo?: (imageUrl: string) => void;
}

export function GhostImageView({ onNavigateToVideo }: GhostImageViewProps) {
  return (
    <div className="flex-1 flex flex-col h-full">
      <ImageGen onNavigateToVideo={onNavigateToVideo} />
    </div>
  );
}
