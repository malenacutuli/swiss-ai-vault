import { useState, useEffect, useCallback, Suspense, lazy, useRef } from 'react';
import { VoiceProvider, useVoice } from '@humeai/voice-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, X, Loader2, VolumeX, AlertCircle, Heart, Phone, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// Lazy load the 3D component for better performance
const HealthAvatar3D = lazy(() => 
  import('./HealthAvatar3D').then(m => ({ default: m.HealthAvatar3D }))
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
}

// Crisis banner component
function CrisisBanner({ type, language }: { type: string; language: string }) {
  const { t } = useTranslation();
  
  const crisisInfo: Record<string, { number: string; label: string }> = {
    'suicide': { number: '988', label: t('ghost.health.crisis.suicideLine', 'Suicide & Crisis Lifeline') },
    'emergency': { number: '911', label: t('ghost.health.crisis.emergency', 'Emergency Services') },
    'poison': { number: '1-800-222-1222', label: t('ghost.health.crisis.poison', 'Poison Control') },
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
        {t('ghost.health.crisis.callNow', 'Call Now')}
      </a>
    </div>
  );
}

function VoiceChatInner({ onClose, accessToken }: VoiceChatInnerProps) {
  const { t, i18n } = useTranslation();
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
  const [crisisDetected, setCrisisDetected] = useState<{ type: string; language: string } | null>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const processingLock = useRef<boolean>(false);

  // Welcome message in user's language
  const getWelcomeMessage = useCallback(() => {
    const welcomes: Record<string, string> = {
      'en': "Hello! I'm your healthcare assistant. I'm here to help you with health-related questions, explain symptoms, or guide you to the right care. How can I help you today?",
      'es': "¡Hola! Soy tu asistente de salud. Estoy aquí para ayudarte con preguntas relacionadas con la salud, explicar síntomas o guiarte hacia la atención adecuada. ¿Cómo puedo ayudarte hoy?",
      'fr': "Bonjour! Je suis votre assistant santé. Je suis là pour vous aider avec des questions liées à la santé, expliquer des symptômes ou vous orienter vers les soins appropriés. Comment puis-je vous aider?",
      'de': "Hallo! Ich bin Ihr Gesundheitsassistent. Ich bin hier, um Ihnen bei gesundheitsbezogenen Fragen zu helfen, Symptome zu erklären oder Sie zur richtigen Versorgung zu leiten. Wie kann ich Ihnen heute helfen?",
      'pt': "Olá! Sou seu assistente de saúde. Estou aqui para ajudá-lo com perguntas relacionadas à saúde, explicar sintomas ou orientá-lo para o cuidado certo. Como posso ajudá-lo hoje?",
      'it': "Ciao! Sono il tuo assistente sanitario. Sono qui per aiutarti con domande sulla salute, spiegare sintomi o guidarti verso le cure giuste. Come posso aiutarti oggi?",
    };
    const lang = i18n.language.split('-')[0];
    return welcomes[lang] || welcomes['en'];
  }, [i18n.language]);

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
          console.log('[HealthVoiceChat] Processing:', pendingUserMessage.content.substring(0, 50));
          
          const { data, error } = await supabase.functions.invoke('hume-health-tool', {
            body: {
              query: pendingUserMessage.content,
              conversation_history: conversationHistory.current.slice(-6)
            }
          });

          if (!error && data?.response) {
            // Check if crisis was detected
            if (data.is_crisis && data.crisis_type) {
              setCrisisDetected({ type: data.crisis_type, language: data.language || 'en' });
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
            console.error('[HealthVoiceChat] Backend error:', error);
            // Provide fallback response
            const fallbackResponse = t('ghost.health.avatar.fallbackResponse', 
              "I'm having trouble connecting. If this is a medical emergency, please call 911. Otherwise, please try again in a moment.");
            sendAssistantInput(fallbackResponse);
          }
        } catch (err) {
          console.error('[HealthVoiceChat] Error:', err);
        } finally {
          processingLock.current = false;
          setIsProcessing(false);
        }
      }
    };

    const timeoutId = setTimeout(processMessages, 100);
    return () => clearTimeout(timeoutId);
  }, [humeMessages, sendAssistantInput, t]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setCrisisDetected(null);
    try {
      console.log('Attempting to connect to Hume EVI...');
      await connect({
        auth: { type: 'accessToken', value: accessToken },
        hostname: 'api.hume.ai',
      });
      console.log('Connected to Hume EVI successfully');
      
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
      console.error('Failed to connect to Hume:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [connect, accessToken, getWelcomeMessage, sendAssistantInput]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setMessages([]);
    setCrisisDetected(null);
    conversationHistory.current = [];
    processedMessageIds.current.clear();
  }, [disconnect]);

  const isConnected = status.value === 'connected';
  const isSpeaking = isPlaying || (fft && fft.length > 0 && fft.some((v: number) => v > 0.1));
  const isListening = isConnected && !isMuted;

  return (
    <Card className="relative flex flex-col h-[550px] bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700 overflow-hidden">
      {/* Crisis Banner */}
      {crisisDetected && (
        <CrisisBanner type={crisisDetected.type} language={crisisDetected.language} />
      )}
      
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-3 right-3 z-10 text-white/70 hover:text-white hover:bg-white/10"
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Language indicator */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-full">
        <Globe className="w-3 h-3 text-white/60" />
        <span className="text-xs text-white/60">{t('ghost.health.avatar.multilingual', 'Multilingual')}</span>
      </div>

      {/* 3D Avatar Section */}
      <div className="relative h-56 flex-shrink-0">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
          </div>
        }>
          <HealthAvatar3D 
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
            "bg-slate-500/20 text-slate-400"
          )}>
            {isConnected && <Heart className="w-3 h-3" />}
            {isProcessing ? t('ghost.health.avatar.thinking', 'Thinking...') :
             isConnecting ? t('ghost.health.avatar.connecting', 'Connecting...') :
             isConnected ? (isSpeaking ? t('ghost.health.avatar.speaking', 'Speaking...') : 
                          isListening ? t('ghost.health.avatar.listening', 'Listening...') :
                          t('ghost.health.avatar.healthReady', 'Healthcare AI Ready')) :
             t('ghost.health.avatar.ready', 'Ready to help')}
          </div>
        </div>
      </div>

      {/* Messages Section */}
      <ScrollArea className="flex-1 px-4 py-2">
        {messages.length === 0 && isConnected && (
          <p className="text-center text-slate-400 text-sm py-4">
            {t('ghost.health.avatar.healthStartPrompt', 'Ask me any health-related question in any language!')}
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "mb-3 max-w-[85%] rounded-2xl px-4 py-2",
              msg.role === 'user' 
                ? "ml-auto bg-[#2A8C86] text-white" 
                : msg.isCrisis 
                  ? "mr-auto bg-red-600 text-white border-2 border-red-400"
                  : "mr-auto bg-slate-700 text-slate-100"
            )}
          >
            <p className="text-sm leading-relaxed">{msg.content}</p>
          </div>
        ))}
      </ScrollArea>

      {/* Controls Section */}
      <div className="flex items-center justify-center gap-4 p-4 bg-slate-800/50">
        {!isConnected ? (
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="gap-2 bg-[#2A8C86] hover:bg-[#2A8C86]/90 text-white px-6"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('ghost.health.avatar.connecting', 'Connecting...')}
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                {t('ghost.health.avatar.startHealthChat', 'Start Health Consultation')}
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
              {t('ghost.health.avatar.end', 'End')}
            </Button>
          </>
        )}
      </div>

      {/* Medical disclaimer */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-slate-500 text-center">
          {t('ghost.health.avatar.disclaimer', 'AI triage assistant for informational purposes only. Not a substitute for professional medical advice. Always consult a healthcare provider.')}
        </p>
      </div>
    </Card>
  );
}

