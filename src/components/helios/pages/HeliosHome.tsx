/**
 * HELIOS Home - New Consult Screen
 * "How can I help you today?"
 */

import React, { useState, Suspense, lazy } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, Shield, Heart, Brain, Stethoscope, Baby, Users, Bone, Mic, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LanguageSelector } from '../common/LanguageSelector';
import { EmergencyDropdown } from '../common/EmergencyDropdown';
import type { SupportedLanguage } from '@/lib/helios/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Lazy load voice component for performance
const HeliosVoiceConsultation = lazy(() => 
  import('../voice/HeliosVoiceConsultation').then(m => ({ default: m.HeliosVoiceConsultation }))
);

const SPECIALTIES = [
  { value: 'primary-care', label: 'General Health', icon: Stethoscope, description: 'General symptoms & wellness' },
  { value: 'cardiology', label: 'Heart & Cardio', icon: Heart, description: 'Chest pain, palpitations' },
  { value: 'mental-health', label: 'Mental Health', icon: Brain, description: 'Anxiety, depression, stress' },
  { value: 'dermatology', label: 'Skin & Hair', icon: Users, description: 'Rashes, acne, skin concerns' },
  { value: 'pediatrics', label: 'Pediatrics', icon: Baby, description: "Children's health" },
  { value: 'womens-health', label: "Women's Health", icon: Users, description: 'Reproductive & gynecological' },
  { value: 'orthopedics', label: 'Bone & Joint', icon: Bone, description: 'Pain, injuries, mobility' },
];

interface HeliosHomeProps {
  userName?: string;
}

// Specialty-based symptom chips
const SPECIALTY_SYMPTOMS: Record<string, string[]> = {
  'primary-care': ['Headache', 'Cold symptoms', 'Fatigue', 'Fever', 'General checkup'],
  'dermatology': ['Skin rash', 'Acne', 'Eczema flare', 'Suspicious mole', 'Hair loss'],
  'womens-health': ['Irregular periods', 'Pelvic pain', 'Pregnancy questions', 'Menopause symptoms', 'Breast concerns'],
  'mental-health': ['Anxiety', 'Depression', 'Sleep issues', 'Stress management', 'Mood changes'],
  'pediatrics': ['Child fever', 'Ear pain', 'Rash on child', 'Cough in child', 'Growth concerns'],
  'cardiology': ['Chest discomfort', 'Heart palpitations', 'Shortness of breath', 'High blood pressure', 'Dizziness'],
};

const translations = {
  en: {
    greeting: 'How can I help you today',
    welcome: "We're glad you're here.",
    support: "Don't hesitate to reach out to our support staff if you have any questions.",
    placeholder: 'Describe your symptoms...',
    getStarted: 'Get Started',
    startChat: 'Start Chat',
    privacy: 'HIPAA · Private',
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
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get specialty from URL, default to primary-care
  const specialty = searchParams.get('specialty') || 'primary-care';
  const quickSymptoms = SPECIALTY_SYMPTOMS[specialty] || SPECIALTY_SYMPTOMS['primary-care'];

  const t = translations[language] || translations.en;

  const handleStart = async () => {
    setIsStarting(true);

    // Navigate to chat - pass initialSymptom, language, and specialty
    if (message.trim()) {
      navigate('/health/chat/new', {
        state: { initialSymptom: message.trim(), language, specialty }
      });
    } else {
      // Start empty chat
      navigate('/health/chat/new', {
        state: { language, specialty }
      });
    }
  };

  return (
    <div className="flex flex-col min-h-[80vh] px-4">
      {/* Voice Consultation Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowVoiceModal(false)}
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
            <Suspense fallback={
              <div className="h-[550px] bg-[#1D4E5F] rounded-xl flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
            }>
              <HeliosVoiceConsultation 
                onClose={() => setShowVoiceModal(false)}
                specialty={specialty}
                language={language}
              />
            </Suspense>
          </div>
        </div>
      )}

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

            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              {/* Voice button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowVoiceModal(true)}
                className="rounded-full border-[#1D4E5F] text-[#1D4E5F] hover:bg-[#1D4E5F]/10"
                title="Start Voice Consultation"
              >
                <Mic className="w-5 h-5" />
              </Button>

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

          {/* Privacy indicator and Voice button */}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4" />
              <span>{t.privacy}</span>
            </div>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => setShowVoiceModal(true)}
              className="flex items-center gap-1 text-[#1D4E5F] hover:text-[#1D4E5F]/80 transition-colors"
            >
              <Mic className="w-4 h-4" />
              <span>Voice Consult</span>
            </button>
          </div>
        </div>

        {/* Quick actions - dynamic based on specialty */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          {quickSymptoms.map((symptom) => (
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
