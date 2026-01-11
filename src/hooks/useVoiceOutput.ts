import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseVoiceOutputOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
}

interface VoiceOutputState {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
}

// In-memory cache for TTS audio URLs
const audioCache = new Map<string, string>();

export function useVoiceOutput(options: UseVoiceOutputOptions = {}) {
  const { toast } = useToast();
  const { 
    voice = 'nova', 
    speed = 1.0,
  } = options;

  const [state, setState] = useState<VoiceOutputState>({
    isPlaying: false,
    isLoading: false,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTextRef = useRef<string | null>(null);

  const getCacheKey = (text: string) => `${voice}-${speed}-${text.substring(0, 100)}`;

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Stop any current playback first
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    currentTextRef.current = text;
    setState({ isPlaying: false, isLoading: true, error: null });

    try {
      let audioUrl: string;
      const cacheKey = getCacheKey(text);

      if (audioCache.has(cacheKey)) {
        audioUrl = audioCache.get(cacheKey)!;
      } else {
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-voice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: 'tts',
            text: text.substring(0, 4096),
            voice,
            speed,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'TTS failed' }));
          throw new Error(error.error || 'TTS failed');
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        audioCache.set(cacheKey, audioUrl);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setState(prev => ({ ...prev, isPlaying: true, isLoading: false }));
      };

      audio.onended = () => {
        setState(prev => ({ ...prev, isPlaying: false }));
        currentTextRef.current = null;
      };

      audio.onerror = () => {
        setState(prev => ({ ...prev, isPlaying: false, isLoading: false, error: 'Playback failed' }));
        currentTextRef.current = null;
      };

      await audio.play();

    } catch (error: any) {
      console.error('[useVoiceOutput] Error:', error);
      setState(prev => ({ ...prev, isLoading: false, error: error.message }));
      
      toast({
        title: 'Voice Playback Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [voice, speed, toast]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    currentTextRef.current = null;
    setState(prev => ({ ...prev, isPlaying: false, isLoading: false }));
  }, []);

  const toggle = useCallback((text: string) => {
    if (state.isPlaying && currentTextRef.current === text) {
      stop();
    } else {
      speak(text);
    }
  }, [state.isPlaying, stop, speak]);

  return {
    ...state,
    speak,
    stop,
    toggle,
  };
}
