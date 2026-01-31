/**
 * Voice Interface Hook for HELIOS
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
      console.log('[Voice] Connecting...', { sessionId, specialty, language });
      
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
        console.error('[Voice] Token error:', error);
        throw error;
      }

      if (!data?.accessToken) {
        console.error('[Voice] No access token received:', data);
        throw new Error('Failed to get access token');
      }

      const { accessToken, systemPrompt } = data;
      console.log('[Voice] Got access token, connecting to WebSocket');

      // Connect to Hume EVI WebSocket with the access token
      // Use the correct EVI chat endpoint format
      const wsUrl = `wss://api.hume.ai/v0/evi/chat?access_token=${encodeURIComponent(accessToken)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Voice] WebSocket opened, configuring session');
        
        // Send session settings using the correct Hume EVI format
        // The system_prompt goes directly in session_settings, not nested
        const sessionSettings = {
          type: 'session_settings',
          system_prompt: systemPrompt,
          context: {
            text: `Health Assistant - ${specialty} consultation`,
            type: 'editable' as const
          }
        };
        
        ws.send(JSON.stringify(sessionSettings));
        
        setIsConnected(true);
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
        console.error('[Voice] WebSocket error:', error);
        toast({
          title: 'Connection error',
          description: 'Voice consultation unavailable. Please try again.',
          variant: 'destructive',
        });
      };

      ws.onclose = () => {
        console.log('[Voice] Disconnected');
        setIsConnected(false);
        setIsListening(false);
      };

    } catch (err) {
      console.error('[Voice] Connection error:', err);
      toast({
        title: 'Failed to start voice consultation',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
    }
  }, [sessionId, specialty, language, toast]);

  // Handle incoming Hume messages
  const handleHumeMessage = useCallback((message: Record<string, unknown>) => {
    console.log('[Voice] Message received:', message.type);
    
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

      case 'error': {
        // Log full error for debugging but show user-friendly message
        console.error('[Voice] Error:', message);
        
        // Map error codes to user-friendly messages without exposing provider details
        const errorCode = message.code as string;
        let userMessage = 'Voice consultation temporarily unavailable. Please try again.';
        
        if (errorCode === 'I0100' || errorCode === 'uncaught') {
          userMessage = 'Voice service experienced an issue. Please try again in a moment.';
        } else if (errorCode === 'audio_error') {
          userMessage = 'Audio processing error. Please check your microphone.';
        } else if (errorCode === 'rate_limit') {
          userMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (errorCode === 'auth_error') {
          userMessage = 'Session expired. Please refresh and try again.';
        }
        
        toast({
          title: 'Voice consultation error',
          description: userMessage,
          variant: 'destructive',
        });
        break;
      }
    }
  }, [onMessage, onEmotionDetected, onConsultationEnd, toast]);

  // Handle tool calls from Hume
  const handleToolCall = async (toolName: string, params: Record<string, unknown>) => {
    console.log('[Voice] Tool call:', toolName, params);
    
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
      console.log('[Voice] Requesting microphone access');
      
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
      console.log('[Voice] Listening started');
      
    } catch (err) {
      console.error('[Voice] Microphone error:', err);
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access for voice consultation.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Stop listening
  const stopListening = useCallback(() => {
    console.log('[Voice] Stopping listening');
    
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
        console.error('[Voice] Audio playback error:', err);
      });
    } catch (err) {
      console.error('[Voice] Audio decode error:', err);
    }
  }, []);

  // Save transcript to database
  const saveTranscript = useCallback(async () => {
    console.log('[Voice] Saving transcript');
    
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
    console.log('[Voice] Ending consultation');
    
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
