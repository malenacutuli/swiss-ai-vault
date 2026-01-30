// src/components/helios/chat/HeliosChatPageV2.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useHeliosChat } from '@/hooks/helios/useHeliosChat';
import { useHeliosVoice } from '@/hooks/helios/useHeliosVoice';
import { useHealthVault } from '@/hooks/helios/useHealthVault';
import { ChatMessage } from './ChatMessage';
import { IntakeForm } from './IntakeForm';
import { RedFlagAlert } from './RedFlagAlert';
import { VoiceConsultation } from '../voice/VoiceConsultation';
import { AssessmentPanel } from '../assessment/AssessmentPanel';
import { downloadSOAPPDF } from '@/utils/generateSOAPPDF';
import { Loader2, Send, Paperclip, Mic, MicOff, X, Image, Globe, Save, Check, CheckCircle2, Download, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

interface HeliosChatPageV2Props {
  specialty?: string;
}

export function HeliosChatPageV2({ specialty: propSpecialty = 'primary-care' }: HeliosChatPageV2Props) {
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Support both initialMessage and initialSymptom for backwards compatibility
  const initialSymptom = (location.state as any)?.initialSymptom || (location.state as any)?.initialMessage;
  // Get specialty from navigation state (from HeliosHome) or fall back to prop
  const specialty = (location.state as any)?.specialty || propSpecialty;

  const {
    messages,
    isLoading,
    isLoadingOrchestrator,
    isEscalated,
    redFlags,
    phase,
    caseState,
    intakeRequired,
    sessionId,
    uiTriggers,
    orchestration,
    sendMessage,
    submitIntake,
    submitFeedback,
    startSession,
    loadSession,
    completeSession,
  } = useHeliosChat(specialty);

  const [input, setInput] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [pendingInitialSymptom, setPendingInitialSymptom] = useState<string | null>(initialSymptom || null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState('en');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input (uses selected language)
  const {
    isRecording,
    transcript,
    error: voiceError,
    isSupported: voiceSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useHeliosVoice(language);

  // Health vault for saving consults
  const { vault, isInitialized: vaultReady } = useHealthVault();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  // Load existing session or create new one
  useEffect(() => {
    const initSession = async () => {
      if (sessionInitialized) return;
      setSessionInitialized(true);

      // If URL has a session ID that's not 'new', try to load it
      if (urlSessionId && urlSessionId !== 'new') {
        console.log('[HELIOS] Attempting to load session:', urlSessionId);
        const loaded = await loadSession(urlSessionId);
        if (loaded) {
          console.log('[HELIOS] Session resumed from URL:', urlSessionId);
          // Clear pending symptom when resuming existing session
          setPendingInitialSymptom(null);
          return;
        }
        // Session not found, create new and redirect
        console.log('[HELIOS] Session not found, creating new');
      }

      // Create new session
      console.log('[HELIOS] Creating new session');
      await startSession(specialty);
    };

    initSession();
  }, [urlSessionId, loadSession, startSession, specialty, sessionInitialized]);

  // Auto-send initial symptom when terms are accepted
  useEffect(() => {
    if (termsAccepted && pendingInitialSymptom && sessionId && !isLoading) {
      const symptom = pendingInitialSymptom;
      setPendingInitialSymptom(null);
      console.log('[HELIOS] Sending initial symptom:', symptom);
      sendMessage(symptom, language);
    }
  }, [termsAccepted, pendingInitialSymptom, sessionId, isLoading, sendMessage, language]);

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

  // Update input with voice transcript
  useEffect(() => {
    if (transcript) {
      setInput(prev => prev + transcript);
    }
  }, [transcript]);

  // File upload handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      // Allow images and PDFs
      return file.type.startsWith('image/') || file.type === 'application/pdf';
    });
    setAttachedFiles(prev => [...prev, ...validFiles]);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Voice toggle handler
  const handleVoiceToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Save consult to vault
  const handleSaveToRecords = async () => {
    if (!vault || !sessionId || messages.length === 0) return;

    setIsSaving(true);
    try {
      await vault.saveConsult({
        id: sessionId,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        symptoms: [],
        hypotheses: [],
        redFlags: redFlags,
        language: language,
        phase: phase,
      });
      setIsSaved(true);
      // Reset saved indicator after 3 seconds
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save consult:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Download SOAP note as professional PDF
  const handleDownloadSOAPPDF = async () => {
    if (!orchestration || !sessionId) return;

    try {
      // Extract patient info from case state (if available)
      const patientAge = caseState?.patient?.age;
      const patientSex = caseState?.patient?.sex;

      // Build SOAP data from orchestration response
      const soapData = {
        subjective: orchestration.soap_note?.subjective || '',
        objective: orchestration.soap_note?.objective || '',
        assessment: orchestration.soap_note?.assessment || '',
        plan: orchestration.soap_note?.plan || '',
      };

      // Build session info
      const sessionInfo = {
        sessionId: sessionId,
        chiefComplaint: caseState?.chief_complaint,
        patient: {
          age: patientAge,
          sex: patientSex,
        },
        triageLevel: orchestration.triage?.esi_level,
        disposition: orchestration.triage?.disposition,
        consultDate: new Date().toISOString(),
        expertCount: orchestration.consensus?.participating_agents?.length || 0,
        agreementScore: orchestration.consensus?.kendall_w,
        redFlags: orchestration.safety?.red_flags?.map(rf => rf.description) ||
                  orchestration.plan?.red_flag_warnings || [],
      };

      await downloadSOAPPDF(soapData, sessionInfo, {
        includeDisclaimer: true,
        includeMetadata: true,
        language: language as 'en' | 'es' | 'fr',
      });
    } catch (err) {
      console.error('Failed to generate SOAP PDF:', err);
    }
  };

  // Download consult as PDF (conversation summary)
  const handleDownloadPDF = async () => {
    if (messages.length === 0) return;

    try {
      // Dynamic import for code splitting
      const { jsPDF } = await import('jspdf');

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let y = margin;

      // Header
      doc.setFillColor(29, 78, 95);
      doc.rect(0, 0, pageWidth, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('HELIOS AI Health Assistant', margin, 10);
      doc.setTextColor(0, 0, 0);
      y = 25;

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Health Consult Summary', margin, y);
      y += 10;

      // Date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += 10;

      // Session ID
      doc.text(`Session ID: ${sessionId || 'Unknown'}`, margin, y);
      y += 15;

      // Conversation
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Consultation Notes', margin, y);
      y += 8;

      messages.forEach((msg) => {
        // Check for page break
        if (y > 260) {
          doc.addPage();
          y = margin;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(msg.role === 'assistant' ? 'HELIOS:' : 'Patient:', margin, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(msg.content, contentWidth);
        lines.forEach((line: string) => {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += 5;
        });
        y += 5;
      });

      // Disclaimer
      if (y > 230) {
        doc.addPage();
        y = margin;
      }
      y += 10;
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, contentWidth, 25, 'F');
      y += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('DISCLAIMER', margin + 5, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const disclaimer = 'This summary was generated by an AI system (HELIOS) for informational purposes only. It does NOT constitute medical advice. Always consult a licensed healthcare provider.';
      const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth - 10);
      doc.text(disclaimerLines, margin + 5, y);

      // Footer
      const pageCount = (doc as any).internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Page ${i} of ${pageCount} | HELIOS AI Health Assistant | Confidential`,
          pageWidth / 2,
          290,
          { align: 'center' }
        );
      }

      // Download
      doc.save(`helios-consult-${sessionId || 'summary'}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    }
  };

  // Complete consult - saves to Supabase AND local vault
  const handleCompleteConsult = async () => {
    if (!sessionId || messages.length === 0) return;

    setIsSaving(true);
    try {
      // 1. Mark session as completed in Supabase
      const result = await completeSession();
      if (!result.success) {
        console.error('Failed to complete session in Supabase');
      }

      // 2. Also save to local vault for offline access (if vault is available)
      if (vault) {
        await vault.saveConsult({
          id: sessionId,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
          symptoms: [],
          hypotheses: [],
          redFlags: redFlags,
          language: language,
          phase: 'completed',
        });
      }

      setIsCompleted(true);
      // Navigate to post-consult options after short delay
      setTimeout(() => {
        navigate('/health/consults');
      }, 1500);
    } catch (err) {
      console.error('Failed to complete consult:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !termsAccepted) return;

    let message = input;

    // If files are attached, mention them in the message
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => f.name).join(', ');
      message = `[Attached: ${fileNames}]\n\n${message}`;
    }

    setInput('');
    setAttachedFiles([]);
    await sendMessage(message, language);
  };

  // Handle button clicks from chat messages
  const handleButtonClick = async (value: string) => {
    if (isLoading || !termsAccepted) return;
    await sendMessage(value, language, true);
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
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Consult started: {new Date().toLocaleString()}</span>
              <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium capitalize">
                {specialty.replace('-', ' ')}
              </span>
            </div>
            <div className="text-sm text-amber-600 font-medium">
              If this is an emergency, call 911 or your local emergency number.
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Complete Consult button */}
            {vaultReady && messages.length > 2 && !isCompleted && (
              <Button
                variant="default"
                size="sm"
                onClick={handleCompleteConsult}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                )}
                Complete Consult
              </Button>
            )}

            {/* Download PDF button */}
            {messages.length > 0 && !isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                title="Download as PDF"
              >
                <Download className="w-4 h-4 mr-1" />
                PDF
              </Button>
            )}

            {/* Completed indicator */}
            {isCompleted && (
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <Check className="w-4 h-4" />
                <span>Completed! Redirecting...</span>
              </div>
            )}

            {/* Save to Records button (for saving drafts) */}
            {vaultReady && messages.length > 0 && !isCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToRecords}
                disabled={isSaving || isSaved}
                className={isSaved ? "text-green-600 border-green-600" : ""}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : isSaved ? (
                  <Check className="w-4 h-4 mr-1" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                {isSaved ? "Saved" : "Save Draft"}
              </Button>
            )}

            {/* Language selector */}
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Voice Mode Toggle */}
            <Button
              variant={voiceMode ? "default" : "outline"}
              size="sm"
              onClick={() => setVoiceMode(!voiceMode)}
              className={voiceMode ? "bg-teal-600 hover:bg-teal-700" : ""}
            >
              {voiceMode ? (
                <>
                  <PhoneOff className="w-4 h-4 mr-1" />
                  Exit Voice
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-1" />
                  Voice Mode
                </>
              )}
            </Button>
          </div>
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
            onButtonClick={handleButtonClick}
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

        {/* Orchestrator loading indicator */}
        {isLoadingOrchestrator && (
          <div className="flex items-center gap-2 text-teal-600 bg-teal-50 px-4 py-3 rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin" />
            <div>
              <span className="font-medium">Running multi-specialist assessment...</span>
              <p className="text-sm text-teal-700">Multiple AI specialists are analyzing your symptoms</p>
            </div>
          </div>
        )}

        {/* Assessment Panel - shows when orchestration completes */}
        {orchestration && uiTriggers?.showAssessment && (
          <div className="mt-6">
            <AssessmentPanel
              orchestration={orchestration}
              onFeedback={async (rating) => {
                // Map AssessmentPanel rating format to API format
                const ratingMap: Record<string, 'not-helpful' | 'so-so' | 'helpful'> = {
                  'not_helpful': 'not-helpful',
                  'so_so': 'so-so',
                  'helpful': 'helpful',
                };
                const apiRating = ratingMap[rating] || 'helpful';
                console.log('[HELIOS] Submitting feedback:', apiRating);
                const result = await submitFeedback(apiRating);
                if (result.success) {
                  console.log('[HELIOS] Feedback submitted successfully');
                } else {
                  console.error('[HELIOS] Failed to submit feedback');
                }
              }}
              onBookDoctor={() => {
                // Navigate to booking with session context
                navigate(`/health/book/${sessionId}`);
              }}
              onDownloadPDF={handleDownloadSOAPPDF}
              language={language as 'en' | 'es' | 'fr'}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice Consultation Mode OR Text Input */}
      {voiceMode ? (
        <div className="px-6 py-4 border-t bg-gray-50">
          <VoiceConsultation
            sessionId={sessionId || ''}
            specialty={specialty}
            language={language}
            onComplete={(summary) => {
              console.log('[HELIOS] Voice consultation complete:', summary);
              setVoiceMode(false);
              navigate('/health/consults');
            }}
          />
        </div>
      ) : (
        <>
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
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm"
              >
                <Image className="w-4 h-4 text-gray-500" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Voice recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 mb-2 text-red-500">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm">Recording... Click mic to stop</span>
            <button
              onClick={cancelRecording}
              className="text-gray-400 hover:text-gray-600 text-sm underline"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-gray-600"
            onClick={() => fileInputRef.current?.click()}
            disabled={!termsAccepted}
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isRecording ? "Listening..." : "Reply to HELIOS..."}
            disabled={isLoading || !termsAccepted || intakeRequired}
            className="flex-1"
          />

          <Button
            variant="ghost"
            size="icon"
            className={isRecording ? "text-red-500 hover:text-red-600" : "text-gray-400 hover:text-gray-600"}
            onClick={handleVoiceToggle}
            disabled={!termsAccepted || !voiceSupported}
            title={voiceSupported ? (isRecording ? "Stop recording" : "Start voice input") : "Voice not supported"}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !termsAccepted || intakeRequired}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        {voiceError && (
          <p className="text-xs text-red-500 mt-1">{voiceError}</p>
        )}

        <p className="text-xs text-center text-gray-400 mt-2">
          HELIOS is an AI assistant, not a licensed doctor, and does not practice medicine or provide medical advice or care.
        </p>
      </div>
      </>
      )}
    </div>
  );
}
