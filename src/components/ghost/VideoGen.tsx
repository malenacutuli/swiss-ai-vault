import { useState, useCallback, useRef, useEffect } from 'react';
import { Video, Film, Sparkles, Upload, Image as ImageIcon, Coins, Loader2, X } from '@/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SwissHeading, SwissCard } from '@/components/ui/swiss';
import { VideoGenSettings, VideoGenSettingsState } from './VideoGenSettings';
import { VideoGenModelSelector, VIDEO_MODELS } from './VideoGenModelSelector';
import { VideoPlayer, GeneratedVideo } from './VideoPlayer';
import { VideoGenProgress, VideoJob, useVideoJobs } from './VideoGenProgress';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VideoGenProps {
  initialImageUrl?: string;
}

type VideoMode = 'i2v' | 't2v';

export function VideoGen({ initialImageUrl }: VideoGenProps) {
  const { user } = useAuth();
  const { balance, formattedBalance, refreshCredits } = useGhostCredits();
  const { jobs, addJob, updateJob, removeJob } = useVideoJobs();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<VideoMode>(initialImageUrl ? 'i2v' : 't2v');
  const [prompt, setPrompt] = useState('');
  // Default to Replicate models - most reliable
  const [selectedModel, setSelectedModel] = useState(initialImageUrl ? 'replicate-svd' : 'replicate-animatediff');
  const [inputImage, setInputImage] = useState<string | null>(initialImageUrl || null);
  const [inputImageFile, setInputImageFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);

  // Persist generated videos locally per user so they survive tab switches
  const localKey = user?.id ? `ghost:videogen:recent:${user.id}` : null;
  useEffect(() => {
    if (!localKey) return;
    try {
      const raw = localStorage.getItem(localKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<Omit<GeneratedVideo, 'createdAt'> & { createdAt: string }>;
      const restored: GeneratedVideo[] = parsed.map((v) => ({
        ...v,
        createdAt: new Date(v.createdAt),
      }));
      setGeneratedVideos(restored);
    } catch {
      console.warn('[VideoGen] Failed to restore recent videos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localKey]);

  useEffect(() => {
    if (!localKey) return;
    try {
      const compact = generatedVideos.slice(0, 50).map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
      }));
      localStorage.setItem(localKey, JSON.stringify(compact));
    } catch {
      // ignore
    }
  }, [localKey, generatedVideos]);
  
  const [settings, setSettings] = useState<VideoGenSettingsState>({
    resolution: '720p',
    style: 'realistic',
    cameraMotion: 'none',
    duration: 5,
  });

  const currentModel = VIDEO_MODELS.find(m => m.id === selectedModel) || VIDEO_MODELS[0];
  
  // Calculate credit cost based on duration
  const durationMultiplier = settings.duration === 5 ? 1 : settings.duration === 10 ? 1.75 : 2.5;
  const totalCost = Math.round(currentModel.creditCost * durationMultiplier);
  const hasEnoughCredits = balance >= totalCost;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be less than 10MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setInputImage(event.target?.result as string);
        setInputImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearInputImage = () => {
    setInputImage(null);
    setInputImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const generateVideo = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to generate videos');
      return;
    }

    if (mode === 't2v' && !prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    if (mode === 'i2v' && !inputImage) {
      toast.error('Please select an image');
      return;
    }

    if (!hasEnoughCredits) {
      toast.error('Insufficient credits');
      return;
    }

    setIsGenerating(true);

    // Create a job for tracking
    const jobId = addJob({
      prompt: prompt || 'Image animation',
      model: currentModel.name,
      estimatedTime: settings.duration * 20, // Rough estimate
    });

    try {
      // Upload image if needed
      let imageUrl = inputImage;
      if (mode === 'i2v' && inputImageFile) {
        // For now, use base64 directly
        imageUrl = inputImage;
      }

      const { data, error } = await supabase.functions.invoke('ghost-video-gen', {
        body: {
          prompt: prompt.trim() || undefined,
          model: selectedModel,
          mode,
          inputImage: mode === 'i2v' ? imageUrl : undefined,
          duration: settings.duration,
          resolution: settings.resolution,
          style: settings.style,
          cameraMotion: settings.cameraMotion !== 'none' ? settings.cameraMotion : undefined,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Poll for completion if we get a task ID
      if (data.taskId) {
        updateJob(jobId, { status: 'processing', progress: 10 });
        await pollForCompletion(jobId, data.taskId);
      } else if (data.videoUrl) {
        // Direct response
        const newVideo: GeneratedVideo = {
          id: crypto.randomUUID(),
          url: data.videoUrl,
          prompt: prompt || 'Image animation',
          model: currentModel.name,
          duration: settings.duration,
          resolution: settings.resolution,
          createdAt: new Date(),
          isSaved: false,
        };

        updateJob(jobId, { status: 'completed', progress: 100, videoUrl: data.videoUrl });
        setGeneratedVideos(prev => [newVideo, ...prev]);
        refreshCredits();
        toast.success('Video generated!');

        // Auto-save to Library (fix: storage_type must be 'cloud' per schema)
        const { error: saveError } = await supabase.from('ghost_library').insert({
          user_id: user.id,
          content_type: 'video',
          storage_type: 'cloud',
          storage_key: newVideo.url,
          prompt: newVideo.prompt,
          model_id: newVideo.model,
          format: 'mp4',
          duration_seconds: newVideo.duration,
          title: newVideo.prompt.slice(0, 100),
        });

        if (!saveError) {
          setGeneratedVideos(prev => prev.map(v => (v.id === newVideo.id ? { ...v, isSaved: true } : v)));
        }
      }
    } catch (error) {
      console.error('[VideoGen] Error:', error);
      updateJob(jobId, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Generation failed' 
      });
      toast.error(error instanceof Error ? error.message : 'Failed to generate video');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, user, mode, inputImage, inputImageFile, selectedModel, settings, currentModel, hasEnoughCredits, addJob, updateJob, refreshCredits]);

  const pollForCompletion = async (jobId: string, taskId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    const poll = async () => {
      attempts++;
      
      try {
        const { data, error } = await supabase.functions.invoke('ghost-video-gen', {
          body: { checkStatus: true, taskId },
        });

        if (error) throw error;

        if (data.status === 'completed' && data.videoUrl) {
          const newVideo: GeneratedVideo = {
            id: crypto.randomUUID(),
            url: data.videoUrl,
            prompt: prompt || 'Image animation',
            model: currentModel.name,
            duration: settings.duration,
            resolution: settings.resolution,
            createdAt: new Date(),
            isSaved: false,
          };

          updateJob(jobId, { status: 'completed', progress: 100, videoUrl: data.videoUrl });
          setGeneratedVideos(prev => [newVideo, ...prev]);
          refreshCredits();
          toast.success('Video generated!');

          // Auto-save to Library (best-effort)
          const { error: saveError } = await supabase.from('ghost_library').insert({
            user_id: user.id,
            content_type: 'video',
            storage_type: 'cloud',
            storage_key: newVideo.url,
            prompt: newVideo.prompt,
            model_id: newVideo.model,
            format: 'mp4',
            duration_seconds: newVideo.duration,
            title: newVideo.prompt.slice(0, 100),
          });

          if (!saveError) {
            setGeneratedVideos(prev => prev.map(v => (v.id === newVideo.id ? { ...v, isSaved: true } : v)));
          }
          return;
        }

        if (data.status === 'failed') {
          throw new Error(data.error || 'Video generation failed');
        }

        // Update progress
        const progress = Math.min(10 + (attempts / maxAttempts) * 85, 95);
        updateJob(jobId, { progress });

        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          throw new Error('Video generation timed out');
        }
      } catch (error) {
        updateJob(jobId, { 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Polling failed' 
        });
      }
    };

    poll();
  };

  const handleDownload = async (video: GeneratedVideo) => {
    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghost-video-${video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Video downloaded');
    } catch (error) {
      toast.error('Failed to download video');
    }
  };

  const handleSave = async (video: GeneratedVideo) => {
    if (!user) return;

    try {
      await supabase.from('ghost_library').insert({
        user_id: user.id,
        content_type: 'video',
        storage_type: 'cloud',
        storage_key: video.url,
        prompt: video.prompt,
        model_id: video.model,
        format: 'mp4',
        duration_seconds: video.duration,
        title: video.prompt.slice(0, 100),
      });

      setGeneratedVideos(prev =>
        prev.map(v => (v.id === video.id ? { ...v, isSaved: true } : v))
      );
      toast.success('Saved to library');
    } catch (error) {
      toast.error('Failed to save video');
    }
  };

  const handleShare = async (video: GeneratedVideo) => {
    try {
      await navigator.clipboard.writeText(video.url);
      toast.success('Video URL copied to clipboard');
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  // Active jobs (not completed)
  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'processing');

  return (
    <div className="flex flex-col h-full">
      {/* Results area */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {generatedVideos.length === 0 && activeJobs.length === 0 && !isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-2xl bg-swiss-teal/10 border border-swiss-teal/20 flex items-center justify-center mb-6">
              <Video className="w-8 h-8 text-swiss-teal" />
            </div>
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-sans text-center mb-3">
              Private Video Generation
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
              Create stunning videos with cutting-edge AI. From text descriptions or images,
              generate videos that remain completely private.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Active jobs */}
            {activeJobs.map(job => (
              <VideoGenProgress
                key={job.id}
                job={job}
                onCancel={() => removeJob(job.id)}
              />
            ))}

            {/* Generated videos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedVideos.map(video => (
                <VideoPlayer
                  key={video.id}
                  video={video}
                  onDownload={() => handleDownload(video)}
                  onSave={() => handleSave(video)}
                  onShare={() => handleShare(video)}
                  className="aspect-video"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {/* Mode tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as VideoMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="t2v" className="flex items-center gap-2">
                <Film className="w-4 h-4" />
                Text to Video
              </TabsTrigger>
              <TabsTrigger value="i2v" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Image to Video
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Settings */}
          <VideoGenSettings settings={settings} onSettingsChange={setSettings} />

          {/* Model selector */}
          <VideoGenModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            mode={mode}
          />

          {/* Image upload for I2V */}
          {mode === 'i2v' && (
            <SwissCard className="p-4">
              {inputImage ? (
                <div className="relative inline-block">
                  <img 
                    src={inputImage} 
                    alt="Input" 
                    className="max-h-40 rounded-lg object-contain"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 w-6 h-6"
                    onClick={clearInputImage}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload an image
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    PNG, JPG up to 10MB
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </SwissCard>
          )}

          {/* Prompt input */}
          <SwissCard className="p-0 overflow-hidden">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === 't2v' 
                ? "Describe the video you want to generate..." 
                : "Describe how to animate the image (optional)..."
              }
              className="min-h-[80px] border-0 bg-transparent resize-none focus-visible:ring-0 text-base"
            />

            <div className="flex items-center justify-between p-3 border-t border-border/30 bg-muted/30">
              <div className="text-xs text-muted-foreground">
                {settings.duration}s · {settings.resolution} · {settings.style}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Coins className="w-4 h-4" />
                  <span className={cn(!hasEnoughCredits && 'text-destructive')}>
                    ~{totalCost} credits
                  </span>
                  <span className="text-muted-foreground/50">
                    ({formattedBalance} available)
                  </span>
                </div>

                <Button
                  onClick={generateVideo}
                  disabled={
                    isGenerating || 
                    !hasEnoughCredits || 
                    (mode === 't2v' && !prompt.trim()) ||
                    (mode === 'i2v' && !inputImage)
                  }
                  className="min-w-[120px]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
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
  );
}
