import { useState, useCallback } from 'react';
import { Image, Wand2, Coins, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SwissHeading, SwissCard } from '@/components/ui/swiss';
import { ImageGenSettings, ImageGenSettingsState } from './ImageGenSettings';
import { ImageGenModelSelector, IMAGE_MODELS } from './ImageGenModelSelector';
import { ImageGenResults, GeneratedImage } from './ImageGenResults';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageGenProps {
  onNavigateToVideo?: (imageUrl: string) => void;
}

export function ImageGen({ onNavigateToVideo }: ImageGenProps) {
  const { user } = useAuth();
  const { balance, formattedBalance, refreshCredits } = useGhostCredits();
  
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('auto');
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  
  const [settings, setSettings] = useState<ImageGenSettingsState>({
    aspectRatio: '1:1',
    style: 'none',
    negativePrompt: '',
    seed: '',
    count: 1,
  });

  const currentModel = IMAGE_MODELS.find(m => m.id === selectedModel) || IMAGE_MODELS[0];
  const totalCost = currentModel.creditCost * settings.count;
  const hasEnoughCredits = balance >= totalCost;

  const generateImages = useCallback(async () => {
    if (!prompt.trim() || !user) {
      toast.error('Please enter a prompt');
      return;
    }

    if (!hasEnoughCredits) {
      toast.error('Insufficient credits');
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('ghost-image-gen', {
        body: {
          prompt: prompt.trim(),
          model: selectedModel,
          aspectRatio: settings.aspectRatio,
          style: settings.style !== 'none' ? settings.style : undefined,
          negativePrompt: settings.negativePrompt || undefined,
          seed: settings.seed ? parseInt(settings.seed) : undefined,
          count: settings.count,
          enhancePrompt,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const newImages: GeneratedImage[] = data.images.map((img: { url: string; seed?: number }, idx: number) => ({
        id: `${Date.now()}-${idx}`,
        url: img.url,
        prompt: data.enhancedPrompt || prompt,
        model: data.model || selectedModel,
        aspectRatio: settings.aspectRatio,
        seed: img.seed,
        createdAt: new Date(),
        isSaved: false,
      }));

      setGeneratedImages(prev => [...newImages, ...prev]);
      refreshCredits();
      toast.success(`Generated ${newImages.length} image${newImages.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('[ImageGen] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, user, selectedModel, settings, enhancePrompt, hasEnoughCredits, refreshCredits]);

  const handleDownload = useCallback(async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghost-image-${image.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Image downloaded');
    } catch (error) {
      toast.error('Failed to download image');
    }
  }, []);

  const handleSave = useCallback(async (image: GeneratedImage) => {
    if (!user) return;

    try {
      // Save to ghost_library
      const { error } = await supabase.from('ghost_library').insert({
        user_id: user.id,
        content_type: 'image',
        storage_type: 'url',
        storage_key: image.url,
        prompt: image.prompt,
        model_id: image.model,
        format: 'png',
        title: image.prompt.slice(0, 100),
      });

      if (error) throw error;

      setGeneratedImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, isSaved: true } : img
        )
      );
      toast.success('Saved to library');
    } catch (error) {
      console.error('[ImageGen] Save error:', error);
      toast.error('Failed to save image');
    }
  }, [user]);

  const handleRegenerate = useCallback((image: GeneratedImage) => {
    setPrompt(image.prompt);
    generateImages();
  }, [generateImages]);

  const handleUseForVideo = useCallback((image: GeneratedImage) => {
    onNavigateToVideo?.(image.url);
  }, [onNavigateToVideo]);

  return (
    <div className="flex flex-col h-full">
      {/* Results area */}
      <div className="flex-1 overflow-auto">
        {generatedImages.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-16 h-16 rounded-2xl bg-swiss-burgundy/10 border border-swiss-burgundy/20 flex items-center justify-center mb-6">
              <Image className="w-8 h-8 text-swiss-burgundy" />
            </div>
            <SwissHeading as="h2" size="xl" className="text-center mb-3">
              Private Image Generation
            </SwissHeading>
            <p className="text-muted-foreground text-center max-w-md">
              Generate images with state-of-the-art AI models. Your prompts and creations
              remain private and are never logged.
            </p>
          </div>
        ) : (
          <ImageGenResults
            images={generatedImages}
            isLoading={isGenerating}
            loadingCount={settings.count}
            onDownload={handleDownload}
            onSave={handleSave}
            onRegenerate={handleRegenerate}
            onUseForVideo={handleUseForVideo}
          />
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {/* Settings */}
          <ImageGenSettings settings={settings} onSettingsChange={setSettings} />

          {/* Model selector and input */}
          <div className="space-y-3">
            <ImageGenModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />

            <SwissCard className="p-0 overflow-hidden">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                className="min-h-[100px] border-0 bg-transparent resize-none focus-visible:ring-0 text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    generateImages();
                  }
                }}
              />

              <div className="flex items-center justify-between p-3 border-t border-border/30 bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="enhance-prompt"
                      checked={enhancePrompt}
                      onCheckedChange={setEnhancePrompt}
                    />
                    <Label htmlFor="enhance-prompt" className="text-sm text-muted-foreground cursor-pointer">
                      <Wand2 className="w-4 h-4 inline mr-1.5" />
                      Enhance
                    </Label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Coins className="w-4 h-4" />
                    <span className={cn(!hasEnoughCredits && 'text-destructive')}>
                      {totalCost} credits
                    </span>
                    <span className="text-muted-foreground/50">
                      ({formattedBalance} available)
                    </span>
                  </div>

                  <Button
                    onClick={generateImages}
                    disabled={!prompt.trim() || isGenerating || !hasEnoughCredits}
                    className="min-w-[120px]"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating
                      </>
                    ) : (
                      'Generate'
                    )}
                  </Button>
                </div>
              </div>
            </SwissCard>
          </div>
        </div>
      </div>
    </div>
  );
}
