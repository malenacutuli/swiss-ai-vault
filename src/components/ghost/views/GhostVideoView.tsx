import { VideoGen } from '@/components/ghost/VideoGen';

interface GhostVideoViewProps {
  initialImageUrl?: string;
}

export function GhostVideoView({ initialImageUrl }: GhostVideoViewProps) {
  return (
    <div className="flex-1 flex flex-col h-full">
      <VideoGen initialImageUrl={initialImageUrl} />
    </div>
  );
}
