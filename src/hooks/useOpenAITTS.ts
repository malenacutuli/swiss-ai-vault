// src/hooks/useOpenAITTS.ts
// OpenAI-powered Text-to-Speech hook using ghost-voice edge function

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

interface UseTTSState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  progress: number;
  currentMessageId: string | null;
}

interface UseOpenAITTSReturn extends UseTTSState {
  speak: (text: string, messageId: string, voice?: TTSVoice) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useOpenAITTS(): UseOpenAITTSReturn {
  const [state, setState] = useState<UseTTSState>({
    isPlaying: false,
    isPaused: false,
    isLoading: false,
    progress: 0,
    currentMessageId: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const safeSetState = useCallback((updates: Partial<UseTTSState>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const fallbackToWebSpeech = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-'));
    if (englishVoice) utterance.voice = englishVoice;
    utterance.rate = 1.0;

    utterance.onstart = () => safeSetState({ isPlaying: true, isLoading: false });
    utterance.onend = () => safeSetState({ isPlaying: false, isPaused: false, currentMessageId: null, progress: 100 });
    utterance.onerror = () => safeSetState({ isPlaying: false, isPaused: false, isLoading: false });

    window.speechSynthesis.speak(utterance);
  }, [safeSetState]);

  const speak = useCallback(async (text: string, messageId: string, voice: TTSVoice = 'nova') => {
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    }
    window.speechSynthesis?.cancel();

    safeSetState({
      isLoading: true,
      isPlaying: false,
      isPaused: false,
      progress: 0,
      currentMessageId: messageId,
    });

    try {
      // Call ghost-voice TTS endpoint
      const { data, error } = await supabase.functions.invoke('ghost-voice', {
        body: {
          action: 'tts',
          text: text.slice(0, 4096), // API limit
          voice,
          speed: 1.0,
        },
      });

      if (error) throw error;

      // The edge function returns raw audio data - check if it's an ArrayBuffer or if we got JSON
      if (data instanceof ArrayBuffer || data instanceof Blob) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        // Track progress
        audio.addEventListener('timeupdate', () => {
          if (audio.duration && isMountedRef.current) {
            safeSetState({ progress: (audio.currentTime / audio.duration) * 100 });
          }
        });

        audio.addEventListener('ended', () => {
          safeSetState({
            isPlaying: false,
            isPaused: false,
            progress: 100,
            currentMessageId: null,
          });
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
        });

        audio.addEventListener('error', (e) => {
          console.error('[TTS] Audio playback error:', e);
          safeSetState({ isPlaying: false, isLoading: false });
          fallbackToWebSpeech(text);
        });

        safeSetState({ isLoading: false, isPlaying: true });
        await audio.play();
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        // Unexpected response format - try fallback
        throw new Error('Unexpected TTS response format');
      }
    } catch (error) {
      console.error('[TTS] API error, falling back to Web Speech:', error);
      fallbackToWebSpeech(text);
    }
  }, [safeSetState, fallbackToWebSpeech]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      safeSetState({ isPaused: true });
    } else if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause();
      safeSetState({ isPaused: true });
    }
  }, [safeSetState]);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      safeSetState({ isPaused: false });
    } else if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
      safeSetState({ isPaused: false });
    }
  }, [safeSetState]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    }
    window.speechSynthesis?.cancel();
    safeSetState({
      isPlaying: false,
      isPaused: false,
      progress: 0,
      currentMessageId: null,
    });
  }, [safeSetState]);

  return {
    ...state,
    speak,
    pause,
    resume,
    stop,
  };
}
