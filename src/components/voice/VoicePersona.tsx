import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Persona {
  id: string;
  name: string;
  description: string;
  voice: string;
}

const PERSONAS: Persona[] = [
  { id: 'health-advisor', name: 'Dr. Aria', description: 'Swiss healthcare advisor', voice: 'NATF2' },
  { id: 'financial-analyst', name: 'Marcus', description: 'Swiss private banking advisor', voice: 'NATM1' },
  { id: 'legal-assistant', name: 'Elena', description: 'Swiss legal assistant', voice: 'VARF1' },
  { id: 'research-assistant', name: 'Atlas', description: 'Research assistant', voice: 'NATM0' },
  { id: 'executive-assistant', name: 'Clara', description: 'Executive assistant', voice: 'NATF0' },
];

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface VoicePersonaProps {
  className?: string;
  onTranscript?: (text: string, isUser: boolean) => void;
}

export function VoicePersona({ className, onTranscript }: VoicePersonaProps) {
  const [selectedPersona, setSelectedPersona] = useState<string>('research-assistant');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsRecording(false);
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [cleanup]);

  const playAudioChunk = useCallback(async (audioData: ArrayBuffer) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    const ctx = audioContextRef.current;

    try {
      // Decode audio (assuming PCM from PersonaPlex)
      const audioBuffer = await ctx.decodeAudioData(audioData.slice(0));
      audioQueueRef.current.push(audioBuffer);

      if (!isPlayingRef.current) {
        playNextInQueue();
      }
    } catch (err) {
      console.error('[VoicePersona] Audio decode error:', err);
    }
  }, []);

  const playNextInQueue = useCallback(() => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const buffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = playNextInQueue;
    source.start();
  }, []);

  const connect = useCallback(async () => {
    cleanup();
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      // Get WebSocket URL from Supabase functions
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const wsUrl = supabaseUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      const ws = new WebSocket(
        `${wsUrl}/functions/v1/voice-persona`,
        ['Authorization', session.access_token]
      );

      // Set persona header via subprotocol
      ws.binaryType = 'arraybuffer';

      ws.onopen = async () => {
        console.log('[VoicePersona] Connected');
        setConnectionStatus('connected');

        // Send persona selection
        ws.send(JSON.stringify({
          type: 'persona',
          persona: selectedPersona
        }));

        // Start microphone
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 16000,
            }
          });
          streamRef.current = stream;

          // Set up audio analysis
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new AudioContext({ sampleRate: 16000 });
          }

          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;

          const source = audioContextRef.current.createMediaStreamSource(stream);
          source.connect(analyser);

          // Audio level monitoring
          const updateLevel = () => {
            if (!analyserRef.current) return;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(Math.min(average / 128, 1) * 100);
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          };
          animationFrameRef.current = requestAnimationFrame(updateLevel);

          // Set up MediaRecorder
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
          });

          mediaRecorder.ondataavailable = async (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              const arrayBuffer = await e.data.arrayBuffer();
              ws.send(arrayBuffer);
            }
          };

          mediaRecorder.start(100); // Send chunks every 100ms
          mediaRecorderRef.current = mediaRecorder;
          setIsRecording(true);

        } catch (err) {
          console.error('[VoicePersona] Microphone error:', err);
          setError('Microphone access denied');
        }
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Audio data from PersonaPlex
          playAudioChunk(event.data);
        } else {
          // JSON message (transcript, etc.)
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'transcript' && onTranscript) {
              onTranscript(msg.text, msg.isUser);
            } else if (msg.type === 'error') {
              setError(msg.message);
            }
          } catch {
            // Not JSON, ignore
          }
        }
      };

      ws.onerror = (e) => {
        console.error('[VoicePersona] WebSocket error:', e);
        setConnectionStatus('error');
        setError('Connection error');
      };

      ws.onclose = () => {
        console.log('[VoicePersona] Disconnected');
        setConnectionStatus('disconnected');
        cleanup();
      };

      wsRef.current = ws;

    } catch (err) {
      console.error('[VoicePersona] Connection error:', err);
      setConnectionStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [selectedPersona, cleanup, playAudioChunk, onTranscript]);

  const disconnect = useCallback(() => {
    cleanup();
    setConnectionStatus('disconnected');
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsRecording(audioTrack.enabled);
      }
    }
  }, []);

  const persona = PERSONAS.find(p => p.id === selectedPersona);
  const ringScale = 1 + (audioLevel / 100) * 0.3;

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Voice Persona</span>
          <Badge
            variant={
              connectionStatus === 'connected' ? 'default' :
              connectionStatus === 'connecting' ? 'secondary' :
              connectionStatus === 'error' ? 'destructive' : 'outline'
            }
          >
            {connectionStatus}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Persona Selector */}
        <Select
          value={selectedPersona}
          onValueChange={setSelectedPersona}
          disabled={connectionStatus !== 'disconnected'}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a persona" />
          </SelectTrigger>
          <SelectContent>
            {PERSONAS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Connection Controls */}
        <div className="flex items-center justify-center gap-4">
          {connectionStatus === 'disconnected' ? (
            <Button
              onClick={connect}
              className="bg-swiss-teal hover:bg-swiss-teal/90"
            >
              <Phone className="w-4 h-4 mr-2" />
              Start Conversation
            </Button>
          ) : connectionStatus === 'connecting' ? (
            <Button disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </Button>
          ) : (
            <>
              {/* Mic Toggle */}
              <Button
                variant={isRecording ? 'default' : 'outline'}
                size="icon"
                onClick={toggleMute}
                className="relative"
              >
                {isRecording && (
                  <span
                    className="absolute inset-0 rounded-md bg-swiss-teal/20 transition-transform duration-75"
                    style={{ transform: `scale(${ringScale})` }}
                  />
                )}
                {isRecording ? (
                  <Mic className="w-4 h-4 relative z-10" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
              </Button>

              {/* Speaking Indicator */}
              {isSpeaking && (
                <div className="flex items-center gap-1 text-swiss-sapphire">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span className="text-sm">{persona?.name} speaking...</span>
                </div>
              )}

              {/* Disconnect */}
              <Button
                variant="destructive"
                size="icon"
                onClick={disconnect}
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {/* Usage Note */}
        {connectionStatus === 'disconnected' && (
          <p className="text-xs text-muted-foreground text-center">
            Voice conversations require a Pro subscription.
            <br />
            Audio is processed in real-time on Swiss infrastructure.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default VoicePersona;
