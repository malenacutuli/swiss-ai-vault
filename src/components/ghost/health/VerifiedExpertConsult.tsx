/**
 * Verified Expert Consult - Enhanced Health Consultation with Document Upload
 * 
 * Features:
 * - Text-based AI triage (Anthropic-powered)
 * - In-chat document upload for contextual analysis
 * - Medical entity extraction
 * - Follow-up questions based on OPQRST framework
 * - Session persistence with local encryption
 * - Transcript download
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useDropzone } from 'react-dropzone';
import { useHealthStorage, ConversationSummary } from '@/hooks/useHealthStorage';
import { HealthConversation, HealthMessage } from '@/lib/health/health-storage';
import { cn } from '@/lib/utils';
import {
  Send,
  Loader2,
  Download,
  Trash2,
  Plus,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Stethoscope,
  X,
  Upload,
  Image,
  FileText,
  Paperclip,
  CheckCircle2,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface VerifiedExpertConsultProps {
  onClose: () => void;
}

interface UploadedDocument {
  id: string;
  filename: string;
  mimeType: string;
  base64: string;
  previewUrl?: string;
  analysisResult?: string;
  isAnalyzing: boolean;
}

export function VerifiedExpertConsult({ onClose }: VerifiedExpertConsultProps) {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<HealthMessage[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [showUploadArea, setShowUploadArea] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    conversations,
    isInitialized,
    isLoading: storageLoading,
    createConversation,
    getConversation,
    deleteConversation,
    saveMessage,
    updateTitle,
    refreshConversations,
  } = useHealthStorage();

  // Filter to only show health consult conversations
  const consultConversations = conversations.filter(
    (c) => c.taskType === 'health_consult' || c.taskType === 'consultation' || c.taskType === 'verified_expert'
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation messages when active conversation changes
  useEffect(() => {
    if (activeConversationId && isInitialized) {
      const conv = getConversation(activeConversationId);
      if (conv) {
        setMessages(conv.messages);
      }
    }
  }, [activeConversationId, isInitialized, getConversation]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversationId]);

  // File to base64 conversion
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      if (file.size > 10 * 1024 * 1024) continue; // Skip files > 10MB
      
      try {
        const base64 = await fileToBase64(file);
        const id = crypto.randomUUID();
        
        const doc: UploadedDocument = {
          id,
          filename: file.name,
          mimeType: file.type,
          base64,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          isAnalyzing: true,
        };
        
        setUploadedDocs(prev => [...prev, doc]);
        
        // Analyze the document
        try {
          const { data, error } = await supabase.functions.invoke('ghost-vision', {
            body: {
              image_base64: base64,
              mime_type: file.type,
              context: 'health_document_analysis',
              prompt: 'Extract and summarize all medical information from this document. Include: dates, values, diagnoses, medications, recommendations. Format as structured data.',
            }
          });
          
          if (!error && data?.analysis) {
            setUploadedDocs(prev => 
              prev.map(d => d.id === id ? { ...d, analysisResult: data.analysis, isAnalyzing: false } : d)
            );
          } else {
            setUploadedDocs(prev => 
              prev.map(d => d.id === id ? { ...d, analysisResult: 'Document received. Analysis pending.', isAnalyzing: false } : d)
            );
          }
        } catch {
          setUploadedDocs(prev => 
            prev.map(d => d.id === id ? { ...d, isAnalyzing: false } : d)
          );
        }
      } catch (err) {
        console.error('File processing error:', err);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 5,
    noClick: !showUploadArea,
    noKeyboard: !showUploadArea,
  });

  const removeDocument = useCallback((id: string) => {
    setUploadedDocs(prev => {
      const doc = prev.find(d => d.id === id);
      if (doc?.previewUrl) {
        URL.revokeObjectURL(doc.previewUrl);
      }
      return prev.filter(d => d.id !== id);
    });
  }, []);

  const startNewConversation = useCallback(() => {
    if (!isInitialized) return;
    
    const newId = createConversation(
      t('ghost.health.consult.newSession', 'Health Consultation'),
      'forever',
      true,
      'verified_expert'
    );
    
    if (newId) {
      setActiveConversationId(newId);
      setMessages([]);
      setUploadedDocs([]);
    }
  }, [isInitialized, createConversation, t]);

  const handleSelectConversation = useCallback((convId: string) => {
    setActiveConversationId(convId);
    const conv = getConversation(convId);
    if (conv) {
      setMessages(conv.messages);
    }
    setUploadedDocs([]);
  }, [getConversation]);

  const handleDeleteConversation = useCallback(async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteConversation(convId);
    if (activeConversationId === convId) {
      setActiveConversationId(null);
      setMessages([]);
    }
  }, [deleteConversation, activeConversationId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Create conversation if none exists
    let convId = activeConversationId;
    if (!convId) {
      convId = createConversation(
        inputValue.slice(0, 50) + (inputValue.length > 50 ? '...' : ''),
        'forever',
        true,
        'verified_expert'
      );
      if (!convId) return;
      setActiveConversationId(convId);
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Build document context if any documents are uploaded
    let documentContext = '';
    if (uploadedDocs.length > 0) {
      documentContext = '\n\n--- UPLOADED DOCUMENTS ---\n\n';
      uploadedDocs.forEach((doc, i) => {
        documentContext += `=== Document ${i + 1}: ${doc.filename} ===\n`;
        documentContext += doc.analysisResult || '[Analysis pending]';
        documentContext += '\n\n';
      });
      documentContext += '--- END OF DOCUMENTS ---\n\n';
    }

    // Save user message locally
    const fullUserMessage = documentContext 
      ? `${userMessage}\n\n[Attached ${uploadedDocs.length} document(s) for analysis]`
      : userMessage;
    
    const savedUserMsg = saveMessage(convId, 'user', fullUserMessage, undefined, {
      attachedDocuments: uploadedDocs.map(d => ({ filename: d.filename, hasAnalysis: !!d.analysisResult }))
    });
    if (savedUserMsg) {
      setMessages(prev => [...prev, savedUserMsg]);
    }

    // Update title if first message
    const conv = getConversation(convId);
    if (conv && conv.messages.length === 1) {
      updateTitle(convId, userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''));
    }

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Call the healthcare triage endpoint (Anthropic-powered)
      const { data, error } = await supabase.functions.invoke('hume-health-tool', {
        body: {
          query: userMessage + documentContext,
          conversation_history: conversationHistory,
          language: i18n.language,
          include_triage: true,
          document_context: uploadedDocs.map(d => ({
            filename: d.filename,
            analysis: d.analysisResult
          }))
        },
      });

      if (error) throw error;

      const assistantResponse = data?.response || t('ghost.health.consult.errorResponse', 'I apologize, but I encountered an issue. Please try again.');

      // Save assistant message locally
      const savedAssistantMsg = saveMessage(convId, 'assistant', assistantResponse, undefined, {
        model: data?.model_used || 'claude',
        is_health_related: data?.is_health_related,
        triage_level: data?.triage_level,
        follow_up_questions: data?.follow_up_questions,
      });

      if (savedAssistantMsg) {
        setMessages(prev => [...prev, savedAssistantMsg]);
      }

      // Clear uploaded docs after sending
      uploadedDocs.forEach(doc => {
        if (doc.previewUrl) URL.revokeObjectURL(doc.previewUrl);
      });
      setUploadedDocs([]);
      setShowUploadArea(false);
    } catch (error) {
      console.error('[VerifiedExpertConsult] Error:', error);
      
      const errorMsg = saveMessage(
        convId,
        'assistant',
        t('ghost.health.consult.errorGeneric', 'I apologize, but I encountered an error. Please try again or consult a healthcare professional.')
      );
      if (errorMsg) {
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleDownloadChat = useCallback(() => {
    if (!activeConversationId || messages.length === 0) return;

    const conv = getConversation(activeConversationId);
    if (!conv) return;

    const content = [
      `# Medical Consultation Transcript`,
      `## ${conv.title}`,
      ``,
      `**Date:** ${new Date(conv.createdAt).toLocaleString()}`,
      `**Session Type:** Verified Expert Consultation`,
      `**Total Messages:** ${messages.length}`,
      ``,
      `---`,
      ``,
      ...messages.map(msg => {
        const role = msg.role === 'user' ? 'Patient' : 'Healthcare AI';
        const time = new Date(msg.timestamp).toLocaleTimeString();
        return `### ${role} (${time})\n\n${msg.content}\n`;
      }),
      ``,
      `---`,
      ``,
      `## Disclaimers`,
      ``,
      `1. **AI-Assisted Documentation**: This transcript was generated with AI assistance.`,
      `2. **Not a Diagnosis**: This document does not constitute medical diagnosis or advice.`,
      `3. **Consult a Professional**: Please discuss findings with a qualified healthcare provider.`,
      ``,
      `*Generated by SwissBrAIn Verified Expert System*`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-consultation-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeConversationId, messages, getConversation]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (storageLoading) {
    return (
      <Card className="h-[650px] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-[#2A8C86] animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="h-[650px] flex overflow-hidden bg-white border-slate-200">
      {/* Sidebar - Conversation History */}
      <div
        className={cn(
          'border-r border-slate-200 bg-slate-50 transition-all duration-300 flex flex-col',
          showSidebar ? 'w-64' : 'w-0 overflow-hidden'
        )}
      >
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('ghost.health.consult.history', 'Consultations')}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={startNewConversation}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {consultConversations.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                {t('ghost.health.consult.noSessions', 'No consultations yet')}
              </p>
            ) : (
              consultConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    'w-full text-left p-2 rounded-lg transition-colors group',
                    activeConversationId === conv.id
                      ? 'bg-[#2A8C86]/10 text-[#2A8C86]'
                      : 'hover:bg-slate-100 text-slate-600'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{conv.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {conv.messageCount} {t('ghost.health.consult.messages', 'messages')} • {new Date(conv.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col" {...getRootProps()}>
        <input {...getInputProps()} />
        
        {/* Header */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-transparent">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-slate-800 flex items-center gap-2">
                {t('ghost.health.verified.consult.title', 'Verified Expert Consult')}
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">
                  AI Triage
                </Badge>
              </h2>
              <p className="text-[10px] text-slate-500">
                {t('ghost.health.verified.consult.subtitle', 'Upload documents & describe symptoms for analysis')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUploadArea(!showUploadArea)}
              className={cn("text-xs gap-1", showUploadArea && "bg-slate-100")}
            >
              <Paperclip className="w-3.5 h-3.5" />
              {t('ghost.health.upload.attachFiles', 'Attach')}
            </Button>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadChat}
                className="text-xs gap-1"
              >
                <Download className="w-3 h-3" />
                {t('ghost.health.consult.download', 'Download')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Upload Area */}
        {showUploadArea && (
          <div className={cn(
            "mx-3 mt-3 p-4 border-2 border-dashed rounded-xl transition-colors",
            isDragActive ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50"
          )}>
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">
                {isDragActive 
                  ? t('ghost.health.upload.dropHere', 'Drop files here')
                  : t('ghost.health.upload.dragOrClick', 'Drag & drop medical documents, lab results, or photos')}
              </p>
              <p className="text-xs text-slate-400 mt-1">Images (PNG, JPG) or PDF • Max 10MB</p>
            </div>
          </div>
        )}

        {/* Uploaded Documents Preview */}
        {uploadedDocs.length > 0 && (
          <div className="px-3 pt-3 flex flex-wrap gap-2">
            {uploadedDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-slate-100 rounded-lg text-xs"
              >
                {doc.previewUrl ? (
                  <img src={doc.previewUrl} alt="" className="w-6 h-6 object-cover rounded" />
                ) : (
                  <FileText className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-slate-600 truncate max-w-[100px]">{doc.filename}</span>
                {doc.isAnalyzing ? (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                ) : doc.analysisResult ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                ) : null}
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="p-0.5 hover:bg-slate-200 rounded"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <Stethoscope className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">
                {t('ghost.health.verified.consult.welcome', 'Verified Expert Consultation')}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mb-4">
                {t('ghost.health.verified.consult.welcomeDesc', 'Upload medical documents or describe your symptoms. I\'ll provide structured triage based on clinical guidelines.')}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <Badge variant="outline" className="text-xs">Lab Results</Badge>
                <Badge variant="outline" className="text-xs">Prescriptions</Badge>
                <Badge variant="outline" className="text-xs">Imaging Reports</Badge>
                <Badge variant="outline" className="text-xs">Symptom Photos</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                {t('ghost.health.consult.disclaimer', 'Not a substitute for professional medical advice')}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-3',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3',
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    )}
                  >
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p
                        className={cn(
                          'text-[10px]',
                          msg.role === 'user' ? 'text-white/70' : 'text-slate-400'
                        )}
                      >
                        {formatTime(msg.timestamp)}
                      </p>
                      {msg.metadata?.attachedDocuments && (
                        <Badge variant="secondary" className="text-[9px]">
                          {msg.metadata.attachedDocuments.length} doc(s)
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span className="text-sm text-slate-500">
                        {t('ghost.health.consult.analyzing', 'Analyzing your information...')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 flex-shrink-0"
              onClick={() => setShowUploadArea(!showUploadArea)}
            >
              <Paperclip className={cn("w-5 h-5", uploadedDocs.length > 0 && "text-emerald-600")} />
            </Button>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={t('ghost.health.verified.consult.placeholder', 'Describe symptoms, ask about documents, or request triage...')}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || (!inputValue.trim() && uploadedDocs.length === 0)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            {t('ghost.health.consult.privacyNote', 'Your conversations are stored locally on your device and encrypted.')}
          </p>
        </div>
      </div>
    </Card>
  );
}
