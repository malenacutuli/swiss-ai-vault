/**
 * HELIOS Home - New Consult Screen
 * "How can I help you today?"
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LanguageSelector } from '../common/LanguageSelector';
import { EmergencyDropdown } from '../common/EmergencyDropdown';
import type { SupportedLanguage } from '@/lib/helios/types';

interface HeliosHomeProps {
  userName?: string;
}

const translations = {
  en: {
    greeting: 'How can I help you today',
    welcome: "We're glad you're here.",
    support: "Don't hesitate to reach out to our support staff if you have any questions.",
    placeholder: 'Describe your symptoms...',
    getStarted: 'Get Started',
    startChat: 'Start Chat',
    privacy: 'HIPAA · Private',
    quickActions: ['Headache', 'Cold symptoms', 'Skin rash', 'Anxiety', 'Sleep issues'],
    experiencing: "I'm experiencing",
  },
  es: {
    greeting: 'Cómo puedo ayudarte hoy',
    welcome: 'Nos alegra que estés aquí.',
    support: 'No dudes en contactar a nuestro equipo de soporte si tienes alguna pregunta.',
    placeholder: 'Describe tus síntomas...',
    getStarted: 'Comenzar',
    startChat: 'Iniciar Chat',
    privacy: 'HIPAA · Privado',
    quickActions: ['Dolor de cabeza', 'Síntomas de resfriado', 'Erupción cutánea', 'Ansiedad', 'Problemas de sueño'],
    experiencing: 'Estoy experimentando',
  },
  fr: {
    greeting: 'Comment puis-je vous aider aujourd\'hui',
    welcome: 'Nous sommes heureux de vous voir.',
    support: 'N\'hésitez pas à contacter notre équipe d\'assistance si vous avez des questions.',
    placeholder: 'Décrivez vos symptômes...',
    getStarted: 'Commencer',
    startChat: 'Démarrer le Chat',
    privacy: 'HIPAA · Privé',
    quickActions: ['Mal de tête', 'Symptômes du rhume', 'Éruption cutanée', 'Anxiété', 'Troubles du sommeil'],
    experiencing: 'Je ressens',
  },
};

const doctorAvatars = [
  '/avatars/doctor-1.jpg',
  '/avatars/doctor-2.jpg',
  '/avatars/doctor-3.jpg',
];

export function HeliosHome({ userName }: HeliosHomeProps) {
  const displayName = userName || 'there';
  const [message, setMessage] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const navigate = useNavigate();

  const t = translations[language] || translations.en;

  const handleStart = async () => {
    setIsStarting(true);

    // Navigate to chat - pass initialSymptom and language if provided
    if (message.trim()) {
      navigate('/health/chat/new', {
        state: { initialSymptom: message.trim(), language }
      });
    } else {
      // Start empty chat
      navigate('/health/chat/new', {
        state: { language }
      });
    }
  };

  return (
    <div className="flex flex-col min-h-[80vh] px-4">
      {/* Top Bar with Language and Emergency */}
      <div className="flex items-center justify-end gap-3 py-4">
        <EmergencyDropdown language={language} />
        <LanguageSelector value={language} onChange={setLanguage} variant="compact" />
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-1">
        {/* Doctor avatars */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-[#1D4E5F] rounded-full flex items-center justify-center z-10">
            <span className="text-white text-xl">✦</span>
          </div>
          {doctorAvatars.map((_, i) => (
            <div
              key={i}
              className="w-10 h-10 bg-gray-300 rounded-full -ml-3 border-2 border-white"
              style={{ zIndex: 9 - i }}
            />
          ))}
        </div>

        {/* Greeting */}
        <h1 className="text-4xl md:text-5xl font-serif text-center mb-4">
          {t.greeting},<br />{displayName}?
        </h1>

        <p className="text-gray-600 text-center mb-2">
          {t.welcome}
        </p>

        <p className="text-gray-500 text-center mb-8 text-sm">
          {t.support}
        </p>

        {/* Input area */}
        <div className="w-full max-w-xl">
          <div className="relative bg-white rounded-2xl shadow-sm border border-gray-200">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.placeholder}
              className="min-h-[100px] border-0 focus:ring-0 resize-none p-4 pb-16 text-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleStart();
                }
              }}
            />

            <div className="absolute bottom-4 right-4">
              <Button
                onClick={handleStart}
                disabled={isStarting}
                className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90 text-white rounded-lg px-6"
              >
                {message.trim() ? t.getStarted : t.startChat}
                <Send className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Privacy indicator */}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4" />
              <span>{t.privacy}</span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          {t.quickActions.map((symptom) => (
            <button
              key={symptom}
              onClick={() => setMessage(`${t.experiencing} ${symptom.toLowerCase()}`)}
              className="px-4 py-2 bg-white rounded-full text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              {symptom}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
