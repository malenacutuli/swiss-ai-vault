import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseVoiceInputOptions {
  onTranscription?: (text: string) => void;
  onError?: (error: Error) => void;
  language?: string;
  onAudioReady?: (audioBlob: Blob, transcript: string) => void;
}

interface VoiceInputState {
  isRecording: boolean;
  isProcessing: boolean;
  duration: number;
  error: string | null;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const { toast } = useToast();
  const { 
    onTranscription, 
    onError, 
    language = 'en',
    onAudioReady,
  } = options;

  const [state, setState] = useState<VoiceInputState>({
    isRecording: false,
    isProcessing: false,
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        await processAudio(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      setState(prev => ({ ...prev, isRecording: true, duration: 0, error: null }));
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

    } catch (error: any) {
      console.error('[useVoiceInput] Start error:', error);
      setState(prev => ({ ...prev, error: error.message }));
      
      if (error.name === 'NotAllowedError') {
        toast({
          title: 'Microphone Access Denied',
          description: 'Please allow microphone access in your browser settings.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Recording Failed',
          description: error.message,
          variant: 'destructive',
        });
      }
      
      onError?.(error);
    }
  }, [toast, onError]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      setState(prev => ({ ...prev, isRecording: false, isProcessing: true }));
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [state.isRecording]);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    setState({ isRecording: false, isProcessing: false, duration: 0, error: null });
  }, []);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'stt',
          audio: audioBase64,
          language,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }

      const data = await response.json();
      const transcript = data.text?.trim();

      if (transcript) {
        onTranscription?.(transcript);
        onAudioReady?.(audioBlob, transcript);
      } else {
        toast({
          title: 'No Speech Detected',
          description: 'Please speak clearly and try again.',
        });
      }

    } catch (error: any) {
      console.error('[useVoiceInput] Process error:', error);
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
      
      toast({
        title: 'Transcription Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [language, onTranscription, onError, onAudioReady, toast]);

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  };
}
