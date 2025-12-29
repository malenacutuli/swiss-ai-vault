import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, X, Loader2 } from '@/icons';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  language?: string;
  className?: string;
}

/**
 * Self-contained voice input button with its own STT logic.
 * This component encapsulates all audio recording and transcription,
 * preventing hook lifecycle issues in parent components.
 */
export function VoiceInputButton({ 
  onTranscript, 
  disabled = false, 
  language = 'en',
  className 
}: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Lifecycle refs
  const isMountedRef = useRef(true);
  const recordingIdRef = useRef<string | null>(null);
  
  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop animation frame FIRST
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    mediaRecorderRef.current = null;

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignore
      }
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    chunksRef.current = [];
    recordingIdRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Audio level monitoring
  const updateAudioLevel = useCallback((analyser: AnalyserNode, currentRecordingId: string) => {
    if (!isMountedRef.current) return;
    if (recordingIdRef.current !== currentRecordingId) return;
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const tick = () => {
      if (!isMountedRef.current || recordingIdRef.current !== currentRecordingId) return;
      
      try {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(average / 128, 1) * 100;
        setAudioLevel(normalized);
        
        animationFrameRef.current = requestAnimationFrame(tick);
      } catch {
        // Stop on error
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const startRecording = useCallback(async () => {
    cleanup();
    
    const currentRecordingId = crypto.randomUUID();
    recordingIdRef.current = currentRecordingId;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      if (!isMountedRef.current || recordingIdRef.current !== currentRecordingId) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      // Set up audio analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      updateAudioLevel(analyser, currentRecordingId);

      // Set up media recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (recordingIdRef.current !== currentRecordingId) return;
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

    } catch (err: any) {
      console.error('[Voice] Start error:', err);
      cleanup();
      if (isMountedRef.current) {
        setIsRecording(false);
      }
    }
  }, [cleanup, updateAudioLevel]);

  const stopRecording = useCallback(async () => {
    const currentRecordingId = recordingIdRef.current;
    
    if (!mediaRecorderRef.current || !currentRecordingId) {
      return;
    }

    setIsProcessing(true);

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        cleanup();
        if (isMountedRef.current) {
          setIsRecording(false);
          setIsProcessing(false);
          setAudioLevel(0);
        }
        resolve();
        return;
      }

      mediaRecorder.onstop = async () => {
        if (recordingIdRef.current !== currentRecordingId || !isMountedRef.current) {
          cleanup();
          resolve();
          return;
        }

        try {
          const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
          
          if (audioBlob.size > 0) {
            // Convert to base64
            const reader = new FileReader();
            reader.onloadend = async () => {
              if (!isMountedRef.current) return;
              
              try {
                const base64 = (reader.result as string).split(',')[1];
                
                const { data, error } = await supabase.functions.invoke('ghost-voice', {
                  body: {
                    action: 'stt',
                    audio: base64,
                    language,
                  },
                });

                if (!isMountedRef.current) return;

                if (error) throw error;
                
                if (data?.text) {
                  onTranscript(data.text);
                }
              } catch (err) {
                console.error('[Voice] Transcription error:', err);
              } finally {
                if (isMountedRef.current) {
                  setIsProcessing(false);
                  setAudioLevel(0);
                }
              }
            };
            
            reader.readAsDataURL(audioBlob);
          }
        } catch (err) {
          console.error('[Voice] Process error:', err);
        } finally {
          cleanup();
          if (isMountedRef.current) {
            setIsRecording(false);
          }
        }
        
        resolve();
      };

      try {
        mediaRecorder.stop();
      } catch {
        cleanup();
        if (isMountedRef.current) {
          setIsRecording(false);
          setIsProcessing(false);
          setAudioLevel(0);
        }
        resolve();
      }
    });
  }, [cleanup, language, onTranscript]);

  const cancelRecording = useCallback(() => {
    cleanup();
    if (isMountedRef.current) {
      setIsRecording(false);
      setIsProcessing(false);
      setAudioLevel(0);
    }
  }, [cleanup]);

  const handleClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Calculate ring scale for audio level indicator
  const ringScale = 1 + (audioLevel / 100) * 0.5;

  if (isProcessing) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled
            className={cn('h-8 w-8 text-swiss-sapphire', className)}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Transcribing...</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-8 w-8 transition-all duration-150',
            isRecording && 'text-swiss-burgundy',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
          onClick={handleClick}
          onContextMenu={(e) => {
            e.preventDefault();
            if (isRecording) {
              cancelRecording();
            }
          }}
          disabled={disabled}
        >
          {/* Audio level ring */}
          {isRecording && (
            <>
              <span
                className="absolute inset-0 rounded-lg bg-swiss-burgundy/20 transition-transform duration-75"
                style={{ transform: `scale(${ringScale})` }}
              />
              <span className="absolute inset-0 rounded-lg bg-swiss-burgundy/10 animate-ping" />
            </>
          )}
          
          {isRecording ? (
            <Square className="w-4 h-4 relative z-10" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isRecording ? 'Click to stop (right-click to cancel)' : 'Voice input'}
      </TooltipContent>
    </Tooltip>
  );
}

export default VoiceInputButton;
