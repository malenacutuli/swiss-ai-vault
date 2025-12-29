import { useState } from 'react';
import { Download, Heart, RefreshCw, Video, X, Maximize2, Trash2 } from '@/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SwissCard } from '@/components/ui/swiss';
import { cn } from '@/lib/utils';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  seed?: number;
  createdAt: Date;
  isSaved?: boolean;
}

interface ImageGenResultsProps {
  images: GeneratedImage[];
  isLoading?: boolean;
  loadingCount?: number;
  onDownload: (image: GeneratedImage) => void;
  onSave: (image: GeneratedImage) => void;
  onRegenerate: (image: GeneratedImage) => void;
  onUseForVideo: (image: GeneratedImage) => void;
  onDelete: (image: GeneratedImage) => void;
}

export function ImageGenResults({
  images,
  isLoading,
  loadingCount = 1,
  onDownload,
  onSave,
  onRegenerate,
  onUseForVideo,
  onDelete,
}: ImageGenResultsProps) {
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);

  if (images.length === 0 && !isLoading) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
        {/* Loading skeletons */}
        {isLoading && Array.from({ length: loadingCount }).map((_, idx) => (
          <div
            key={`loading-${idx}`}
            className="aspect-square rounded-lg bg-muted/30 border border-border/30 overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-swiss-burgundy/30 border-t-swiss-burgundy rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground">Generating...</span>
              </div>
            </div>
          </div>
        ))}
        
        {/* Generated images */}
        {images.map((image) => (
          <SwissCard
            key={image.id}
            noPadding
            interactive
            className="group aspect-square overflow-hidden relative"
          >
            <img
              src={image.url}
              alt={image.prompt}
              className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
              onClick={() => setLightboxImage(image)}
            />
            
            {/* Overlay actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(image);
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "w-8 h-8 bg-white/10 hover:bg-white/20 text-white",
                        image.isSaved && "text-red-400"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSave(image);
                      }}
                    >
                      <Heart className={cn("w-4 h-4", image.isSaved && "fill-current")} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRegenerate(image);
                      }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUseForVideo(image);
                      }}
                    >
                      <Video className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 bg-white/10 hover:bg-red-500/80 text-white hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(image);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Expand button */}
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 w-8 h-8 bg-white/10 hover:bg-white/20 text-white"
                onClick={() => setLightboxImage(image)}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </SwissCard>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none">
          {lightboxImage && (
            <div className="relative">
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={() => setLightboxImage(null)}
              >
                <X className="w-5 h-5" />
              </Button>
              
              <img
                src={lightboxImage.url}
                alt={lightboxImage.prompt}
                className="w-full h-auto max-h-[85vh] object-contain"
              />
              
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <p className="text-white/80 text-sm mb-3 line-clamp-2">
                  {lightboxImage.prompt}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    onClick={() => onDownload(lightboxImage)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    onClick={() => onSave(lightboxImage)}
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    onClick={() => onUseForVideo(lightboxImage)}
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Use for Video
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-red-500/80 hover:border-red-500/80"
                    onClick={() => {
                      onDelete(lightboxImage);
                      setLightboxImage(null);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
                <p className="text-white/50 text-xs mt-3">
                  Model: {lightboxImage.model} · {lightboxImage.aspectRatio}
                  {lightboxImage.seed && ` · Seed: ${lightboxImage.seed}`}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
