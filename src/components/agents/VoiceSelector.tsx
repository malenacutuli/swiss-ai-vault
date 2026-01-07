import { useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GEMINI_VOICES, VOICE_CATEGORIES } from '@/lib/google-ai';
import { supabase } from '@/integrations/supabase/client';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  showPreview?: boolean;
}

export function VoiceSelector({
  selectedVoice,
  onVoiceChange,
  showPreview = true,
}: VoiceSelectorProps) {
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  const previewVoice = async (voice: string) => {
    if (isPreviewPlaying) return;
    
    setIsPreviewPlaying(true);
    setPreviewingVoice(voice);
    
    try {
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { 
          text: 'Hello, this is a preview of my voice.',
          voice 
        },
      });

      if (error) throw error;
      if (!data?.audio) throw new Error('No audio returned');

      // Convert base64 to audio
      const audioBlob = base64ToBlob(data.audio, data.mimeType || 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioElement = new Audio(audioUrl);
      
      audioElement.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPreviewPlaying(false);
        setPreviewingVoice(null);
      };
      
      await audioElement.play();
    } catch (err) {
      console.error('Voice preview failed:', err);
      setIsPreviewPlaying(false);
      setPreviewingVoice(null);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground">Select Voice</h3>
      
      {VOICE_CATEGORIES.map((category) => (
        <div key={category.key} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {category.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {category.description}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {GEMINI_VOICES[category.key]?.map((voice) => (
              <button
                key={voice}
                type="button"
                onClick={() => onVoiceChange(voice)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors',
                  selectedVoice === voice
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {voice}
                {showPreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      previewVoice(voice);
                    }}
                    disabled={isPreviewPlaying}
                    className="p-0.5 rounded hover:bg-black/5 disabled:opacity-50"
                  >
                    {previewingVoice === voice ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
