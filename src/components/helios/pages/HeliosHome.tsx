/**
 * HELIOS Home - New Consult Screen
 * "How can I help you today?"
 */

import React, { useState, useRef, Suspense, lazy } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, Shield, Heart, Brain, Stethoscope, Baby, Users, Bone, Mic, X, Loader2, Paperclip, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LanguageSelector } from '../common/LanguageSelector';
import { EmergencyDropdown } from '../common/EmergencyDropdown';
import type { SupportedLanguage } from '@/lib/helios/types';
import { toast } from 'sonner';
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

// Service action badges - consultation actions available across all specialties
const SERVICE_ACTIONS = [
  { label: 'Prescription refill', action: 'prescription-refill' },
  { label: 'New prescription', action: 'prescription-new' },
  { label: 'Interpret test results', action: 'test-results' },
  { label: 'Book appointment', action: 'book-appointment' },
  { label: 'Find a specialist', action: 'find-specialist' },
];

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get specialty from URL, default to primary-care
  const specialty = searchParams.get('specialty') || 'primary-care';
  const quickSymptoms = SPECIALTY_SYMPTOMS[specialty] || SPECIALTY_SYMPTOMS['primary-care'];

  const t = translations[language] || translations.en;

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload an image or PDF file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setUploadPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setUploadPreview(null); // PDF - just show filename
    }
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadPreview(null);
  };

  const handleStart = async () => {
    setIsStarting(true);

    // Build navigation state with file info if attached
    const navState: Record<string, unknown> = {
      language,
      specialty,
    };

    // Add initial message if provided
    if (message.trim()) {
      navState.initialSymptom = message.trim();
    }

    // If file is attached, include file info (the actual upload will happen in the chat)
    // For now, we indicate a file was selected and pass its name
    if (selectedFile) {
      navState.attachedFile = {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
      };
      // If no message but file attached, set a default message
      if (!message.trim()) {
        navState.initialSymptom = 'Please analyze this document';
      }
    }

    navigate('/health/chat/new', { state: navState });
  };

  // Handle service action clicks - start chat with appropriate context
  const handleServiceAction = (action: string) => {
    let initialMessage = '';
    
    switch (action) {
      case 'prescription-refill':
        initialMessage = 'I need to refill a prescription';
        break;
      case 'prescription-new':
        initialMessage = 'I need a new prescription for a condition';
        break;
      case 'test-results':
        initialMessage = 'I need help interpreting my test results';
        break;
      case 'book-appointment':
        initialMessage = "I'd like to book an appointment";
        break;
      case 'find-specialist':
        initialMessage = 'I need to find a specialist near me';
        break;
      default:
        return;
    }
    
    navigate('/health/chat/new', {
      state: { initialSymptom: initialMessage, language, specialty }
    });
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
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
          />

          <div className="relative bg-white rounded-2xl shadow-sm border border-gray-200">
            {/* File preview - shows when file is selected */}
            {selectedFile && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Upload preview" className="h-12 w-12 object-cover rounded" />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="h-4 w-4" />
                    <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                  </div>
                )}
                {uploadPreview && (
                  <span className="text-sm text-gray-600 truncate max-w-[200px]">{selectedFile.name}</span>
                )}
                <button 
                  onClick={clearFile}
                  className="ml-auto p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

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
              {/* Left side buttons */}
              <div className="flex items-center gap-1">
                {/* File upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                {/* Voice button */}
                <button
                  onClick={() => setShowVoiceModal(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Start Voice Consultation"
                >
                  <Mic className="h-5 w-5" />
                </button>
              </div>

              <Button
                onClick={handleStart}
                disabled={isStarting && !message.trim() && !selectedFile}
                className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90 text-white rounded-lg px-6"
              >
                {message.trim() || selectedFile ? t.getStarted : t.startChat}
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

        {/* Service action badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {SERVICE_ACTIONS.map((service) => (
            <button
              key={service.action}
              onClick={() => handleServiceAction(service.action)}
              className="px-4 py-2 bg-white rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 border border-gray-200 transition-colors"
            >
              {service.label}
            </button>
          ))}
        </div>

        {/* Symptom quick actions - dynamic based on specialty */}
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {quickSymptoms.map((symptom) => (
            <button
              key={symptom}
              onClick={() => setMessage(`${t.experiencing} ${symptom.toLowerCase()}`)}
              className="px-4 py-2 bg-white rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 border border-gray-200 transition-colors"
            >
              {symptom}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
