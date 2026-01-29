/**
 * HELIOS Chat Page
 * Full chat interface with document upload, voice, and AI interaction
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Send, Mic, MicOff, Paperclip, Image, FileText,
  AlertTriangle, Loader2, Share2, X, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useHeliosChat } from '@/hooks/helios/useHeliosChat';
import { useHealthVault } from '@/hooks/helios/useHealthVault';
import { ChatMessage } from './ChatMessage';
import { DocumentPreview } from './DocumentPreview';
import { RedFlagAlert } from './RedFlagAlert';
import { IntakeForm } from './IntakeForm';
import { ShareModal } from './ShareModal';
import { cn } from '@/lib/utils';

export function HeliosChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const initialMessage = location.state?.initialMessage;

  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showIntake, setShowIntake] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { vault, isInitialized } = useHealthVault();

  const {
    messages,
    isLoading,
    isEscalated,
    redFlags,
    phase,
    sendMessage,
    uploadDocument,
    error,
  } = useHeliosChat(sessionId!, vault);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send initial message
  useEffect(() => {
    if (initialMessage && messages.length === 1 && !showIntake) {
      sendMessage(initialMessage);
    }
  }, [initialMessage, messages.length, showIntake]);

  const handleSend = async () => {
    if (!input.trim() && pendingFiles.length === 0) return;
    if (isLoading) return;

    const messageText = input.trim();
    setInput('');

    // Upload any pending files first
    for (const file of pendingFiles) {
      await uploadDocument(file);
    }
    setPendingFiles([]);

    // Send text message
    if (messageText) {
      await sendMessage(messageText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleIntakeComplete = async (data: { age: number; sex: string }) => {
    setShowIntake(false);
    // Include demographics with initial message
    if (initialMessage) {
      await sendMessage(initialMessage, { demographics: data });
    }
  };

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
          {/* Intake Form (first message) */}
          {showIntake && (
            <IntakeForm onComplete={handleIntakeComplete} />
          )}

          {!showIntake && messages.map((message, index) => (
            <ChatMessage
              key={message.id || index}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {pendingFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border"
              >
                {file.type.startsWith('image/') ? (
                  <Image className="w-4 h-4 text-gray-500" />
                ) : (
                  <FileText className="w-4 h-4 text-gray-500" />
                )}
                <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                <button
                  onClick={() => removePendingFile(index)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms checkbox (show after first message) */}
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

      {/* Input area */}
      <div className="px-4 py-4 border-t bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            {/* File upload */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
              multiple
              onChange={handleFileSelect}
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-500 hover:text-gray-700"
            >
              <Paperclip className="w-5 h-5" />
            </Button>

            {/* Camera (mobile) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                fileInputRef.current?.setAttribute('capture', 'environment');
                fileInputRef.current?.click();
              }}
              className="text-gray-500 hover:text-gray-700 md:hidden"
            >
              <Camera className="w-5 h-5" />
            </Button>

            {/* Text input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply to HELIOS..."
                className="min-h-[44px] max-h-[200px] resize-none pr-12"
                rows={1}
              />
            </div>

            {/* Voice input */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsRecording(!isRecording)}
              className={cn(
                "text-gray-500 hover:text-gray-700",
                isRecording && "text-red-500 hover:text-red-600"
              )}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            {/* Send */}
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
        HELIOS is an AI doctor, not a licensed doctor, and does not practice medicine or provide medical advice or care.
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
