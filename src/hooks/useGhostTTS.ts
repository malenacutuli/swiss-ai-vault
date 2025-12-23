import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

interface TTSOptions {
  voice?: TTSVoice;
  speed?: number;
}

interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentMessageId: string | null;
  progress: number;
}

export function useGhostTTS() {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    isLoading: false,
    currentMessageId: null,
    progress: 0,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const progressIntervalRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      sourceRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const speak = useCallback(async (
    text: string,
    messageId: string,
    options: TTSOptions = {}
  ) => {
    const { voice = 'alloy', speed = 1.0 } = options;

    // If same message is playing, toggle pause/play
    if (state.currentMessageId === messageId && state.isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
      }
      return;
    }

    // If same message is paused, resume
    if (state.currentMessageId === messageId && state.isPaused) {
      if (audioRef.current) {
        audioRef.current.play();
        setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
      }
      return;
    }

    // Stop any current playback
    cleanup();

    setState({
      isPlaying: false,
      isPaused: false,
      isLoading: true,
      currentMessageId: messageId,
      progress: 0,
    });

    try {
      const { data, error } = await supabase.functions.invoke('ghost-voice', {
        body: {
          action: 'tts',
          text,
          voice,
          speed,
        },
      });

      if (error) throw error;
      if (!data?.audioContent) throw new Error('No audio content received');

      // Decode base64 audio
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create audio blob and URL
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(blob);

      // Create and play audio element
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        durationRef.current = audio.duration;
      };

      audio.ontimeupdate = () => {
        if (durationRef.current > 0) {
          const progress = (audio.currentTime / durationRef.current) * 100;
          setState(prev => ({ ...prev, progress }));
        }
      };

      audio.onended = () => {
        cleanup();
        setState({
          isPlaying: false,
          isPaused: false,
          isLoading: false,
          currentMessageId: null,
          progress: 0,
        });
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        cleanup();
        setState({
          isPlaying: false,
          isPaused: false,
          isLoading: false,
          currentMessageId: null,
          progress: 0,
        });
        URL.revokeObjectURL(audioUrl);
        toast.error('Failed to play audio');
      };

      await audio.play();
      setState(prev => ({
        ...prev,
        isPlaying: true,
        isLoading: false,
      }));
    } catch (error) {
      console.error('TTS error:', error);
      toast.error('Failed to generate speech');
      setState({
        isPlaying: false,
        isPaused: false,
        isLoading: false,
        currentMessageId: null,
        progress: 0,
      });
    }
  }, [state.currentMessageId, state.isPlaying, state.isPaused, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setState({
      isPlaying: false,
      isPaused: false,
      isLoading: false,
      currentMessageId: null,
      progress: 0,
    });
  }, [cleanup]);

  const pause = useCallback(() => {
    if (audioRef.current && state.isPlaying) {
      audioRef.current.pause();
      setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
    }
  }, [state.isPlaying]);

  const resume = useCallback(() => {
    if (audioRef.current && state.isPaused) {
      audioRef.current.play();
      setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    }
  }, [state.isPaused]);

  return {
    ...state,
    speak,
    stop,
    pause,
    resume,
  };
}
