// src/components/helios/chat/HeliosChatPageV2.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useHeliosChat } from '@/hooks/helios/useHeliosChat';
import { ChatMessage } from './ChatMessage';
import { IntakeForm } from './IntakeForm';
import { RedFlagAlert } from './RedFlagAlert';
import { Loader2, Send, Paperclip, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface HeliosChatPageV2Props {
  specialty?: string;
}

export function HeliosChatPageV2({ specialty = 'primary-care' }: HeliosChatPageV2Props) {
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialMessage = (location.state as any)?.initialMessage;

  const {
    messages,
    isLoading,
    isEscalated,
    redFlags,
    phase,
    caseState,
    intakeRequired,
    sessionId,
    sendMessage,
    submitIntake,
    startSession,
    loadSession,
  } = useHeliosChat(specialty);

  const [input, setInput] = useState(initialMessage || '');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [pendingInitialMessage, setPendingInitialMessage] = useState<string | null>(initialMessage || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load existing session or create new one
  useEffect(() => {
    const initSession = async () => {
      if (sessionInitialized) return;
      setSessionInitialized(true);

      // If URL has a session ID that's not 'new', try to load it
      if (urlSessionId && urlSessionId !== 'new') {
        const loaded = await loadSession(urlSessionId);
        if (loaded) {
          console.log('[HELIOS] Session loaded from URL:', urlSessionId);
          // Clear pending message if loading existing session
          setPendingInitialMessage(null);
          setInput('');
          return;
        }
        // Session not found, create new and redirect
        console.log('[HELIOS] Session not found, creating new');
      }

      // Create new session
      await startSession(specialty);
    };

    initSession();
  }, [urlSessionId, loadSession, startSession, specialty, sessionInitialized]);

  // Auto-send initial message when terms are accepted
  useEffect(() => {
    if (termsAccepted && pendingInitialMessage && sessionId && !isLoading) {
      const msg = pendingInitialMessage;
      setPendingInitialMessage(null);
      setInput('');
      sendMessage(msg);
    }
  }, [termsAccepted, pendingInitialMessage, sessionId, isLoading, sendMessage]);

  // Update URL when session ID changes (for new sessions)
  useEffect(() => {
    if (sessionId && urlSessionId === 'new') {
      navigate(`/health/chat/${sessionId}`, { replace: true });
    }
  }, [sessionId, urlSessionId, navigate]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !termsAccepted) return;

    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleIntakeSubmit = async (data: { age: number; sex: string }) => {
    await submitIntake(data.age, data.sex as 'male' | 'female');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gray-50">
        <div className="text-sm text-gray-600">
          Consult started: {new Date().toLocaleString()}
        </div>
        <div className="text-sm text-amber-600 font-medium">
          If this is an emergency, call 911 or your local emergency number.
        </div>
      </div>

      {/* Red Flag Alert */}
      {redFlags.length > 0 && redFlags.some(f => f.severity === 'critical') && (
        <RedFlagAlert redFlags={redFlags} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage
            key={message.message_id}
            message={message}
            isLast={index === messages.length - 1}
          />
        ))}

        {/* Intake Form */}
        {intakeRequired && (
          <div className="flex justify-center">
            <IntakeForm onComplete={handleIntakeSubmit} />
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Terms checkbox */}
      <div className="px-6 py-2 border-t bg-gray-50">
        <label className="flex items-start gap-2 text-sm text-gray-600">
          <Checkbox
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
            className="mt-0.5"
          />
          <span>
            I agree to the{' '}
            <a href="/terms" className="text-blue-600 underline">Terms of Service</a>
            {' '}and will discuss all HELIOS output with a doctor. HELIOS is an AI assistant,
            not a licensed doctor, and does not provide medical advice or care.
          </span>
        </label>
      </div>

      {/* Input area */}
      <div className="px-6 py-4 border-t">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-gray-400">
            <Paperclip className="w-5 h-5" />
          </Button>

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Reply to HELIOS..."
            disabled={isLoading || !termsAccepted || intakeRequired}
            className="flex-1"
          />

          <Button variant="ghost" size="icon" className="text-gray-400">
            <Mic className="w-5 h-5" />
          </Button>

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !termsAccepted || intakeRequired}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        <p className="text-xs text-center text-gray-400 mt-2">
          HELIOS is an AI assistant, not a licensed doctor, and does not practice medicine or provide medical advice or care.
        </p>
      </div>
    </div>
  );
}
