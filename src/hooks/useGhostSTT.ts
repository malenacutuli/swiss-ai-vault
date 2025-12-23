import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface STTState {
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
}

interface UseGhostSTTOptions {
  language?: string;
  onTranscription?: (text: string) => void;
}

export function useGhostSTT(options: UseGhostSTTOptions = {}) {
  const { language = 'en', onTranscription } = options;

  const [state, setState] = useState<STTState>({
    isRecording: false,
    isTranscribing: false,
    audioLevel: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average amplitude
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedLevel = Math.min(100, (average / 128) * 100);

    setState(prev => ({ ...prev, audioLevel: normalizedLevel }));

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analysis for visual feedback
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start level monitoring
      updateAudioLevel();

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setState(prev => ({ ...prev, isRecording: true }));
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access microphone');
      cleanup();
    }
  }, [cleanup, updateAudioLevel]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !state.isRecording) return;

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        setState(prev => ({ ...prev, isRecording: false, isTranscribing: true, audioLevel: 0 }));

        try {
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];

            try {
              const { data, error } = await supabase.functions.invoke('ghost-voice', {
                body: {
                  action: 'stt',
                  audio: base64Audio,
                  language,
                },
              });

              if (error) throw error;
              if (data?.text) {
                onTranscription?.(data.text);
              }
            } catch (error) {
              console.error('STT error:', error);
              toast.error('Failed to transcribe audio');
            } finally {
              setState(prev => ({ ...prev, isTranscribing: false }));
              cleanup();
              resolve();
            }
          };
        } catch (error) {
          console.error('Failed to process audio:', error);
          toast.error('Failed to process audio');
          setState(prev => ({ ...prev, isTranscribing: false }));
          cleanup();
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  }, [state.isRecording, language, onTranscription, cleanup]);

  const toggleRecording = useCallback(async () => {
    if (state.isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  const cancelRecording = useCallback(() => {
    cleanup();
    setState({
      isRecording: false,
      isTranscribing: false,
      audioLevel: 0,
    });
  }, [cleanup]);

  return {
    ...state,
    startRecording,
    stopRecording,
    toggleRecording,
    cancelRecording,
  };
}
