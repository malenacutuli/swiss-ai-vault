import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Download, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import WaveSurfer from 'wavesurfer.js';

interface AudioWaveformPlayerProps {
  audioUrl: string;
  title?: string;
  subtitle?: string;
  onShare?: () => void;
  className?: string;
}

export function AudioWaveformPlayer({ 
  audioUrl, 
  title, 
  subtitle, 
  onShare,
  className 
}: AudioWaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    setIsLoading(true);
    setIsReady(false);

    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'hsl(var(--muted-foreground) / 0.3)',
      progressColor: 'hsl(var(--primary))',
      cursorColor: 'hsl(var(--primary))',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 60,
      normalize: true,
    });

    wavesurfer.current.load(audioUrl);

    wavesurfer.current.on('ready', () => {
      setIsReady(true);
      setIsLoading(false);
      setDuration(wavesurfer.current?.getDuration() || 0);
      wavesurfer.current?.setVolume(volume);
    });

    wavesurfer.current.on('audioprocess', () => {
      setCurrentTime(wavesurfer.current?.getCurrentTime() || 0);
    });

    wavesurfer.current.on('play', () => setIsPlaying(true));
    wavesurfer.current.on('pause', () => setIsPlaying(false));
    wavesurfer.current.on('finish', () => setIsPlaying(false));

    wavesurfer.current.on('error', (err) => {
      console.error('[AudioWaveformPlayer] Error:', err);
      setIsLoading(false);
    });

    return () => {
      wavesurfer.current?.destroy();
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!isReady) return;
    wavesurfer.current?.playPause();
  };

  const skip = (seconds: number) => {
    if (!isReady) return;
    const current = wavesurfer.current?.getCurrentTime() || 0;
    const newTime = Math.max(0, Math.min(current + seconds, duration));
    wavesurfer.current?.setTime(newTime);
  };

  const toggleMute = () => {
    if (!isReady) return;
    if (isMuted) {
      wavesurfer.current?.setVolume(volume);
    } else {
      wavesurfer.current?.setVolume(0);
    }
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    wavesurfer.current?.setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${title || 'audio'}.mp3`;
    a.click();
  };

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card overflow-hidden",
      className
    )}>
      {/* Header */}
      {(title || subtitle) && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          {title && <h3 className="font-semibold text-foreground text-sm">{title}</h3>}
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}

      {/* Waveform */}
      <div className="px-4 py-4">
        <div 
          ref={containerRef} 
          className={cn(
            "w-full cursor-pointer",
            isLoading && "opacity-50"
          )}
        />
        
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
            Loading audio...
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 space-y-3">
        {/* Time Display */}
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Skip Back */}
            <button
              onClick={() => skip(-10)}
              disabled={!isReady}
              className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              title="Skip back 10s"
            >
              <SkipBack className="w-4 h-4 text-foreground" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              disabled={!isReady}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            {/* Skip Forward */}
            <button
              onClick={() => skip(10)}
              disabled={!isReady}
              className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              title="Skip forward 10s"
            >
              <SkipForward className="w-4 h-4 text-foreground" />
            </button>
          </div>

          {/* Volume & Actions */}
          <div className="flex items-center gap-2">
            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                disabled={!isReady}
                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="w-4 h-4 text-foreground" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                disabled={!isReady}
                className="w-16 h-1 accent-primary disabled:opacity-50"
              />
            </div>

            {/* Share */}
            {onShare && (
              <button
                onClick={onShare}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title="Share"
              >
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
            )}

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={!isReady}
              className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              title="Download"
            >
              <Download className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
