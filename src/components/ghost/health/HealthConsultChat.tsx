import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface HealthConsultChatProps {
  onClose: () => void;
}

export function HealthConsultChat({ onClose }: HealthConsultChatProps) {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<HealthMessage[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
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
    (c) => c.taskType === 'health_consult' || c.taskType === 'consultation'
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

  const startNewConversation = useCallback(() => {
    if (!isInitialized) return;
    
    const newId = createConversation(
      t('ghost.health.consult.newSession', 'Health Consultation'),
      'forever',
      true,
      'health_consult'
    );
    
    if (newId) {
      setActiveConversationId(newId);
      setMessages([]);
    }
  }, [isInitialized, createConversation, t]);

  const handleSelectConversation = useCallback((convId: string) => {
    setActiveConversationId(convId);
    const conv = getConversation(convId);
    if (conv) {
      setMessages(conv.messages);
    }
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
        'health_consult'
      );
      if (!convId) return;
      setActiveConversationId(convId);
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Save user message locally
    const savedUserMsg = saveMessage(convId, 'user', userMessage);
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
          query: userMessage,
          conversation_history: conversationHistory,
          language: i18n.language,
        },
      });

      if (error) throw error;

      const assistantResponse = data?.response || t('ghost.health.consult.errorResponse', 'I apologize, but I encountered an issue. Please try again.');

      // Save assistant message locally
      const savedAssistantMsg = saveMessage(convId, 'assistant', assistantResponse, undefined, {
        model: data?.model_used || 'claude',
        is_health_related: data?.is_health_related,
      });

      if (savedAssistantMsg) {
        setMessages(prev => [...prev, savedAssistantMsg]);
      }
    } catch (error) {
      console.error('[HealthConsult] Error:', error);
      
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
      `# Health Consultation - ${conv.title}`,
      `Date: ${new Date(conv.createdAt).toLocaleString()}`,
      ``,
      `---`,
      ``,
      ...messages.map(msg => {
        const role = msg.role === 'user' ? 'You' : 'Healthcare AI';
        const time = new Date(msg.timestamp).toLocaleTimeString();
        return `**${role}** (${time}):\n${msg.content}\n`;
      }),
      ``,
      `---`,
      ``,
      `*This consultation was conducted through SwissVault Health AI.*`,
      `*This is not medical advice. Please consult with a healthcare professional for diagnosis and treatment.*`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-consultation-${new Date().toISOString().split('T')[0]}.md`;
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
      <Card className="h-[600px] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-[#2A8C86] animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex overflow-hidden bg-white border-slate-200">
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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-[#2A8C86]/5 to-transparent">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
            <Stethoscope className="w-5 h-5 text-[#2A8C86]" />
            <div>
              <h2 className="text-sm font-medium text-slate-800">
                {t('ghost.health.consult.title', 'Health Consultation')}
              </h2>
              <p className="text-[10px] text-slate-500">
                {t('ghost.health.consult.subtitle', 'AI-powered triage & follow-up questions')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-full bg-[#2A8C86]/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-[#2A8C86]" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">
                {t('ghost.health.consult.welcome', 'Start Your Health Consultation')}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mb-4">
                {t('ghost.health.consult.welcomeDesc', 'Describe your symptoms or health concerns. I\'ll ask follow-up questions to help you understand your situation better.')}
              </p>
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
                        ? 'bg-[#2A8C86] text-white'
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
                    <p
                      className={cn(
                        'text-[10px] mt-2',
                        msg.role === 'user' ? 'text-white/70' : 'text-slate-400'
                      )}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2A8C86]" />
                      <span className="text-sm text-slate-500">
                        {t('ghost.health.consult.thinking', 'Analyzing your question...')}
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
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={t('ghost.health.consult.placeholder', 'Describe your symptoms or health concern...')}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="bg-[#2A8C86] hover:bg-[#2A8C86]/90"
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
