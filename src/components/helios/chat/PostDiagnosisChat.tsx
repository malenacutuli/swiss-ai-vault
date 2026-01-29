/**
 * Post-Diagnosis Chat Enhancement
 * Handles continuing chat after diagnosis with persistent booking prompts
 */

import React, { useState, useEffect } from 'react';
import { Video, MessageCircle, FileText, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';
import { InlineDoctorPrompt } from './InlineDoctorPrompt';
import { DoctorBookingCTA } from './DoctorBookingCTA';
import type { Message } from '@/lib/helios/types';
import type { SOAPNote } from '@/lib/helios/reports/soapGenerator';

interface PostDiagnosisChatProps {
  messages: Message[];
  soap: SOAPNote;
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onBookDoctor: () => void;
  onDownloadSOAP: () => void;
  onShareSummary: () => void;
  onViewAssessment: () => void;
  onViewSOAPNote: () => void;
}

export function PostDiagnosisChat({
  messages,
  soap,
  isLoading,
  onSendMessage,
  onBookDoctor,
  onDownloadSOAP,
  onShareSummary,
  onViewAssessment,
  onViewSOAPNote,
}: PostDiagnosisChatProps) {
  const [input, setInput] = useState('');
  const [showFullCTA, setShowFullCTA] = useState(true);
  const [messageCount, setMessageCount] = useState(0);

  // Show full CTA every 3 messages
  useEffect(() => {
    const postDiagnosisMessages = messages.filter(m =>
      new Date(m.timestamp) > new Date(soap.generatedAt)
    ).length;

    setMessageCount(postDiagnosisMessages);
    setShowFullCTA(postDiagnosisMessages % 3 === 0);
  }, [messages, soap.generatedAt]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  // Determine urgency based on triage level
  const urgency = soap.plan.urgency === 'emergent' || soap.plan.urgency === 'urgent'
    ? 'high'
    : soap.plan.urgency === 'semi_urgent'
    ? 'medium'
    : 'low';

  return (
    <div className="flex flex-col h-full">
      {/* Summary Actions Bar */}
      <div className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewAssessment}
            className="text-blue-600"
          >
            <FileText className="w-4 h-4 mr-2" />
            Assessment & Plan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewSOAPNote}
            className="text-blue-600"
          >
            <FileText className="w-4 h-4 mr-2" />
            SOAP Note
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadSOAP}
            className="text-blue-600"
          >
            Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onShareSummary}
            className="text-blue-600"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <React.Fragment key={message.message_id || index}>
              <ChatMessage message={message} />

              {/* Add inline doctor prompt after every AI message post-diagnosis */}
              {message.role === 'assistant' &&
               new Date(message.timestamp) > new Date(soap.generatedAt) &&
               !showFullCTA && (
                <InlineDoctorPrompt onBook={onBookDoctor} />
              )}
            </React.Fragment>
          ))}

          {/* Full CTA periodically */}
          {showFullCTA && (
            <DoctorBookingCTA
              urgency={urgency}
              onBook={onBookDoctor}
            />
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </div>

      {/* "What do you want to do next?" section */}
      {messageCount === 0 && (
        <div className="border-t bg-white px-4 py-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="border-l-4 border-gray-300 h-8 mx-auto w-0 mb-4" />

            <h3 className="text-xl font-semibold mb-6">What do you want to do next?</h3>

            <div className="flex justify-center gap-4 mb-4">
              <Button
                onClick={onBookDoctor}
                variant="outline"
                className="flex items-center gap-2 px-6 py-3 h-auto"
              >
                <Video className="w-5 h-5 text-blue-600" />
                <span>See a Doctor</span>
              </Button>

              <Button
                onClick={() => document.getElementById('chat-input')?.focus()}
                variant="outline"
                className="flex items-center gap-2 px-6 py-3 h-auto"
              >
                <MessageCircle className="w-5 h-5 text-blue-600" />
                <span>Continue</span>
              </Button>
            </div>

            <p className="text-gray-500 text-sm">
              Book a video visit with a doctor. Appointments available immediately.
              <br />Insurance accepted, but not required.
            </p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-white px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a follow-up question..."
              className="flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-6 bg-[#2196F3] hover:bg-[#1976D2]"
            >
              Send
            </Button>
          </div>

          {/* Persistent reminder */}
          <p className="text-center text-xs text-gray-400 mt-3">
            Remember: A licensed doctor can provide personalized medical advice.
            <button onClick={onBookDoctor} className="text-blue-600 underline ml-1">
              Book now
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
