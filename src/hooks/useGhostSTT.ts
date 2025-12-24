import { useState, useCallback, useRef, useEffect } from 'react';
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

  // Lifecycle refs - critical for preventing state updates after unmount
  const isMountedRef = useRef<boolean>(true);
  const recordingIdRef = useRef<string | null>(null);
  
  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Safe state setter that checks mount status AND recording ID
  const safeSetState = useCallback((updates: Partial<STTState>, expectedRecordingId?: string) => {
    if (!isMountedRef.current) return;
    if (expectedRecordingId && recordingIdRef.current !== expectedRecordingId) return;
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Cleanup function - stops everything immediately
  const cleanup = useCallback(() => {
    // Stop animation frame loop FIRST - this is critical
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear recording ID to invalidate any pending callbacks
    const previousRecordingId = recordingIdRef.current;
    recordingIdRef.current = null;

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.onerror = null;
        mediaRecorderRef.current.stop();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    mediaRecorderRef.current = null;

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // Ignore
        }
      });
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Ignore
      }
    }
    audioContextRef.current = null;
    analyserRef.current = null;

    // Clear chunks
    audioChunksRef.current = [];
    
    return previousRecordingId;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Audio level monitoring loop - with strict lifecycle checks
  const updateAudioLevel = useCallback((currentRecordingId: string) => {
    // Triple-check we should continue
    if (!isMountedRef.current) return;
    if (recordingIdRef.current !== currentRecordingId) return;
    if (!analyserRef.current) return;

    try {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average amplitude
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const normalizedLevel = Math.min(100, (average / 128) * 100);

      safeSetState({ audioLevel: normalizedLevel }, currentRecordingId);

      // Continue loop only if still valid
      if (isMountedRef.current && recordingIdRef.current === currentRecordingId) {
        animationFrameRef.current = requestAnimationFrame(() => updateAudioLevel(currentRecordingId));
      }
    } catch (e) {
      // Stop loop on error
      console.error('[STT] Audio level error:', e);
    }
  }, [safeSetState]);

  const startRecording = useCallback(async () => {
    // Cleanup any previous recording
    cleanup();
    
    // Generate new recording ID - all callbacks must check this
    const currentRecordingId = crypto.randomUUID();
    recordingIdRef.current = currentRecordingId;
    
    safeSetState({ isRecording: false, isTranscribing: false, audioLevel: 0 });

    try {
      // Check for browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not supported');
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Check if still valid after async operation
      if (!isMountedRef.current || recordingIdRef.current !== currentRecordingId) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      // Set up audio analysis for visual feedback
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start level monitoring with the current recording ID
      animationFrameRef.current = requestAnimationFrame(() => updateAudioLevel(currentRecordingId));

      // Set up media recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
        
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        // Only process if this is still the current recording
        if (recordingIdRef.current !== currentRecordingId) return;
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        if (recordingIdRef.current === currentRecordingId && isMountedRef.current) {
          toast.error('Recording error occurred');
          cleanup();
          safeSetState({ isRecording: false, isTranscribing: false, audioLevel: 0 });
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      safeSetState({ isRecording: true }, currentRecordingId);
      
    } catch (error: any) {
      console.error('[STT] Failed to start recording:', error);
      cleanup();
      if (isMountedRef.current) {
        toast.error(error.message || 'Failed to access microphone');
        safeSetState({ isRecording: false, isTranscribing: false, audioLevel: 0 });
      }
    }
  }, [cleanup, safeSetState, updateAudioLevel]);

  const stopRecording = useCallback(async () => {
    const currentRecordingId = recordingIdRef.current;
    
    if (!mediaRecorderRef.current || !currentRecordingId || !state.isRecording) {
      return;
    }

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        cleanup();
        safeSetState({ isRecording: false, isTranscribing: false, audioLevel: 0 });
        resolve();
        return;
      }

      mediaRecorder.onstop = async () => {
        // Verify this is still the current recording
        if (recordingIdRef.current !== currentRecordingId || !isMountedRef.current) {
          cleanup();
          resolve();
          return;
        }

        safeSetState({ isRecording: false, isTranscribing: true, audioLevel: 0 }, currentRecordingId);

        try {
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          if (audioBlob.size === 0) {
            throw new Error('No audio recorded');
          }

          // Convert to base64
          const base64Audio = await new Promise<string>((resolveBase64, rejectBase64) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              // Check again before processing result
              if (!isMountedRef.current || recordingIdRef.current !== currentRecordingId) {
                resolveBase64('');
                return;
              }
              const result = reader.result as string;
              resolveBase64(result.split(',')[1] || '');
            };
            reader.onerror = () => rejectBase64(new Error('Failed to read audio'));
            reader.readAsDataURL(audioBlob);
          });

          // Check again after async operation
          if (!isMountedRef.current || recordingIdRef.current !== currentRecordingId || !base64Audio) {
            cleanup();
            resolve();
            return;
          }

          // Send to STT API
          const { data, error } = await supabase.functions.invoke('ghost-voice', {
            body: {
              action: 'stt',
              audio: base64Audio,
              language,
            },
          });

          // Final check before callback
          if (!isMountedRef.current) {
            resolve();
            return;
          }

          if (error) throw error;
          
          if (data?.text) {
            onTranscription?.(data.text);
          }
          
        } catch (error: any) {
          console.error('[STT] Transcription error:', error);
          if (isMountedRef.current) {
            toast.error('Failed to transcribe audio');
          }
        } finally {
          cleanup();
          if (isMountedRef.current) {
            safeSetState({ isRecording: false, isTranscribing: false, audioLevel: 0 });
          }
          resolve();
        }
      };

      // Stop animation frame before stopping recorder
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      try {
        mediaRecorder.stop();
      } catch (e) {
        cleanup();
        safeSetState({ isRecording: false, isTranscribing: false, audioLevel: 0 });
        resolve();
      }
    });
  }, [state.isRecording, language, onTranscription, cleanup, safeSetState]);

  const toggleRecording = useCallback(async () => {
    if (state.isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  const cancelRecording = useCallback(() => {
    cleanup();
    if (isMountedRef.current) {
      setState({
        isRecording: false,
        isTranscribing: false,
        audioLevel: 0,
      });
    }
  }, [cleanup]);

  return {
    ...state,
    startRecording,
    stopRecording,
    toggleRecording,
    cancelRecording,
  };
}
