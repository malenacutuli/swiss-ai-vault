/**
 * HELIOS Chat Interface
 * Main chat component for healthcare triage
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, AlertTriangle, Loader2, Paperclip, X, FileText, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useHeliosSession } from '@/hooks/helios/useHeliosSession';
import { HeliosMessage } from './HeliosMessage';
import { HeliosRedFlag } from './HeliosRedFlag';
import { LanguageSelector } from '../common/LanguageSelector';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();

  const navigate = useNavigate();

  const {
    session,
    messages,
    redFlags,
    isLoading,
    isEscalated,
    sendMessage,
    startSession,
    completeSession,
    error,
  } = useHeliosSession(language);

  // Complete and save consultation
  const handleCompleteConsultation = async () => {
    const success = await completeSession();
    if (success) {
      toast({
        title: language === 'es' ? 'Consulta guardada' : language === 'fr' ? 'Consultation enregistrée' : 'Consultation saved',
        description: language === 'es' ? 'Ver en tu historial de consultas.' : language === 'fr' ? 'Voir dans votre historique.' : 'View it in your Consults history.',
      });
      navigate('/health/consults');
    } else {
      toast({
        title: language === 'es' ? 'Error al guardar' : language === 'fr' ? 'Échec de la sauvegarde' : 'Failed to save',
        description: language === 'es' ? 'Por favor, inténtalo de nuevo.' : language === 'fr' ? 'Veuillez réessayer.' : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

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
    setAttachedFiles([]); // Clear files after send
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      toast({
        title: language === 'es' ? 'Grabando...' : language === 'fr' ? 'Enregistrement...' : 'Recording...',
        description: language === 'es' 
          ? 'Habla ahora. Haz clic de nuevo para parar.'
          : language === 'fr'
          ? 'Parlez maintenant. Cliquez à nouveau pour arrêter.'
          : 'Speak now. Click again to stop.',
      });
    } catch (err) {
      console.error('Microphone access error:', err);
      toast({
        title: language === 'es' ? 'Acceso al micrófono denegado' : language === 'fr' ? 'Accès au microphone refusé' : 'Microphone access denied',
        description: language === 'es'
          ? 'Por favor, permite el acceso al micrófono para usar la entrada de voz.'
          : language === 'fr'
          ? 'Veuillez autoriser l\'accès au microphone pour utiliser la saisie vocale.'
          : 'Please allow microphone access to use voice input.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      // Create form data with the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // Call the voice edge function for transcription
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice?action=transcribe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      
      if (data?.text) {
        setInput(prev => prev + (prev ? ' ' : '') + data.text);
        toast({
          title: language === 'es' ? 'Transcripción completada' : language === 'fr' ? 'Transcription terminée' : 'Transcription complete',
          description: data.text.slice(0, 50) + (data.text.length > 50 ? '...' : ''),
        });
      }
    } catch (err) {
      console.error('Transcription failed:', err);
      toast({
        title: language === 'es' ? 'Error de transcripción' : language === 'fr' ? 'Erreur de transcription' : 'Transcription failed',
        description: language === 'es'
          ? 'Por favor, inténtalo de nuevo o escribe tu mensaje.'
          : language === 'fr'
          ? 'Veuillez réessayer ou tapez votre message.'
          : 'Please try again or type your message.',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachedFiles(prev => [...prev, ...files]);
      toast({
        title: 'File attached',
        description: `${files[0].name} ready to send`,
      });
    }
    // Reset input for same file selection
    e.target.value = '';
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
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
        <div className="flex items-center gap-3">
          {messages.length >= 3 && session?.phase !== 'completed' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompleteConsultation}
              disabled={isLoading}
              className="text-[#1D4E5F] border-[#1D4E5F] hover:bg-[#1D4E5F]/10"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {language === 'es' ? 'Terminar y Guardar' : language === 'fr' ? 'Terminer et Sauvegarder' : 'End & Save'}
            </Button>
          )}
          <LanguageSelector value={language} onChange={setLanguage} />
        </div>
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

      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2 border-t bg-gray-50 dark:bg-gray-800/50">
          {attachedFiles.map((file, i) => (
            <div 
              key={i} 
              className="flex items-center gap-1 bg-white dark:bg-gray-700 px-2 py-1 rounded border dark:border-gray-600 text-sm"
            >
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="truncate max-w-[120px] dark:text-gray-200">{file.name}</span>
              <button 
                onClick={() => removeFile(i)}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t dark:border-gray-700">
        {error && (
          <div className="mb-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* File Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            multiple
          />
          <button
            onClick={handleAttachClick}
            className="p-2 rounded-full transition-colors bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-teal-600"
            disabled={isLoading || isEscalated}
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            onClick={handleMicClick}
            className={`p-2 rounded-full transition-colors ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : isTranscribing
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
            disabled={isLoading || isEscalated || isTranscribing}
            title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start voice input'}
          >
            {isTranscribing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
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
