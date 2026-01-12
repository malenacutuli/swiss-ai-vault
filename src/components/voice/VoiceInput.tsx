// src/components/voice/VoiceInput.tsx
import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoice } from '@/hooks/useVoice';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
}

export function VoiceInput({ onTranscription }: VoiceInputProps) {
  const { isRecording, isTranscribing, startRecording, stopRecording, error } = useVoice();

  const handleToggleRecording = async () => {
    if (isRecording) {
      const text = await stopRecording();
      if (text) {
        onTranscription(text);
      }
    } else {
      await startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={isRecording ? "destructive" : "outline"}
        size="icon"
        onClick={handleToggleRecording}
        disabled={isTranscribing}
        className={isRecording ? 'animate-pulse' : ''}
      >
        {isTranscribing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}

interface VoiceOutputProps {
  onSpeak: () => void;
  onStop: () => void;
  isSpeaking: boolean;
}

export function VoiceOutput({ onSpeak, onStop, isSpeaking }: VoiceOutputProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={isSpeaking ? onStop : onSpeak}
    >
      {isSpeaking ? (
        <VolumeX className="w-4 h-4" />
      ) : (
        <Volume2 className="w-4 h-4" />
      )}
    </Button>
  );
}
