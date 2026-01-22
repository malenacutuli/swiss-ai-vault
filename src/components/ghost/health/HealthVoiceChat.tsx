import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { VoiceProvider, useVoice } from '@humeai/voice-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, X, Loader2, VolumeX, AlertCircle } from 'lucide-react';
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
}

interface VoiceChatInnerProps {
  onClose: () => void;
  accessToken: string;
}

function VoiceChatInner({ onClose, accessToken }: VoiceChatInnerProps) {
  const { t } = useTranslation();
  const { 
    connect, 
    disconnect, 
    status, 
    isMuted, 
    mute, 
    unmute,
    messages: humeMessages,
    fft,
    isPlaying
  } = useVoice();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // Process Hume messages into our format
  useEffect(() => {
    if (humeMessages && humeMessages.length > 0) {
      const newMessages: Message[] = humeMessages
        .filter((msg: any) => msg.type === 'user_message' || msg.type === 'assistant_message')
        .map((msg: any) => ({
          role: msg.type === 'user_message' ? 'user' as const : 'assistant' as const,
          content: msg.message?.content || '',
          timestamp: new Date(msg.receivedAt || Date.now())
        }));
      
      setMessages(newMessages);
    }
  }, [humeMessages]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      console.log('Attempting to connect to Hume EVI...');
      await connect({
        auth: { type: 'accessToken', value: accessToken },
        hostname: 'api.hume.ai',
      });
      console.log('Connected to Hume EVI successfully');
    } catch (error) {
      console.error('Failed to connect to Hume:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [connect, accessToken]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setMessages([]);
  }, [disconnect]);

  const isConnected = status.value === 'connected';
  const isSpeaking = isPlaying || (fft && fft.length > 0 && fft.some((v: number) => v > 0.1));
  const isListening = isConnected && !isMuted;

  return (
    <Card className="relative flex flex-col h-[500px] bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700 overflow-hidden">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-3 right-3 z-10 text-white/70 hover:text-white hover:bg-white/10"
      >
        <X className="w-5 h-5" />
      </Button>

      {/* 3D Avatar Section */}
      <div className="relative h-64 flex-shrink-0">
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
            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
            isConnected ? "bg-emerald-500/20 text-emerald-400" :
            isConnecting ? "bg-amber-500/20 text-amber-400" :
            "bg-slate-500/20 text-slate-400"
          )}>
            {isConnecting ? t('ghost.health.avatar.connecting', 'Connecting...') :
             isConnected ? (isSpeaking ? t('ghost.health.avatar.speaking', 'Speaking...') : 
                          isListening ? t('ghost.health.avatar.listening', 'Listening...') :
                          t('ghost.health.avatar.connected', 'Connected')) :
             t('ghost.health.avatar.ready', 'Ready to chat')}
          </div>
        </div>
      </div>

      {/* Messages Section */}
      <ScrollArea className="flex-1 px-4 py-2">
        {messages.length === 0 && isConnected && (
          <p className="text-center text-slate-400 text-sm py-4">
            {t('ghost.health.avatar.startPrompt', 'Say "Hello" to start the conversation')}
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "mb-3 max-w-[85%] rounded-2xl px-4 py-2",
              msg.role === 'user' 
                ? "ml-auto bg-[#2A8C86] text-white" 
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
                {t('ghost.health.avatar.start', 'Start Conversation')}
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
          {t('ghost.health.avatar.disclaimer', 'AI health assistant for informational purposes only. Not medical advice.')}
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
          setError('Failed to initialize voice chat. Please try again.');
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
  }, []);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-[500px] bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-[#2A8C86] animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">{t('ghost.health.avatar.initializing', 'Initializing voice assistant...')}</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex flex-col items-center justify-center h-[500px] bg-gradient-to-b from-slate-900 to-slate-800 border-slate-700 p-6">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 text-center mb-4">{error}</p>
        <Button variant="outline" onClick={onClose} className="text-white border-slate-600">
          {t('common.close', 'Close')}
        </Button>
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