interface HealthVoiceChatProps {
  onClose: () => void;
}

export function HealthVoiceChat({ onClose }: HealthVoiceChatProps) {
  const { t } = useTranslation();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('hume-access-token');
        
        if (error) {
          console.error('Token fetch error:', error);
          setError(t('ghost.health.avatar.initFailed', 'Failed to initialize voice chat. Please try again.'));
          return;
        }
        
        if (data?.accessToken) {
          setAccessToken(data.accessToken);
        } else {
          setError('Unable to connect to voice service.');
        }
      } catch (err) {
        console.error('Token fetch exception:', err);
        setError('Connection error. Please check your internet connection.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, [t]);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-[550px] bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-[#2A8C86] animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">{t('ghost.health.avatar.initializing', 'Initializing Healthcare AI Agent...')}</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex flex-col items-center justify-center h-[550px] bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700 p-6">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 text-center mb-4">{error}</p>
        <div className="space-y-2 text-center">
          <p className="text-slate-400 text-sm">
            {t('ghost.health.avatar.emergencyNote', 'If this is an emergency, please call 911')}
          </p>
          <Button variant="outline" onClick={onClose} className="text-white border-slate-600">
            {t('common.close', 'Close')}
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
      onError={(error) => console.error('Hume Voice error:', error)}
      onClose={() => console.log('Hume connection closed')}
    >
      <VoiceChatInner onClose={onClose} accessToken={accessToken} />
    </VoiceProvider>
  );
}
