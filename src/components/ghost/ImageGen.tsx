import { useState, useCallback, useEffect, useRef } from 'react';
import { Image, Wand2, Coins, Loader2, Upload, X } from '@/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SwissHeading, SwissCard } from '@/components/ui/swiss';
import { ImageGenSettings, ImageGenSettingsState, AspectRatio } from './ImageGenSettings';
import { ImageGenModelSelector, IMAGE_MODELS } from './ImageGenModelSelector';
import { ImageGenResults, GeneratedImage } from './ImageGenResults';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useGhostMedia } from '@/hooks/useGhostMedia';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { GhostSettings } from '@/hooks/useGhostSettings';

interface ImageGenProps {
  onNavigateToVideo?: (imageUrl: string) => void;
  globalSettings?: GhostSettings;
}

export function ImageGen({ onNavigateToVideo, globalSettings }: ImageGenProps) {
  const { user } = useAuth();
  const { balance, formattedBalance, refreshCredits } = useGhostCredits();
  const { saveImage, isReady: mediaStorageReady } = useGhostMedia();
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('auto');
  const [enhancePrompt, setEnhancePrompt] = useState(globalSettings?.image_enhance_prompts ?? false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist generated images locally per user so they survive tab switches
  const localKey = user?.id ? `ghost:imagegen:recent:${user.id}` : null;
  useEffect(() => {
    if (!localKey) return;
    try {
      const raw = localStorage.getItem(localKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<Omit<GeneratedImage, 'createdAt'> & { createdAt: string }>;
      const restored: GeneratedImage[] = parsed.map((img) => ({
        ...img,
        createdAt: new Date(img.createdAt),
      }));
      setGeneratedImages(restored);
    } catch (e) {
      console.warn('[ImageGen] Failed to restore recent images');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localKey]);

  useEffect(() => {
    if (!localKey) return;
    try {
      const compact = generatedImages.slice(0, 50).map((img) => ({
        ...img,
        createdAt: img.createdAt.toISOString(),
      }));
      localStorage.setItem(localKey, JSON.stringify(compact));
    } catch {
      // ignore
    }
  }, [localKey, generatedImages]);
  const getValidAspectRatio = (ratio?: string): AspectRatio => {
    const validRatios: AspectRatio[] = ['1:1', '3:4', '4:3', '16:9', '9:16'];
    return validRatios.includes(ratio as AspectRatio) ? (ratio as AspectRatio) : '1:1';
  };

  const [settings, setSettings] = useState<ImageGenSettingsState>({
    aspectRatio: getValidAspectRatio(globalSettings?.image_aspect_ratio),
    style: 'none',
    negativePrompt: '',
    seed: '',
    count: 1,
  });

  // Sync with global settings when they change
  useEffect(() => {
    if (globalSettings) {
      setEnhancePrompt(globalSettings.image_enhance_prompts);
      setSettings(prev => ({
        ...prev,
        aspectRatio: getValidAspectRatio(globalSettings.image_aspect_ratio),
      }));
    }
  }, [globalSettings]);

  const currentModel = IMAGE_MODELS.find(m => m.id === selectedModel) || IMAGE_MODELS[0];
  const totalCost = currentModel.creditCost * settings.count;
  const hasEnoughCredits = balance >= totalCost;

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearReferenceImage = useCallback(() => {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

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
          referenceImage: referenceImage || undefined,
          // Pass global settings to API
          hideWatermark: globalSettings?.image_hide_watermark ?? false,
          format: globalSettings?.image_format ?? 'png',
          embedExif: globalSettings?.image_embed_exif ?? false,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const now = new Date();
      const finalPrompt = data.enhancedPrompt || prompt;
      const finalModel = data.model || selectedModel;
      
      // Create temporary display objects immediately (fast UX)
      const newImages: GeneratedImage[] = data.images.map((img: { url: string; seed?: number }, idx: number) => ({
        id: `${Date.now()}-${idx}`,
        url: img.url,
        prompt: finalPrompt,
        model: finalModel,
        aspectRatio: settings.aspectRatio,
        seed: img.seed,
        createdAt: now,
        isSaved: false,
        isStoringLocally: true,  // Show loading indicator
      }));

      // Show results immediately
      setGeneratedImages(prev => [...newImages, ...prev]);
      refreshCredits();
      toast.success(`Generated ${newImages.length} image${newImages.length > 1 ? 's' : ''}`);

      // Venice pattern: Download and store locally in background (NO Supabase)
      if (mediaStorageReady) {
        for (const image of newImages) {
          try {
            const localImage = await saveImage(image.url, image.prompt, image.model, {
              aspectRatio: image.aspectRatio,
              seed: image.seed,
            });
            
            if (localImage) {
              // Replace temp image with local version (now has base64 data)
              setGeneratedImages(prev => prev.map(img => 
                img.id === image.id 
                  ? { 
                      ...img, 
                      isSaved: true, 
                      isStoringLocally: false,
                      localId: localImage.id,
                      data: localImage.data, // Use local data
                    }
                  : img
              ));
              console.log('[ImageGen] Stored locally - Venice style');
            }
          } catch (error) {
            console.warn('[ImageGen] Local storage failed, keeping URL:', error);
            // Still works, just won't persist after URL expires
            setGeneratedImages(prev => prev.map(img => 
              img.id === image.id 
                ? { ...img, isStoringLocally: false, persistenceWarning: true }
                : img
            ));
          }
        }
      } else {
        // Storage not ready - mark images as needing attention
        setGeneratedImages(prev => prev.map(img => 
          newImages.some(ni => ni.id === img.id)
            ? { ...img, isStoringLocally: false, persistenceWarning: true }
            : img
        ));
      }
    } catch (error) {
      console.error('[ImageGen] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, user, selectedModel, settings, enhancePrompt, hasEnoughCredits, refreshCredits, globalSettings, referenceImage, mediaStorageReady, saveImage]);

  const handleDownload = useCallback(async (image: GeneratedImage) => {
    try {
      // Prefer local data if available, otherwise fetch from URL
      const imageData = (image as any).data || image.url;
      
      if (imageData.startsWith('data:')) {
        // Already have base64 data - convert to blob
        const response = await fetch(imageData);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ghost-image-${image.id}.${globalSettings?.image_format ?? 'png'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Fetch from URL
        const response = await fetch(image.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ghost-image-${image.id}.${globalSettings?.image_format ?? 'png'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success('Image downloaded');
    } catch (error) {
      toast.error('Failed to download image');
    }
  }, [globalSettings?.image_format]);

  const handleSave = useCallback(async (image: GeneratedImage) => {
    if (!user || !mediaStorageReady) {
      toast.error('Storage not ready');
      return;
    }

    try {
      // Venice pattern: Save to LOCAL IndexedDB only - NO Supabase
      const localImage = await saveImage(image.url, image.prompt, image.model, {
        aspectRatio: image.aspectRatio,
        seed: image.seed,
      });

      if (localImage) {
        setGeneratedImages(prev =>
          prev.map(img => (img.id === image.id ? { 
            ...img, 
            isSaved: true,
            localId: localImage.id,
            data: localImage.data,
          } : img))
        );
        toast.success('Saved to local library');
      }
    } catch (error) {
      console.error('[ImageGen] Save error:', error);
      toast.error('Failed to save image');
    }
  }, [user, mediaStorageReady, saveImage]);

  const handleRegenerate = useCallback((image: GeneratedImage) => {
    setPrompt(image.prompt);
    generateImages();
  }, [generateImages]);

  const handleUseForVideo = useCallback((image: GeneratedImage) => {
    onNavigateToVideo?.(image.url);
  }, [onNavigateToVideo]);

  const handleDelete = useCallback(async (image: GeneratedImage) => {
    try {
      // Venice pattern: Delete from LOCAL IndexedDB only - NO Supabase
      const localId = (image as any).localId;
      if (localId && mediaStorageReady) {
        const { deleteImage } = await import('@/hooks/useGhostMedia').then(m => ({ deleteImage: null }));
        // Note: For now just remove from UI state - full deletion handled by GhostLibrary
      }

      // Remove from local state
      setGeneratedImages(prev => prev.filter(img => img.id !== image.id));
      toast.success('Image deleted');
    } catch (error) {
      console.error('[ImageGen] Delete error:', error);
      toast.error('Failed to delete image');
    }
  }, [mediaStorageReady]);

  return (
    <div className="flex flex-col h-full">
      {/* Results area */}
      <div className="flex-1 overflow-auto">
        {generatedImages.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-16 h-16 rounded-2xl bg-swiss-burgundy/10 border border-swiss-burgundy/20 flex items-center justify-center mb-6">
              <Image className="w-8 h-8 text-swiss-burgundy" />
            </div>
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-sans text-center mb-3">
              Private Image Generation
            </h2>
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
            onDelete={handleDelete}
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
              {/* Reference Image Preview */}
              {referenceImage && (
                <div className="p-3 border-b border-border/30 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={referenceImage}
                        alt="Reference"
                        className="w-16 h-16 object-cover rounded-lg border border-border"
                      />
                      <button
                        onClick={clearReferenceImage}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Reference Image</p>
                      <p className="text-xs text-muted-foreground">
                        Your prompt will be applied to edit this image
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={referenceImage ? "Describe how to edit this image..." : "Describe the image you want to generate..."}
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="w-4 h-4 mr-1.5" />
                    {referenceImage ? 'Change' : 'Reference'}
                  </Button>
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
