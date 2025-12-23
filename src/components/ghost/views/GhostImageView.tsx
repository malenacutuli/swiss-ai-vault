import { useState } from 'react';
import { SwissHeading } from '@/components/ui/swiss';
import { SwissCard } from '@/components/ui/swiss';
import { Button } from '@/components/ui/button';
import { Image, Wand2, Sparkles, Grid3X3, Square } from 'lucide-react';

interface GhostImageViewProps {
  generatedImages?: string[];
  isGenerating?: boolean;
}

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square', icon: Square },
  { id: '16:9', label: 'Wide', icon: null },
  { id: '9:16', label: 'Tall', icon: null },
  { id: '4:3', label: 'Standard', icon: null },
];

export function GhostImageView({ generatedImages = [], isGenerating = false }: GhostImageViewProps) {
  const [selectedRatio, setSelectedRatio] = useState('1:1');

  if (generatedImages.length === 0 && !isGenerating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-swiss-burgundy/10 border border-swiss-burgundy/20 flex items-center justify-center mb-6">
          <Image className="w-8 h-8 text-swiss-burgundy" />
        </div>
        <SwissHeading as="h2" size="xl" className="text-center mb-3">
          Private Image Generation
        </SwissHeading>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Generate images with state-of-the-art AI models. Your prompts and creations
          remain private and are never logged.
        </p>

        {/* Aspect ratio selector */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground mr-2">Aspect Ratio:</span>
          {ASPECT_RATIOS.map(ratio => (
            <Button
              key={ratio.id}
              variant={selectedRatio === ratio.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedRatio(ratio.id)}
              className="text-xs"
            >
              {ratio.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wand2 className="w-4 h-4" />
          <span>Enable prompt enhancement for better results</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {generatedImages.map((image, idx) => (
          <SwissCard key={idx} interactive noPadding className="overflow-hidden aspect-square">
            <img src={image} alt={`Generated ${idx + 1}`} className="w-full h-full object-cover" />
          </SwissCard>
        ))}
        {isGenerating && (
          <SwissCard noPadding className="aspect-square flex items-center justify-center bg-muted/50">
            <div className="flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-swiss-burgundy animate-pulse" />
              <span className="text-sm text-muted-foreground">Generating...</span>
            </div>
          </SwissCard>
        )}
      </div>
    </div>
  );
}
