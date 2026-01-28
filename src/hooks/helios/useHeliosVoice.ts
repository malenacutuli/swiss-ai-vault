/**
 * HELIOS Voice Hook
 * Handles voice recording and transcription
 */

import { useState, useCallback, useRef } from 'react';
import type { SupportedLanguage, EmotionAnalysis } from '@/lib/helios/types';

interface VoiceResult {
  transcript: string;
  emotion?: EmotionAnalysis;
}

export function useHeliosVoice(language: SupportedLanguage) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.start(100); // Collect data every 100ms
      setIsRecording(true);

    } catch (err) {
      setError('Microphone access denied');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<VoiceResult | null> => {
    if (!mediaRecorder.current) return null;

    return new Promise((resolve) => {
      mediaRecorder.current!.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });

          // Convert to base64 for API
          const base64 = await blobToBase64(audioBlob);

          // Call voice processing API
          const response = await fetch('/api/helios/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: base64,
              language,
            }),
          });

          if (!response.ok) throw new Error('Voice processing failed');

          const result: VoiceResult = await response.json();
          resolve(result);

        } catch (err) {
          setError(err instanceof Error ? err.message : 'Voice processing failed');
          resolve(null);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.current!.stop();
      mediaRecorder.current!.stream.getTracks().forEach(track => track.stop());
    });
  }, [language]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  }, [isRecording]);

  return {
    isRecording,
    isProcessing,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
