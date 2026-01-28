/**
 * HELIOS Chat Interface
 * Main chat component for healthcare triage
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, AlertTriangle, Loader2 } from 'lucide-react';
import { useHeliosSession } from '@/hooks/helios/useHeliosSession';
import { HeliosMessage } from './HeliosMessage';
import { HeliosRedFlag } from './HeliosRedFlag';
import { LanguageSelector } from '../common/LanguageSelector';
import type { SupportedLanguage } from '@/lib/helios/types';

interface HeliosChatProps {
  initialLanguage?: SupportedLanguage;
  onSessionComplete?: (sessionId: string) => void;
}

export function HeliosChat({
  initialLanguage = 'en',
  onSessionComplete
}: HeliosChatProps) {
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    session,
    messages,
    redFlags,
    isLoading,
    isEscalated,
    sendMessage,
    startSession,
    error,
  } = useHeliosSession(language);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start session on mount
  useEffect(() => {
    if (!session) {
      startSession();
    }
  }, [session, startSession]);

  // Notify parent when session completes
  useEffect(() => {
    if (session?.phase === 'completed' && onSessionComplete) {
      onSessionComplete(session.sessionId);
    }
  }, [session?.phase, session?.sessionId, onSessionComplete]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Voice recording handled by useHeliosVoice hook
  };

  const placeholders: Record<SupportedLanguage, string> = {
    en: 'Describe your symptoms...',
    es: 'Describe tus síntomas...',
    fr: 'Décrivez vos symptômes...',
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            HELIOS Health Assistant
          </h2>
        </div>
        <LanguageSelector value={language} onChange={setLanguage} />
      </div>

      {/* Red Flags Banner */}
      {redFlags.length > 0 && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          {redFlags.map((flag, i) => (
            <HeliosRedFlag key={i} flag={flag} language={language} />
          ))}
        </div>
      )}

      {/* Escalation Banner */}
      {isEscalated && (
        <div className="p-4 bg-red-600 text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-bold">
            {language === 'es' ? 'EMERGENCIA - Llame al 911' :
             language === 'fr' ? 'URGENCE - Appelez le 15' :
             'EMERGENCY - Call 911'}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <HeliosMessage key={i} message={msg} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{language === 'es' ? 'Analizando...' :
                   language === 'fr' ? 'Analyse...' : 'Analyzing...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t dark:border-gray-700">
        {error && (
          <div className="mb-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            className={`p-2 rounded-full transition-colors ${
              isRecording
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
            disabled={isLoading || isEscalated}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholders[language]}
            disabled={isLoading || isEscalated}
            className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700
                       dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isEscalated}
            className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* AI Disclaimer */}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {language === 'es'
            ? 'Esto no es un diagnóstico médico. Consulte a un profesional de la salud.'
            : language === 'fr'
            ? 'Ceci n\'est pas un diagnostic médical. Consultez un professionnel de santé.'
            : 'This is not a medical diagnosis. Please consult a healthcare professional.'}
        </p>
      </div>
    </div>
  );
}
