// src/components/memory/VoiceChatMemory.tsx
// Voice conversation UI with STT/TTS and memory save

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Mic, 
  MicOff,
  Volume2,
  VolumeX,
  Save,
  Brain,
  Trash2,
  Settings,
  Loader2,
  Square,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { type VoiceMessage, formatVoiceTranscript } from '@/lib/memory/voice-memory';

interface VoiceChatMemoryProps {
  encryptionKey?: CryptoKey;
  onSave?: (transcript: string, messages: VoiceMessage[]) => Promise<void>;
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy (Neutral)' },
  { value: 'echo', label: 'Echo (Male)' },
  { value: 'fable', label: 'Fable (British)' },
  { value: 'onyx', label: 'Onyx (Deep)' },
  { value: 'nova', label: 'Nova (Female)' },
  { value: 'shimmer', label: 'Shimmer (Soft)' },
];

export function VoiceChatMemory({ encryptionKey, onSave }: VoiceChatMemoryProps) {
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState('nova');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      try { audioContextRef.current?.close(); } catch {}
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    chunksRef.current = [];
    mediaRecorderRef.current = null;
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isMountedRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(Math.min(100, (average / 128) * 100));
    
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (chunksRef.current.length === 0) return;
        
        setIsTranscribing(true);
        
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            
            const { data, error } = await supabase.functions.invoke('ghost-voice', {
              body: { action: 'stt', audio: base64 },
            });

            if (error || !data?.text) {
              toast.error('Transcription failed');
              setIsTranscribing(false);
              return;
            }

            await handleTranscript(data.text);
            setIsTranscribing(false);
          };
          
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error('[Voice] STT error:', err);
          toast.error('Failed to transcribe');
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    } catch (err) {
      console.error('[Voice] Mic access error:', err);
      toast.error('Microphone access denied');
    }
  }, [updateAudioLevel]);

  const stopRecording = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  async function handleTranscript(transcript: string) {
    if (!transcript.trim()) {
      toast.info('No speech detected');
      return;
    }

    const userMessage: VoiceMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: transcript,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const response = await supabase.functions.invoke('ghost-inference', {
        body: {
          messages: [
            { 
              role: 'system', 
              content: 'You are a helpful voice assistant. Keep responses concise (2-3 sentences) since they will be spoken. Be warm and conversational.' 
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: transcript }
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 200,
        },
      });

      const assistantContent = response.data?.choices?.[0]?.message?.content || 'Sorry, I could not process that.';

      const assistantMessage: VoiceMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (autoSpeak) {
        await speakText(assistantContent);
      }
    } catch (error) {
      console.error('[Voice] Chat error:', error);
      toast.error('Failed to get response');
    } finally {
      setIsProcessing(false);
    }
  }

  async function speakText(text: string) {
    setIsSpeaking(true);
    try {
      const { data, error } = await supabase.functions.invoke('ghost-voice', {
        body: {
          action: 'tts',
          text: text.slice(0, 4096),
          voice: selectedVoice,
          speed: 1.0,
        },
      });

      if (error) throw error;

      const blob = data instanceof Blob ? data : new Blob([data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      };
      
      await audio.play();
    } catch (error) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  async function handleSaveToMemory() {
    if (messages.length === 0) {
      toast.info('No messages to save');
      return;
    }

    if (!onSave) {
      toast.error('Memory not available');
      return;
    }

    try {
      const transcript = formatVoiceTranscript(messages);
      await onSave(transcript, messages);
      
      toast.success('Saved to Memory', {
        description: `${messages.length} voice messages saved`,
      });

      if (autoSave) {
        setMessages([]);
      }
    } catch (error) {
      toast.error('Save failed');
    }
  }

  function clearChat() {
    stopSpeaking();
    cleanup();
    setMessages([]);
    setIsRecording(false);
    setIsTranscribing(false);
    setIsProcessing(false);
  }

  const ringScale = 1 + (audioLevel / 100) * 0.5;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Voice Chat</CardTitle>
            {messages.length > 0 && (
              <Badge variant="secondary">{messages.length}</Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {showSettings && (
          <div className="pt-3 space-y-3 border-t mt-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm text-muted-foreground w-24">AI Voice</Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="flex-1 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map(voice => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Auto-speak responses</Label>
              <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Clear after saving</Label>
              <Switch checked={autoSave} onCheckedChange={setAutoSave} />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <div className="relative mb-4">
                  <Mic className={cn(
                    "h-12 w-12 transition-colors",
                    isRecording ? "text-red-500" : "text-muted-foreground/50"
                  )} />
                  {isRecording && (
                    <span 
                      className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
                      style={{ transform: `scale(${ringScale})` }}
                    />
                  )}
                </div>
                <p className="font-medium">Tap the microphone to speak</p>
                <p className="text-sm mt-1">Your voice conversations are saved to memory</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  )}>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-3">
              <Button
                variant={isRecording ? "destructive" : "default"}
                size="lg"
                className="relative rounded-full h-14 w-14"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing || isProcessing}
              >
                {isTranscribing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-5 w-5" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
                {isRecording && (
                  <span
                    className="absolute inset-0 rounded-full bg-red-500/20 transition-transform"
                    style={{ transform: `scale(${ringScale})` }}
                  />
                )}
              </Button>

              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-red-500 rounded-full transition-all"
                        style={{ height: `${Math.max(8, audioLevel * (0.3 + i * 0.15))}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">Listening...</span>
                </div>
              )}

              {isTranscribing && (
                <span className="text-sm text-muted-foreground">Transcribing...</span>
              )}

              {isProcessing && (
                <span className="text-sm text-muted-foreground">Thinking...</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isSpeaking && (
                <Button variant="ghost" size="icon" onClick={stopSpeaking}>
                  <VolumeX className="h-4 w-4" />
                </Button>
              )}
              
              {messages.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleSaveToMemory}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="ghost" size="icon" onClick={clearChat}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
