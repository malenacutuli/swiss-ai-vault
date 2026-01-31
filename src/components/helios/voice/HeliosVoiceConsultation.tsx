/**
 * HELIOS Voice Consultation - Using @humeai/voice-react SDK
 * Replaces broken custom WebSocket implementation
 */

import { useState, useEffect, useCallback, Suspense, lazy, useRef } from 'react';
import { VoiceProvider, useVoice } from '@humeai/voice-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, X, Loader2, VolumeX, AlertCircle, Heart, Phone, Globe, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy load the 3D component for better performance
const HeliosVoiceAvatar = lazy(() => 
  import('./HeliosVoiceAvatar').then(m => ({ default: m.HeliosVoiceAvatar }))
);

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isCrisis?: boolean;
}

interface VoiceChatInnerProps {
  onClose: () => void;
  accessToken: string;
  specialty?: string;
  language?: string;
  onMessagesUpdate?: (messages: Message[]) => void;
}

// Crisis banner component
function CrisisBanner({ type }: { type: string }) {
  const crisisInfo: Record<string, { number: string; label: string }> = {
    'suicide': { number: '988', label: 'Suicide & Crisis Lifeline' },
    'emergency': { number: '911', label: 'Emergency Services' },
    'poison': { number: '1-800-222-1222', label: 'Poison Control' },
  };
  
  const info = crisisInfo[type] || crisisInfo['emergency'];
  
  return (
    <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-2">
        <Phone className="w-4 h-4" />
        <span className="font-medium text-sm">{info.label}: {info.number}</span>
      </div>
      <a 
        href={`tel:${info.number}`} 
        className="bg-white text-red-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-100 transition-colors"
      >
        Call Now
      </a>
    </div>
  );
}

