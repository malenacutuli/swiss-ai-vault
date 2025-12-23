import { SwissHeading } from '@/components/ui/swiss';
import { SwissCard } from '@/components/ui/swiss';
import { Video, Film, Sparkles } from 'lucide-react';

interface GhostVideoViewProps {
  generatedVideos?: string[];
  isGenerating?: boolean;
}

export function GhostVideoView({ generatedVideos = [], isGenerating = false }: GhostVideoViewProps) {
  if (generatedVideos.length === 0 && !isGenerating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-swiss-teal/10 border border-swiss-teal/20 flex items-center justify-center mb-6">
          <Video className="w-8 h-8 text-swiss-teal" />
        </div>
        <SwissHeading as="h2" size="xl" className="text-center mb-3">
          Private Video Generation
        </SwissHeading>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Create stunning videos with cutting-edge AI. From text descriptions or images,
          generate videos that remain completely private.
        </p>

        <div className="grid grid-cols-2 gap-4 max-w-md w-full">
          <SwissCard interactive className="text-center">
            <Film className="w-6 h-6 mx-auto mb-2 text-swiss-teal" />
            <p className="text-sm font-medium">Text to Video</p>
            <p className="text-xs text-muted-foreground mt-1">Describe your vision</p>
          </SwissCard>
          <SwissCard interactive className="text-center">
            <Sparkles className="w-6 h-6 mx-auto mb-2 text-swiss-teal" />
            <p className="text-sm font-medium">Image to Video</p>
            <p className="text-xs text-muted-foreground mt-1">Animate an image</p>
          </SwissCard>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {generatedVideos.map((video, idx) => (
          <SwissCard key={idx} interactive noPadding className="overflow-hidden aspect-video">
            <video src={video} controls className="w-full h-full object-cover" />
          </SwissCard>
        ))}
        {isGenerating && (
          <SwissCard noPadding className="aspect-video flex items-center justify-center bg-muted/50">
            <div className="flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-swiss-teal animate-pulse" />
              <span className="text-sm text-muted-foreground">Generating video...</span>
            </div>
          </SwissCard>
        )}
      </div>
    </div>
  );
}
