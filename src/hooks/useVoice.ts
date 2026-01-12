// src/hooks/useVoice.ts
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const { data, error } = await supabase.functions.invoke('voice', {
            body: formData
          });

          if (error) throw error;

          resolve(data?.text || null);
        } catch (err: any) {
          setError(err.message);
          resolve(null);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    });
  }, []);

  const speak = useCallback(async (text: string, voice: string = 'alloy') => {
    setIsSpeaking(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('voice', {
        body: { text, voice, action: 'speak' }
      });

      if (error) throw error;

      if (data?.audio) {
        const audioBlob = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        const blob = new Blob([audioBlob], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);

        if (audioRef.current) {
          audioRef.current.pause();
        }

        audioRef.current = new Audio(url);
        audioRef.current.onended = () => setIsSpeaking(false);
        await audioRef.current.play();
      }
    } catch (err: any) {
      setError(err.message);
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return {
    isRecording,
    isTranscribing,
    isSpeaking,
    error,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking
  };
}
