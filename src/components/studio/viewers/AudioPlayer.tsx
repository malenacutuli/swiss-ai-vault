import { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TranscriptItem {
  time: number;
  text: string;
}

interface AudioPlayerProps {
  url: string;
  title?: string;
  transcript?: TranscriptItem[];
}

export function AudioPlayer({ url, title, transcript }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !url) return;

    setIsLoading(true);
    setError(null);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(255,255,255,0.3)',
      progressColor: '#e63946',
      cursorColor: '#e63946',
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
    });

    wavesurferRef.current = ws;

    ws.load(url);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      setIsLoading(false);
    });

    ws.on('audioprocess', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('finish', () => setIsPlaying(false));

    ws.on('error', (err) => {
      setError('Failed to load audio');
      setIsLoading(false);
      console.error('WaveSurfer error:', err);
    });

    return () => {
      ws.destroy();
    };
  }, [url]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    wavesurferRef.current?.setPlaybackRate(speed);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = title || 'audio.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const seekToTime = (time: number) => {
    if (wavesurferRef.current && duration > 0) {
      wavesurferRef.current.seekTo(time / duration);
    }
  };

  if (error) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <p className="text-red-400 text-center">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="mt-4 mx-auto block text-white/60 hover:text-white"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      {title && <h3 className="text-lg font-medium text-white mb-4">{title}</h3>}

      {/* Waveform container */}
      <div ref={containerRef} className="mb-4 min-h-[80px]">
        {isLoading && (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="w-6 h-6 text-[#e63946] animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          disabled={isLoading}
          className="h-10 w-10 rounded-full bg-[#e63946] hover:bg-[#e63946]/90 text-white"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </Button>

        <Volume2 className="w-4 h-4 text-white/40" />

        <span className="text-sm text-white/60 tabular-nums min-w-[100px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <select
          value={playbackRate}
          onChange={(e) => handleSpeedChange(Number(e.target.value))}
          className="bg-white/10 border border-white/10 rounded px-2 py-1 text-sm text-white"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {/* Transcript */}
      {transcript && transcript.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-sm font-medium text-white/60 mb-3">Transcript</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {transcript.map((item, i) => (
              <p key={i} className="text-sm text-white/80">
                <button
                  onClick={() => seekToTime(item.time)}
                  className="text-[#e63946] mr-2 hover:underline font-mono text-xs"
                >
                  {formatTime(item.time)}
                </button>
                {item.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
