/**
 * HELIOS Chat Page V2
 * Complete flow with diagnosis → summary → booking
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Send, Mic, Paperclip, Camera, Loader2, Share2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useHeliosChat } from '@/hooks/helios/useHeliosChat';
import { useHealthVault } from '@/hooks/helios/useHealthVault';
import { ChatMessage } from './ChatMessage';
import { IntakeForm } from './IntakeForm';
import { RedFlagAlert } from './RedFlagAlert';
import { ShareModal } from './ShareModal';
import { SummaryPage } from '../reports/SummaryPage';
import { PostDiagnosisChat } from './PostDiagnosisChat';
import { generateSOAPNote } from '@/lib/helios/reports/soapGenerator';
import { generateSOAPNotePDF, downloadPDF } from '@/lib/helios/reports/pdfGenerator';
import { BookingModal } from '../booking/BookingModal';
import type { SOAPNote } from '@/lib/helios/reports/soapGenerator';
import type { CaseState } from '@/lib/helios/types';
import { cn } from '@/lib/utils';

type PageView = 'chat' | 'summary' | 'post-diagnosis';

export function HeliosChatPageV2() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const initialMessage = (location.state as { initialMessage?: string })?.initialMessage;

  const [view, setView] = useState<PageView>('chat');
  const [input, setInput] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showIntake, setShowIntake] = useState(true);
  const [soap, setSoap] = useState<SOAPNote | null>(null);
  const [diagnosisComplete, setDiagnosisComplete] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { vault, isInitialized } = useHealthVault();

  const {
    messages,
    isLoading,
    isEscalated,
    redFlags,
    phase,
    caseState,
    sendMessage,
    uploadDocument,
    error,
  } = useHeliosChat(sessionId!, vault);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if diagnosis is complete (phase is 'summary' or 'complete')
  useEffect(() => {
    if (phase === 'documentation' || phase === 'completed') {
      if (caseState && !diagnosisComplete) {
        // Generate SOAP note
        const generatedSoap = generateSOAPNote(caseState);
        setSoap(generatedSoap);
        setDiagnosisComplete(true);
        setView('summary');
      }
    }
  }, [phase, caseState, diagnosisComplete]);

  // Send initial message after intake
  useEffect(() => {
    if (initialMessage && messages.length === 1 && !showIntake) {
      sendMessage(initialMessage);
    }
  }, [initialMessage, messages.length, showIntake, sendMessage]);

  const handleSend = async () => {
    if (!input.trim() && pendingFiles.length === 0) return;
    if (isLoading) return;

    const messageText = input.trim();
    setInput('');

    // Upload files
    for (const file of pendingFiles) {
      await uploadDocument(file);
    }
    setPendingFiles([]);

    if (messageText) {
      await sendMessage(messageText);
    }
  };

  const handleIntakeComplete = async (data: { age: number; sex: string }) => {
    setShowIntake(false);
    if (initialMessage) {
      await sendMessage(initialMessage, { demographics: data });
    }
  };

  const handleDownloadSOAP = async () => {
    if (!soap) return;
    try {
      const blob = await generateSOAPNotePDF(soap);
      downloadPDF(blob, `HELIOS_SOAP_Note_${sessionId}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  const handleBookDoctor = () => {
    setShowBookingModal(true);
  };

  const handleContinueChat = () => {
    setView('post-diagnosis');
  };

  // Render Summary Page
  if (view === 'summary' && soap) {
    return (
      <>
        <SummaryPage
          soap={soap}
          sessionId={sessionId!}
          onContinueChat={handleContinueChat}
          onBookDoctor={handleBookDoctor}
        />

        {showBookingModal && (
          <BookingModal
            consultId={sessionId}
            soap={soap}
            onClose={() => setShowBookingModal(false)}
            onBook={(data) => {
              console.log('Booking:', data);
              setShowBookingModal(false);
              // Navigate to appointments or show confirmation
            }}
          />
        )}
      </>
    );
  }

  // Render Post-Diagnosis Chat
  if (view === 'post-diagnosis' && soap) {
    return (
      <>
        <PostDiagnosisChat
          messages={messages}
          soap={soap}
          isLoading={isLoading}
          onSendMessage={sendMessage}
          onBookDoctor={handleBookDoctor}
          onDownloadSOAP={handleDownloadSOAP}
          onShareSummary={() => setShowShareModal(true)}
          onViewAssessment={() => setView('summary')}
          onViewSOAPNote={() => setView('summary')}
        />

        {showShareModal && (
          <ShareModal
            sessionId={sessionId!}
            onClose={() => setShowShareModal(false)}
          />
        )}

        {showBookingModal && (
          <BookingModal
            consultId={sessionId}
            soap={soap}
            onClose={() => setShowBookingModal(false)}
            onBook={(data) => {
              console.log('Booking:', data);
              setShowBookingModal(false);
            }}
          />
        )}
      </>
    );
  }

  // Render Main Chat
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div>
          <p className="text-sm text-gray-500">
            Consult started: {new Date().toLocaleString()}
          </p>
          <p className="text-sm font-medium text-amber-600">
            If this is an emergency, call 911 or your local emergency number.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowShareModal(true)}
          className="text-gray-600"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>

      {/* Red Flag Alert */}
      {isEscalated && redFlags.length > 0 && (
        <RedFlagAlert redFlags={redFlags} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {showIntake && (
            <IntakeForm onComplete={handleIntakeComplete} />
          )}

          {!showIntake && messages.map((message, index) => (
            <ChatMessage
              key={message.message_id || index}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))}

          {isLoading && (
            <div className="flex items-center gap-3 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}

          {/* Writing Summary Indicator */}
          {phase === 'documentation' && (
            <div className="bg-gray-100 rounded-xl p-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">
                Writing Your AI Doctor Consult Summary
              </h3>
              <p className="text-gray-500">Assessing your health details...</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pending Files */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {pendingFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border"
              >
                <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                <button
                  onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== index))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms Checkbox */}
      {!showIntake && messages.length > 0 && (
        <div className="px-4 py-2 border-t bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <label className="flex items-start gap-2 text-xs text-gray-500">
              <input type="checkbox" className="mt-0.5" defaultChecked />
              <span>
                I agree to the <a href="#" className="underline">Terms of Service</a> and
                will discuss all HELIOS output with a doctor. HELIOS is an AI assistant,
                not a licensed doctor, and does not provide medical advice or care.
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 py-4 border-t bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setPendingFiles(prev => [...prev, ...files]);
                e.target.value = '';
              }}
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-500"
            >
              <Paperclip className="w-5 h-5" />
            </Button>

            <div className="flex-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Reply to HELIOS..."
                className="min-h-[44px] max-h-[200px] resize-none"
                rows={1}
              />
            </div>

            <Button
              onClick={handleSend}
              disabled={(!input.trim() && pendingFiles.length === 0) || isLoading}
              className="bg-[#2196F3] hover:bg-[#1976D2]"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-4 py-2 text-center text-xs text-gray-400 bg-gray-50">
        HELIOS is an AI assistant, not a licensed doctor, and does not practice medicine or provide medical advice or care.
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          sessionId={sessionId!}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