function VoiceChatInner({ onClose, accessToken, specialty = 'primary-care', language = 'en', onMessagesUpdate }: VoiceChatInnerProps) {
  const { 
    connect, 
    disconnect, 
    status, 
    isMuted, 
    mute, 
    unmute,
    messages: humeMessages,
    fft,
    isPlaying,
    sendAssistantInput
  } = useVoice();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [crisisDetected, setCrisisDetected] = useState<{ type: string } | null>(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const processingLock = useRef<boolean>(false);

  // Notify parent of message updates
  useEffect(() => {
    onMessagesUpdate?.(messages);
  }, [messages, onMessagesUpdate]);

  // Welcome message based on specialty
  const getWelcomeMessage = useCallback(() => {
    const specialtyWelcomes: Record<string, string> = {
      'primary-care': "Hello! I'm your HELIOS healthcare assistant. I can help with general health questions, explain symptoms, or guide you to the right care. How can I help you today?",
      'cardiology': "Hello! I'm your HELIOS cardiology assistant. I can help with questions about heart health, chest discomfort, or cardiovascular concerns. What brings you here today?",
      'mental-health': "Hello! I'm your HELIOS mental health assistant. I'm here to listen and help with questions about anxiety, stress, mood, or general mental wellness. How are you feeling today?",
      'dermatology': "Hello! I'm your HELIOS dermatology assistant. I can help with skin concerns, rashes, or general skincare questions. What would you like to discuss?",
      'pediatrics': "Hello! I'm your HELIOS pediatric assistant. I can help with questions about your child's health and development. What concerns do you have?",
      'womens-health': "Hello! I'm your HELIOS women's health assistant. I can help with reproductive health, hormonal concerns, or general wellness questions. How can I assist you?",
      'orthopedics': "Hello! I'm your HELIOS orthopedic assistant. I can help with questions about bone, joint, or muscle concerns. What's troubling you?",
    };
    return specialtyWelcomes[specialty] || specialtyWelcomes['primary-care'];
  }, [specialty]);

  // Process user messages and get health responses
  useEffect(() => {
    if (!humeMessages || humeMessages.length === 0) return;

    const processMessages = async () => {
      if (processingLock.current) return;
      
      const newMessages: Message[] = [];
      let pendingUserMessage: { content: string; id: string } | null = null;
      
      for (const msg of humeMessages) {
        if (msg.type === 'user_message') {
          const userContent = (msg as any).message?.content || '';
          const msgId = `${userContent}-${(msg as any).receivedAt}`;
          
          newMessages.push({
            role: 'user',
            content: userContent,
            timestamp: new Date((msg as any).receivedAt || Date.now())
          });

          if (userContent && !processedMessageIds.current.has(msgId)) {
            pendingUserMessage = { content: userContent, id: msgId };
          }
        } else if (msg.type === 'assistant_message') {
          newMessages.push({
            role: 'assistant',
            content: (msg as any).message?.content || '',
            timestamp: new Date((msg as any).receivedAt || Date.now())
          });
        }
      }
      
      setMessages(newMessages);

      if (pendingUserMessage && !processingLock.current) {
        processingLock.current = true;
        processedMessageIds.current.add(pendingUserMessage.id);
        setIsProcessing(true);
        
        try {
          console.log('[HeliosVoice] Processing:', pendingUserMessage.content.substring(0, 50));
          
          const { data, error } = await supabase.functions.invoke('hume-health-tool', {
            body: {
              query: pendingUserMessage.content,
              conversation_history: conversationHistory.current.slice(-6),
              specialty,
              language
            }
          });

          if (!error && data?.response) {
            // Check if crisis was detected
            if (data.is_crisis && data.crisis_type) {
              setCrisisDetected({ type: data.crisis_type });
            }
            
            conversationHistory.current.push(
              { role: 'user', content: pendingUserMessage.content },
              { role: 'assistant', content: data.response }
            );
            
            // Add crisis indicator to message if detected
            if (data.is_crisis) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                isCrisis: true
              }]);
            }
            
            sendAssistantInput(data.response);
          } else if (error) {
            console.error('[HeliosVoice] Backend error:', error);
            const fallbackResponse = "I'm having trouble connecting. If this is a medical emergency, please call 911. Otherwise, please try again in a moment.";
            sendAssistantInput(fallbackResponse);
          }
        } catch (err) {
          console.error('[HeliosVoice] Error:', err);
        } finally {
          processingLock.current = false;
          setIsProcessing(false);
        }
      }
    };

    const timeoutId = setTimeout(processMessages, 100);
    return () => clearTimeout(timeoutId);
  }, [humeMessages, sendAssistantInput, specialty, language]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setCrisisDetected(null);
    try {
      console.log('[HeliosVoice] Connecting to voice service...');
      await connect({
        auth: { type: 'accessToken', value: accessToken },
        hostname: 'api.hume.ai',
      });
      console.log('[HeliosVoice] Connected successfully');
      
      // Reset conversation
      conversationHistory.current = [];
      processedMessageIds.current.clear();
      
      // Send welcome message
      setTimeout(() => {
        const welcome = getWelcomeMessage();
        sendAssistantInput(welcome);
        conversationHistory.current.push({ role: 'assistant', content: welcome });
      }, 500);
      
    } catch (error) {
      console.error('[HeliosVoice] Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [connect, accessToken, getWelcomeMessage, sendAssistantInput]);

  const handleDisconnect = useCallback(async () => {
    if (messages.length > 0) {
      setShowEndDialog(true);
    } else {
      await disconnect();
      onClose();
    }
  }, [disconnect, messages.length, onClose]);

  const handleConfirmEnd = useCallback(async (shouldDownload: boolean) => {
    if (shouldDownload && messages.length > 0) {
      // Generate transcript
      const content = [
        `# HELIOS Voice Consultation`,
        `Date: ${new Date().toLocaleString()}`,
        `Specialty: ${specialty}`,
        ``,
        `---`,
        ``,
        ...messages.map(msg => {
          const role = msg.role === 'user' ? 'You' : 'HELIOS AI';
          const time = msg.timestamp.toLocaleTimeString();
          return `**${role}** (${time}):\n${msg.content}\n`;
        }),
        ``,
        `---`,
        ``,
        `*This consultation was conducted through HELIOS Healthcare AI.*`,
        `*This is not medical advice. Please consult with a healthcare professional for diagnosis and treatment.*`,
      ].join('\n');

      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `helios-voice-consultation-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    await disconnect();
    setMessages([]);
    setCrisisDetected(null);
    conversationHistory.current = [];
    processedMessageIds.current.clear();
    setShowEndDialog(false);
    onClose();
  }, [disconnect, messages, specialty, onClose]);

  const isConnected = status.value === 'connected';
  const isSpeaking = isPlaying || (fft && fft.length > 0 && fft.some((v: number) => v > 0.1));
  const isListening = isConnected && !isMuted;

  return (
    <Card className="relative flex flex-col h-[550px] bg-gradient-to-b from-[#1D4E5F]/95 to-[#1D4E5F]/80 border-[#1D4E5F]/50 overflow-hidden">
      {/* End Session Dialog */}
      {showEndDialog && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1D4E5F] rounded-xl p-6 max-w-sm w-full space-y-4 border border-white/20">
            <h3 className="text-lg font-medium text-white text-center">End Session</h3>
            <p className="text-sm text-white/70 text-center">
              Would you like to download a transcript of this conversation?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-white/30 text-white hover:bg-white/10"
                onClick={() => handleConfirmEnd(false)}
              >
                No, just end
              </Button>
              <Button
                className="flex-1 bg-white text-[#1D4E5F] hover:bg-white/90 gap-2"
                onClick={() => handleConfirmEnd(true)}
              >
                <Download className="w-4 h-4" />
                Download & End
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Crisis Banner */}
      {crisisDetected && <CrisisBanner type={crisisDetected.type} />}
      
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDisconnect}
        className="absolute top-3 right-3 z-10 text-white/70 hover:text-white hover:bg-white/10"
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Language indicator */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-full">
        <Globe className="w-3 h-3 text-white/60" />
        <span className="text-xs text-white/60">Multilingual</span>
      </div>

      {/* 3D Avatar Section */}
      <div className="relative h-56 flex-shrink-0">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
          </div>
        }>
          <HeliosVoiceAvatar 
            fft={fft || []} 
            isSpeaking={isSpeaking} 
            isListening={isListening}
            className="w-full h-full"
          />
        </Suspense>
        
        {/* Status indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
            isConnected ? "bg-emerald-500/20 text-emerald-400" :
            isConnecting ? "bg-amber-500/20 text-amber-400" :
            "bg-white/10 text-white/60"
          )}>
            {isConnected && <Heart className="w-3 h-3" />}
            {isProcessing ? 'Thinking...' :
             isConnecting ? 'Connecting...' :
             isConnected ? (isSpeaking ? 'Speaking...' : 
                          isListening ? 'Listening...' :
                          'HELIOS Ready') :
             'Ready to help'}
          </div>
        </div>
      </div>

      {/* Messages Section */}
      <ScrollArea className="flex-1 px-4 py-2">
        {messages.length === 0 && isConnected && (
          <p className="text-center text-white/50 text-sm py-4">
            Ask me any health-related question in any language!
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "mb-3 max-w-[85%] rounded-2xl px-4 py-2",
              msg.role === 'user' 
                ? "ml-auto bg-white text-[#1D4E5F]" 
                : msg.isCrisis 
                  ? "mr-auto bg-red-600 text-white border-2 border-red-400"
                  : "mr-auto bg-white/20 text-white"
            )}
          >
            <p className="text-sm leading-relaxed">{msg.content}</p>
          </div>
        ))}
      </ScrollArea>

      {/* Controls Section */}
      <div className="flex items-center justify-center gap-4 p-4 bg-black/20">
        {!isConnected ? (
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="gap-2 bg-white text-[#1D4E5F] hover:bg-white/90 px-6"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Voice Consultation
              </>
            )}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={isMuted ? unmute : mute}
              className={cn(
                "rounded-full w-12 h-12 border-2",
                isMuted 
                  ? "border-red-500 text-red-500 hover:bg-red-500/10" 
                  : "border-emerald-500 text-emerald-500 hover:bg-emerald-500/10"
              )}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              className="gap-2"
            >
              <VolumeX className="w-4 h-4" />
              End
            </Button>
          </>
        )}
      </div>

      {/* Medical disclaimer */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-white/40 text-center">
          AI triage assistant for informational purposes only. Not a substitute for professional medical advice. Always consult a healthcare provider.
        </p>
      </div>
    </Card>
  );
}

interface HeliosVoiceConsultationProps {
  onClose: () => void;
  specialty?: string;
  language?: string;
}

export function HeliosVoiceConsultation({ onClose, specialty = 'primary-care', language = 'en' }: HeliosVoiceConsultationProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('hume-access-token');
        
        if (error) {
          console.error('[HeliosVoice] Token fetch error:', error);
          setError('Failed to initialize voice chat. Please try again.');
          return;
        }
        
        if (data?.accessToken) {
          setAccessToken(data.accessToken);
        } else {
          setError('Unable to connect to voice service.');
        }
      } catch (err) {
        console.error('[HeliosVoice] Token fetch exception:', err);
        setError('Connection error. Please check your internet connection.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, []);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-[550px] bg-gradient-to-b from-[#1D4E5F]/95 to-[#1D4E5F]/80 border-[#1D4E5F]/50">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-white animate-spin mx-auto" />
          <p className="text-white/70 text-sm">Initializing HELIOS Voice Agent...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex flex-col items-center justify-center h-[550px] bg-gradient-to-b from-[#1D4E5F]/95 to-[#1D4E5F]/80 border-[#1D4E5F]/50 p-6">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 text-center mb-4">{error}</p>
        <div className="space-y-2 text-center">
          <p className="text-white/60 text-sm">If this is an emergency, please call 911</p>
          <Button variant="outline" onClick={onClose} className="text-white border-white/30">
            Close
          </Button>
        </div>
      </Card>
    );
  }

  if (!accessToken) {
    return null;
  }

  return (
    <VoiceProvider
      messageHistoryLimit={50}
      clearMessagesOnDisconnect={true}
      onError={(error) => console.error('[HeliosVoice] Hume error:', error)}
      onClose={() => console.log('[HeliosVoice] Connection closed')}
    >
      <VoiceChatInner 
        onClose={onClose} 
        accessToken={accessToken}
        specialty={specialty}
        language={language}
      />
    </VoiceProvider>
  );
}
