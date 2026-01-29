/**
 * Hume EVI (Empathic Voice Interface) Hook for HELIOS
 * Speech-to-speech voice consultations with emotion detection
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface HumeMessage {
  type: 'user_message' | 'assistant_message' | 'tool_call' | 'tool_result' | 'error';
  content?: string;
  emotion?: {
    name: string;
    score: number;
  }[];
  tool_name?: string;
  tool_params?: Record<string, unknown>;
  timestamp: string;
}

export interface UseHumeEVIOptions {
  sessionId: string;
  specialty?: string;
  language?: string;
  onMessage?: (message: HumeMessage) => void;
  onEmotionDetected?: (emotions: [string, number][]) => void;
  onTranscriptUpdate?: (transcript: HumeMessage[]) => void;
  onConsultationEnd?: (summary: Record<string, unknown>) => void;
}

export function useHumeEVI(options: UseHumeEVIOptions) {
  const {
    sessionId,
    specialty = 'primary-care',
    language = 'en',
    onMessage,
    onEmotionDetected,
    onTranscriptUpdate,
    onConsultationEnd,
  } = options;

  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<HumeMessage[]>([]);
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Initialize Hume EVI connection
  const connect = useCallback(async () => {
    try {
      console.log('[Hume EVI] Connecting...', { sessionId, specialty, language });
      
      // Get access token from backend
      const { data, error } = await supabase.functions.invoke('helios-hume-evi', {
        body: {
          action: 'get_access_token',
          session_id: sessionId,
          specialty,
          language,
        },
      });

      if (error) {
        console.error('[Hume EVI] Token error:', error);
        throw error;
      }

      const { accessToken, systemPrompt } = data;
      console.log('[Hume EVI] Got access token, connecting to WebSocket');

      // Connect to Hume EVI WebSocket with the access token
      // Use the correct Hume EVI WebSocket URL format
      const wsUrl = `wss://api.hume.ai/v0/evi/chat?access_token=${accessToken}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Hume EVI] Connected');
        setIsConnected(true);
        
        // Send initial configuration with system prompt
        ws.send(JSON.stringify({
          type: 'session_settings',
          system_prompt: systemPrompt,
          language: language,
        }));
        
        toast({
          title: 'Voice consultation ready',
          description: 'Click the microphone to start speaking.',
        });
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleHumeMessage(message);
      };

      ws.onerror = (error) => {
        console.error('[Hume EVI] WebSocket error:', error);
        toast({
          title: 'Connection error',
          description: 'Voice consultation unavailable. Please try again.',
          variant: 'destructive',
        });
      };

      ws.onclose = () => {
        console.log('[Hume EVI] Disconnected');
        setIsConnected(false);
        setIsListening(false);
      };

    } catch (err) {
      console.error('[Hume EVI] Connection error:', err);
      toast({
        title: 'Failed to start voice consultation',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
    }
  }, [sessionId, specialty, language, toast]);

  // Handle incoming Hume messages
  const handleHumeMessage = useCallback((message: Record<string, unknown>) => {
    console.log('[Hume EVI] Message received:', message.type);
    
    switch (message.type) {
      case 'user_message': {
        // User's transcribed speech
        const msgData = message.message as { content: string } | undefined;
        const modelsData = message.models as { prosody?: { scores: Record<string, number> } } | undefined;
        
        const userMsg: HumeMessage = {
          type: 'user_message',
          content: msgData?.content || '',
          emotion: modelsData?.prosody?.scores 
            ? Object.entries(modelsData.prosody.scores).map(([name, score]) => ({ name, score }))
            : undefined,
          timestamp: new Date().toISOString(),
        };
        setTranscript(prev => [...prev, userMsg]);
        onMessage?.(userMsg);
        
        // Handle emotion detection
        if (modelsData?.prosody?.scores) {
          const topEmotions = Object.entries(modelsData.prosody.scores)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3) as [string, number][];
          setCurrentEmotion(topEmotions[0]?.[0] || null);
          onEmotionDetected?.(topEmotions);
        }
        break;
      }

      case 'assistant_message': {
        // AI speaking
        setIsSpeaking(true);
        const msgData = message.message as { content: string } | undefined;
        
        const aiMsg: HumeMessage = {
          type: 'assistant_message',
          content: msgData?.content || '',
          timestamp: new Date().toISOString(),
        };
        setTranscript(prev => [...prev, aiMsg]);
        onMessage?.(aiMsg);
        break;
      }

      case 'assistant_end':
        // AI finished speaking
        setIsSpeaking(false);
        break;

      case 'tool_call': {
        // Handle tool call from Hume
        const toolName = message.tool_name as string;
        const parameters = message.parameters as Record<string, unknown>;
        handleToolCall(toolName, parameters);
        break;
      }

      case 'audio': {
        // Play audio response
        const audioData = message.data as string;
        playAudioResponse(audioData);
        break;
      }

      case 'chat_end': {
        // Consultation ended
        const summary = message.summary as Record<string, unknown>;
        onConsultationEnd?.(summary);
        saveTranscript();
        break;
      }

      case 'error':
        console.error('[Hume EVI] Error:', message);
        toast({
          title: 'Voice error',
          description: (message.message as string) || 'An error occurred',
          variant: 'destructive',
        });
        break;
    }
  }, [onMessage, onEmotionDetected, onConsultationEnd, toast]);

  // Handle tool calls from Hume
  const handleToolCall = async (toolName: string, params: Record<string, unknown>) => {
    console.log('[Hume EVI] Tool call:', toolName, params);
    
    const { data } = await supabase.functions.invoke('helios-hume-evi', {
      body: {
        action: 'handle_tool_call',
        tool_name: toolName,
        parameters: params,
        session_id: sessionId,
      },
    });

    // Send result back to Hume
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'tool_result',
        tool_call_id: params.tool_call_id,
        result: data,
      }));
    }
  };

  // Start listening (send audio to Hume)
  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: 'Not connected',
        description: 'Please wait for connection to establish.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('[Hume EVI] Requesting microphone access');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = convertFloat32ToInt16(inputData);
          const base64Audio = arrayBufferToBase64(pcmData.buffer);
          
          wsRef.current.send(JSON.stringify({
            type: 'audio_input',
            data: base64Audio,
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      setIsListening(true);
      console.log('[Hume EVI] Listening started');
      
    } catch (err) {
      console.error('[Hume EVI] Microphone error:', err);
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access for voice consultation.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Stop listening
  const stopListening = useCallback(() => {
    console.log('[Hume EVI] Stopping listening');
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Play audio response from Hume
  const playAudioResponse = useCallback((base64Audio: string) => {
    try {
      const audioData = atob(base64Audio);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      
      const audioBlob = new Blob([audioArray], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play().catch(err => {
        console.error('[Hume EVI] Audio playback error:', err);
      });
    } catch (err) {
      console.error('[Hume EVI] Audio decode error:', err);
    }
  }, []);

  // Save transcript to database
  const saveTranscript = useCallback(async () => {
    console.log('[Hume EVI] Saving transcript');
    
    await supabase.functions.invoke('helios-hume-evi', {
      body: {
        action: 'save_transcript',
        session_id: sessionId,
        transcript,
      },
    });
    onTranscriptUpdate?.(transcript);
  }, [sessionId, transcript, onTranscriptUpdate]);

  // End consultation
  const endConsultation = useCallback(() => {
    console.log('[Hume EVI] Ending consultation');
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'user_interrupt',
        message: 'End consultation',
      }));
    }
    stopListening();
  }, [stopListening]);

  // Disconnect
  const disconnect = useCallback(() => {
    stopListening();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    currentEmotion,
    connect,
    disconnect,
    startListening,
    stopListening,
    toggleListening,
    endConsultation,
    saveTranscript,
  };
}

// Helper: Convert Float32 to Int16 for audio transmission
function convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}
