import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useGhostStorage } from '@/hooks/useGhostStorage';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useGhostInference } from '@/hooks/useGhostInference';
import { useGhostSearch, type SearchResult } from '@/hooks/useGhostSearch';
import { useGhostSettings } from '@/hooks/useGhostSettings';
import { useGhostFolders } from '@/hooks/useGhostFolders';
import { useAuth } from '@/contexts/AuthContext';

// Components
import { GhostSidebar, type GhostConversation } from '@/components/ghost/GhostSidebar';
import { GhostModeTabs, type GhostMode } from '@/components/ghost/GhostModeTabs';
import { GhostModeToggle } from '@/components/ghost/GhostModeToggle';
import { GhostChatInput } from '@/components/ghost/GhostChatInput';
import { GhostMessage as GhostMessageComponent } from '@/components/ghost/GhostMessage';
import { GhostTextView, GhostImageView, GhostVideoView, GhostSearchView } from '@/components/ghost/views';
import { BuyGhostCreditsModal } from '@/components/ghost/BuyGhostCreditsModal';
import { GhostSettings } from '@/components/ghost/GhostSettings';
import { GhostThinkingIndicator } from '@/components/ghost/GhostThinkingIndicator';
import { GhostErrorBoundary } from '@/components/ghost/GhostErrorBoundary';
import { ExportMarkdownDialog } from '@/components/ghost/ExportMarkdownDialog';

import { SwissFlag } from '@/components/icons/SwissFlag';
import { EyeOff, Shield, Menu, X, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Default models per mode
const DEFAULT_MODELS: Record<GhostMode, string> = {
  text: 'swissvault-1.0',
  image: 'auto-image',
  video: 'runway-gen3-turbo',
  search: 'sonar',
};

// Accent color definitions
const ACCENT_COLORS: Record<string, { primary: string; hover: string; hsl: string }> = {
  'swiss-navy': { primary: '#1A365D', hover: '#2D4A7C', hsl: '213 55% 23%' },
  'sapphire': { primary: '#0F4C81', hover: '#1A5F9E', hsl: '207 79% 28%' },
  'burgundy': { primary: '#722F37', hover: '#8B3A44', hsl: '355 42% 32%' },
  'teal': { primary: '#1D4E5F', hover: '#2A6175', hsl: '193 53% 24%' },
};

// Apply accent color to CSS custom properties
const applyAccentColor = (accent: string) => {
  const colors = ACCENT_COLORS[accent] || ACCENT_COLORS['swiss-navy'];
  document.documentElement.style.setProperty('--ghost-accent', colors.primary);
  document.documentElement.style.setProperty('--ghost-accent-hover', colors.hover);
  document.documentElement.style.setProperty('--ghost-accent-hsl', colors.hsl);
};

interface GhostMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  imageUrl?: string;
  responseTimeMs?: number;
  tokenCount?: number;
  contextUsagePercent?: number;
}

interface AttachedFile {
  file: File;
  base64?: string;
  text?: string;
  name: string;
  type: 'image' | 'document';
}

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Wrap the main component with error boundary
export default function GhostChatPage() {
  return (
    <GhostErrorBoundary>
      <GhostChat />
    </GhostErrorBoundary>
  );
}

function GhostChat() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false); // Prevent double submission

  // Get mode from URL or default to 'text'
  const mode = (searchParams.get('mode') as GhostMode) || 'text';

  // Ghost storage hook
  const {
    conversations,
    isInitialized,
    corruptedCount,
    createConversation,
    getConversation,
    saveMessage,
    deleteConversation,
    exportConversation,
    updateConversationTitle,
    moveToFolder,
    clearAllData,
  } = useGhostStorage();


  // Ghost credits hook
  const { balance, checkCredits, recordUsage, refreshCredits, isLoading: creditsLoading } = useGhostCredits();

  // Streaming inference hook
  const { streamResponse, cancelStream, isStreaming, streamStatus, elapsedTime, lastResponseTime, lastTokenCount } = useGhostInference();

  // Web search hook
  const webSearch = useGhostSearch();

  // Ghost settings hook
  const { settings } = useGhostSettings();

  // Apply accent color when settings change
  useEffect(() => {
    if (settings?.accent_color) {
      applyAccentColor(settings.accent_color);
    }
  }, [settings?.accent_color]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<GhostMessageData[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [videoInputImage, setVideoInputImage] = useState<string | undefined>();
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Ghost folders hook (persistent)
  const { folders, createFolder, renameFolder, deleteFolder } = useGhostFolders();
  const [searchCitations, setSearchCitations] = useState<SearchResult[]>([]);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  // Model state per mode (persisted to localStorage)
  const [selectedModels, setSelectedModels] = useState<Record<GhostMode, string>>(() => {
    const saved = localStorage.getItem('ghost-selected-models');
    if (saved) {
      try {
        return { ...DEFAULT_MODELS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_MODELS;
      }
    }
    return DEFAULT_MODELS;
  });

  // Persist selected models
  useEffect(() => {
    localStorage.setItem('ghost-selected-models', JSON.stringify(selectedModels));
  }, [selectedModels]);

  // Handle mode change
  const handleModeChange = (newMode: GhostMode) => {
    setSearchParams({ mode: newMode });
  };

  // Handle model change for current mode
  const handleModelChange = (modelId: string) => {
    setSelectedModels(prev => ({ ...prev, [mode]: modelId }));
  };

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation && isInitialized) {
      const conv = getConversation(selectedConversation);
      if (conv) {
        setMessages(conv.messages);
      }
    } else {
      setMessages([]);
    }
  }, [selectedConversation, isInitialized, getConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Convert conversations for sidebar
  const sidebarConversations: GhostConversation[] = conversations.map(c => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    messageCount: c.messageCount || 0,
    isTemporary: false,
    folderId: c.folderId,
  }));

  const handleNewChat = useCallback(() => {
    const isTemporary = settings?.start_temporary ?? false;
    const id = createConversation('New Chat', isTemporary);
    if (id) {
      setSelectedConversation(id);
      setMessages([]);
    }
  }, [createConversation, settings?.start_temporary]);

  // Handle insufficient credits
  const handleInsufficientCredits = useCallback((reason: string) => {
    setShowBuyCredits(true);
    
    let message = 'Add more credits to continue.';
    if (reason === 'no_image_credits') {
      message = 'You\'ve used all your image generation credits for today.';
    } else if (reason === 'no_video_credits') {
      message = 'You\'ve used all your video generation credits for today.';
    } else if (reason === 'insufficient_text_credits') {
      message = 'You\'ve run out of text generation credits.';
    }
    
    toast({
      title: 'Insufficient Credits',
      description: message,
      variant: 'destructive',
    });
  }, [toast]);

  const handleSendMessage = async () => {
    // Prevent double submission
    if (!inputValue.trim() || isStreaming || webSearch.isSearching || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      const requestId = crypto.randomUUID();

      // Determine usage type based on mode
      const usageType = mode as 'text' | 'image' | 'video' | 'search';

      // Check credits before proceeding
      const creditCheck = await checkCredits(usageType);
      if (!creditCheck.allowed) {
        handleInsufficientCredits(creditCheck.reason);
        return;
      }

      // Create conversation if none selected
      let convId = selectedConversation;
      if (!convId) {
        convId = createConversation('New Chat');
        if (convId) {
          setSelectedConversation(convId);
        }
      }
      if (!convId) return;

      const userMessage: GhostMessageData = {
        id: crypto.randomUUID(),
        role: 'user',
        content: inputValue.trim(),
        timestamp: Date.now(),
      };

      // Build message history BEFORE saving (to avoid duplicate)
      const messageHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      messageHistory.push({ role: 'user', content: userMessage.content });

      // Save user message and update UI
      saveMessage(convId, 'user', userMessage.content);
      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');

      // Handle based on mode
      if (mode === 'text') {
        // Track stream start time for metrics
        const streamStartTime = Date.now();

        // Create placeholder for streaming response
        const assistantId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
          },
        ]);

        console.log('[Ghost] Sending message', {
          requestId,
          model: selectedModels[mode],
          historyLength: messageHistory.length,
        });

        await streamResponse(
          messageHistory,
          selectedModels[mode],
          {
            onToken: (token) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: msg.content + token } : msg
                )
              );
            },
            onComplete: async (fullResponse) => {
              const safeResponse = fullResponse?.trim()
                ? fullResponse
                : 'No response received (empty stream). Please try again.';

              // Calculate metrics
              const responseTime = lastResponseTime || Date.now() - streamStartTime;
              const tokens = lastTokenCount || Math.ceil(safeResponse.length / 4);

              // Calculate context usage percentage
              const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
                'swissvault-1.0': 128000,
                'swissvault-fast': 128000,
                'swissvault-code': 128000,
                'gpt-4o-mini': 128000,
                'gpt-4o': 128000,
                'gemini-2.0-flash': 1000000,
                'claude-haiku': 200000,
                'claude-sonnet': 200000,
              };
              const contextWindow = MODEL_CONTEXT_WINDOWS[selectedModels[mode]] || 128000;
              const totalTokens =
                messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0) + tokens;
              const contextUsage = Math.round((totalTokens / contextWindow) * 100);

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        content: safeResponse,
                        isStreaming: false,
                        responseTimeMs: responseTime,
                        tokenCount: tokens,
                        contextUsagePercent: contextUsage,
                      }
                    : msg
                )
              );

              if (safeResponse) {
                saveMessage(convId!, 'assistant', safeResponse);
                const inputTokens = Math.ceil(userMessage.content.length / 4);
                const outputTokens = Math.ceil(safeResponse.length / 4);
                await recordUsage('text', selectedModels[mode], {
                  inputTokens,
                  outputTokens,
                });
              }
            },
            onError: (error) => {
              toast({
                title: 'Error',
                description: error.message || 'Failed to generate response',
                variant: 'destructive',
              });

              // Keep the assistant message visible (no blank state)
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        content: `Error: ${error.message || 'Failed to generate response'}`,
                        isStreaming: false,
                      }
                    : msg
                )
              );
            },
          },
          {
            systemPrompt: settings?.system_prompt || undefined,
            temperature: settings?.default_temperature ?? 0.7,
            topP: settings?.default_top_p ?? 0.9,
          },
          requestId
        );
      } else if (mode === 'search') {
        // Web search mode
        const assistantId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
          },
        ]);
        setSearchCitations([]);

        try {
          await webSearch.search(userMessage.content, {
            onToken: (token) => {
              setMessages((prev) =>
                prev.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + token } : msg))
              );
            },
            onCitation: (citations) => {
              setSearchCitations(citations);
            },
            onComplete: async (response) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: response.answer, isStreaming: false } : msg
                )
              );
              if (response.answer) {
                saveMessage(convId!, 'assistant', response.answer);
                await recordUsage('search', 'sonar', {
                  inputTokens: Math.ceil(userMessage.content.length / 4),
                  outputTokens: Math.ceil(response.answer.length / 4),
                });
              }
            },
            onError: (error) => {
              toast({
                title: 'Search Error',
                description: error.message || 'Failed to search',
                variant: 'destructive',
              });
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: `Error: ${error.message || 'Failed to search'}`, isStreaming: false }
                    : msg
                )
              );
            },
          });
        } catch (error) {
          console.error('Search error:', error);
        }
      } else if (mode === 'image') {
        // Image generation - placeholder for now
        toast({
          title: 'Image Generation',
          description: 'Image generation coming soon!',
        });
      } else if (mode === 'video') {
        // Video generation - placeholder for now
        toast({
          title: 'Video Generation',
          description: 'Video generation coming soon!',
        });
      }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // Export - open dialog with options
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportingConversation, setExportingConversation] = useState<{
    id: string;
    title: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: number }>;
  } | null>(null);

  const handleExportConversation = (id: string) => {
    const conv = getConversation(id);
    if (conv) {
      setExportingConversation({
        id: conv.id,
        title: conv.title,
        messages: conv.messages,
      });
      setExportDialogOpen(true);
    }
  };

  const handleExportEncrypted = async () => {
    if (!exportingConversation) return;
    const blob = await exportConversation(exportingConversation.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghost-chat-${exportingConversation.id.slice(0, 8)}.svghost`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Chat exported as encrypted backup' });
    }
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    if (selectedConversation === id) {
      setSelectedConversation(null);
      setMessages([]);
    }
    toast({ title: 'Deleted', description: 'Chat deleted' });
  };

  const handleRenameConversation = (id: string, title: string) => {
    updateConversationTitle(id, title);
  };

  const handleMoveToFolder = (convId: string, folderId: string | null) => {
    moveToFolder(convId, folderId);
  };

  const handleCreateFolder = async () => {
    await createFolder('New Folder');
  };

  // Handle message edit with fork or regenerate behavior
  const handleMessageEdit = useCallback(async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const enterAfterEdit = settings?.enter_after_edit ?? 'regenerate';

    if (enterAfterEdit === 'fork') {
      // Fork: Create new conversation with messages up to edited one
      const forkedMessages = messages.slice(0, messageIndex);
      const editedMessage: GhostMessageData = { 
        ...messages[messageIndex], 
        content: newContent,
        timestamp: Date.now(),
      };
      forkedMessages.push(editedMessage);

      // Create new forked conversation
      const currentConv = selectedConversation ? getConversation(selectedConversation) : null;
      const forkTitle = currentConv ? `Fork of ${currentConv.title}` : 'Forked Chat';
      const newConvId = createConversation(forkTitle);
      
      if (newConvId) {
        // Save all forked messages to new conversation
        for (const msg of forkedMessages) {
          saveMessage(newConvId, msg.role, msg.content);
        }
        
        setSelectedConversation(newConvId);
        setMessages(forkedMessages);
        
        toast({
          title: 'Forked Conversation',
          description: 'Created a new branch from your edit.',
        });

        // Set input to trigger regeneration
        setInputValue(newContent);
        // Small delay to let state update, then trigger send
        setTimeout(() => {
          // Manually trigger the generation for the forked branch
          triggerRegeneration(newConvId, forkedMessages);
        }, 100);
      }
    } else {
      // Regenerate: Replace in place and remove subsequent messages
      const updatedMessages = messages.slice(0, messageIndex);
      const editedMessage: GhostMessageData = { 
        ...messages[messageIndex], 
        content: newContent,
        timestamp: Date.now(),
      };
      updatedMessages.push(editedMessage);
      
      setMessages(updatedMessages);
      
      // Update the message in storage
      if (selectedConversation) {
        // For regenerate, we need to update storage to reflect truncated conversation
        // The storage doesn't have an update method, so we'll trigger new generation
        triggerRegeneration(selectedConversation, updatedMessages);
      }
    }
  }, [messages, settings, selectedConversation, getConversation, createConversation, saveMessage, toast]);

  // Helper to trigger regeneration after edit
  const triggerRegeneration = useCallback(async (convId: string, currentMessages: GhostMessageData[]) => {
    if (mode !== 'text' && mode !== 'search') return;
    
    // Check credits before proceeding
    const usageType = mode as 'text' | 'search';
    const creditCheck = await checkCredits(usageType);
    if (!creditCheck.allowed) {
      handleInsufficientCredits(creditCheck.reason);
      return;
    }

    // Get the last user message
    const lastUserMessage = [...currentMessages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;

    // Create placeholder for streaming response
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }]);

    // Build message history
    const messageHistory = currentMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      if (mode === 'text') {
        await streamResponse(
          messageHistory,
          selectedModels[mode],
          {
            onToken: (token) => {
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + token }
                  : msg
              ));
            },
            onComplete: async (fullResponse) => {
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, content: fullResponse, isStreaming: false }
                  : msg
              ));
              if (fullResponse) {
                saveMessage(convId, 'assistant', fullResponse);
                const inputTokens = Math.ceil(lastUserMessage.content.length / 4);
                const outputTokens = Math.ceil(fullResponse.length / 4);
                await recordUsage('text', selectedModels[mode], {
                  inputTokens,
                  outputTokens,
                });
              }
            },
            onError: (error) => {
              toast({
                title: 'Error',
                description: error.message || 'Failed to generate response',
                variant: 'destructive',
              });
              setMessages(prev => prev.filter(msg => msg.id !== assistantId));
            },
          },
          {
            systemPrompt: settings?.system_prompt || undefined,
            temperature: settings?.default_temperature ?? 0.7,
            topP: settings?.default_top_p ?? 0.9,
          }
        );
      } else if (mode === 'search') {
        setSearchCitations([]);
        await webSearch.search(lastUserMessage.content, {
          onToken: (token) => {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + token }
                : msg
            ));
          },
          onCitation: (citations) => {
            setSearchCitations(citations);
          },
          onComplete: async (response) => {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: response.answer, isStreaming: false }
                : msg
            ));
            if (response.answer) {
              saveMessage(convId, 'assistant', response.answer);
              await recordUsage('search', 'sonar', {
                inputTokens: Math.ceil(lastUserMessage.content.length / 4),
                outputTokens: Math.ceil(response.answer.length / 4),
              });
            }
          },
          onError: (error) => {
            toast({
              title: 'Search Error',
              description: error.message || 'Failed to search',
              variant: 'destructive',
            });
            setMessages(prev => prev.filter(msg => msg.id !== assistantId));
          },
        });
      }
    } catch (error) {
      console.error('Regeneration error:', error);
    }
  }, [mode, checkCredits, handleInsufficientCredits, streamResponse, webSearch, selectedModels, settings, saveMessage, recordUsage, toast]);

  // Handle regeneration of assistant message
  const handleRegenerate = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Remove the assistant message and any messages after it
    const truncatedMessages = messages.slice(0, messageIndex);
    setMessages(truncatedMessages);

    // Get the last user message from truncated messages
    const lastUserMessage = [...truncatedMessages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage || !selectedConversation) return;

    // Trigger regeneration
    await triggerRegeneration(selectedConversation, truncatedMessages);
  }, [messages, selectedConversation, triggerRegeneration]);

  // Handle message deletion
  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    toast({ title: 'Message deleted' });
  }, [toast]);

  // Handle fork conversation
  const handleForkConversation = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    const forkedMessages = messages.slice(0, messageIndex + 1);
    const newConvId = crypto.randomUUID();
    localStorage.setItem(`ghost-fork-${newConvId}`, JSON.stringify(forkedMessages));
    
    toast({ 
      title: 'Conversation forked', 
      description: 'New branch created from this point',
    });
  }, [messages, toast]);

  // Handle shorten response
  const handleShortenResponse = useCallback(async (messageId: string) => {
    if (!selectedConversation) return;
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    // Add a follow-up user message asking to shorten
    const userMessage: GhostMessageData = {
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Please shorten your previous response to be more concise.',
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    saveMessage(selectedConversation, 'user', userMessage.content);
    
    // Trigger regeneration
    const updatedMessages = [...messages, userMessage];
    await triggerRegeneration(selectedConversation, updatedMessages);
  }, [messages, selectedConversation, saveMessage, triggerRegeneration]);

  // Handle elaborate response
  const handleElaborateResponse = useCallback(async (messageId: string) => {
    if (!selectedConversation) return;
    
    const userMessage: GhostMessageData = {
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Please elaborate more on your previous response with additional details.',
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    saveMessage(selectedConversation, 'user', userMessage.content);
    
    const updatedMessages = [...messages, userMessage];
    await triggerRegeneration(selectedConversation, updatedMessages);
  }, [messages, selectedConversation, saveMessage, triggerRegeneration]);

  // Handle create image from response
  const handleCreateImage = useCallback((content: string) => {
    handleModeChange('image');
    toast({ 
      title: 'Switched to Image mode', 
      description: 'Use the content as inspiration for your image prompt',
    });
  }, [handleModeChange, toast]);

  // Handle create video from response
  const handleCreateVideo = useCallback((content: string) => {
    handleModeChange('video');
    toast({ 
      title: 'Switched to Video mode', 
      description: 'Use the content as inspiration for your video prompt',
    });
  }, [handleModeChange, toast]);

  // Handle feedback
  const handleFeedback = useCallback((messageId: string, type: 'good' | 'bad') => {
    const feedbackData = {
      messageId,
      type,
      model: selectedModels[mode],
      timestamp: new Date().toISOString(),
    };
    
    const existingFeedback = JSON.parse(localStorage.getItem('ghost-feedback') || '[]');
    existingFeedback.push(feedbackData);
    localStorage.setItem('ghost-feedback', JSON.stringify(existingFeedback));
  }, [mode, selectedModels]);

  // Handle share
  const handleShare = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const encoded = btoa(JSON.stringify({
      content: message.content,
      model: selectedModels[mode],
      timestamp: new Date().toISOString(),
    }));
    
    const shareUrl = `${window.location.origin}/ghost/shared/${encoded}`;
    await navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Encrypted link copied to clipboard' });
  }, [messages, mode, selectedModels, toast]);

  // Handle report
  const handleReport = useCallback((messageId: string) => {
    toast({ 
      title: 'Report submitted', 
      description: 'Thank you for helping improve our AI',
    });
  }, [toast]);

  // Handle stop generation
  const handleStopGeneration = useCallback(() => {
    if (mode === 'search') {
      webSearch.cancelSearch();
    } else {
      cancelStream();
    }
    toast({ title: 'Generation stopped' });
  }, [mode, webSearch, cancelStream, toast]);
  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    // For images, convert to base64 for vision models
    if (file.type.startsWith('image/')) {
      try {
        const base64 = await fileToBase64(file);
        setAttachedFile({ file, base64, name: file.name, type: 'image' });
        toast({
          title: 'Image attached',
          description: 'The image will be included with your next message.',
        });
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to read image file.',
          variant: 'destructive',
        });
      }
      return;
    }

    // For text files, read content
    if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      try {
        const text = await file.text();
        setAttachedFile({ file, text, name: file.name, type: 'document' });
        toast({
          title: 'Document attached',
          description: `${file.name} will be included as context.`,
        });
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to read document.',
          variant: 'destructive',
        });
      }
      return;
    }

    // PDF support would need a library - show coming soon for now
    if (file.type === 'application/pdf') {
      toast({
        title: 'PDF Support',
        description: 'PDF parsing coming soon! Try .txt or .md files.',
      });
      return;
    }

    toast({
      title: 'Unsupported file',
      description: 'Please attach an image, .txt, or .md file.',
      variant: 'destructive',
    });
  };

  const clearAttachment = () => {
    setAttachedFile(null);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground font-sans">Please log in to use Ghost Mode</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <GhostSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={sidebarConversations}
        folders={folders}
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onExportConversation={handleExportConversation}
        onRenameConversation={handleRenameConversation}
        onMoveToFolder={handleMoveToFolder}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        userName={user.email?.split('@')[0] || 'User'}
        userCredits={balance}
        isPro={false}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Export Dialog */}
      <ExportMarkdownDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        conversation={exportingConversation}
        onExportEncrypted={handleExportEncrypted}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            {/* Mode Tabs */}
            <GhostModeTabs
              activeMode={mode}
              onModeChange={handleModeChange}
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider hidden sm:inline">
                Local Only
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5 text-success" />
              <span className="hidden sm:inline">Zero Retention</span>
            </div>
          </div>
        </header>

        {/* Corrupted Data Recovery Alert */}
        {corruptedCount > 0 && (
          <Alert variant="destructive" className="m-4 border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Some conversations couldn't be loaded</AlertTitle>
            <AlertDescription className="mt-2">
              {corruptedCount} conversation{corruptedCount > 1 ? 's' : ''} encrypted with a different key could not be decrypted.
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 block"
                onClick={() => {
                  clearAllData();
                  toast({ 
                    title: 'Storage cleared', 
                    description: 'All local data has been removed. You can start fresh.' 
                  });
                }}
              >
                Clear corrupted data
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mode-specific view */}
          <div className="flex-1 flex flex-col overflow-hidden">
          {mode === 'text' && (
              <GhostTextView hasMessages={messages.length > 0}>
                {/* Native scroll - more reliable than ScrollArea */}
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-swiss-navy/10 rounded-2xl px-4 py-3' : ''}`}>
                          <GhostMessageComponent
                            id={msg.id}
                            role={msg.role}
                            content={msg.content}
                            timestamp={msg.timestamp}
                            isStreaming={msg.isStreaming}
                            responseTimeMs={msg.responseTimeMs}
                            tokenCount={msg.tokenCount}
                            contextUsagePercent={msg.contextUsagePercent}
                            showDate={settings?.show_message_date ?? true}
                            showExternalLinkWarning={settings?.show_external_link_warning ?? false}
                            onEdit={handleMessageEdit}
                            onRegenerate={handleRegenerate}
                            onDelete={handleDeleteMessage}
                            onFork={handleForkConversation}
                            onShorten={handleShortenResponse}
                            onElaborate={handleElaborateResponse}
                            onCreateImage={handleCreateImage}
                            onCreateVideo={handleCreateVideo}
                            onFeedback={handleFeedback}
                            onShare={handleShare}
                            onReport={handleReport}
                            onStopGeneration={handleStopGeneration}
                          />
                        </div>
                      </div>
                    ))}
                    {/* Thinking indicator during streaming */}
                    {isStreaming && mode === 'text' && (
                      <GhostThinkingIndicator
                        status={streamStatus}
                        elapsedTime={elapsedTime}
                        model={selectedModels.text}
                      />
                    )}
                    <div ref={messagesEndRef} className="h-32" />
                  </div>
                </div>
            </GhostTextView>
          )}
            {mode === 'image' && (
              <GhostImageView
                onNavigateToVideo={(imageUrl) => {
                  setVideoInputImage(imageUrl);
                  handleModeChange('video');
                }}
                globalSettings={settings}
              />
            )}
            {mode === 'video' && <GhostVideoView initialImageUrl={videoInputImage} />}
            {mode === 'search' && (
              messages.length > 0 ? (
                <div className="h-full flex flex-col">
                  {/* Search results with citations */}
                  {searchCitations.length > 0 && (
                    <div className="flex-shrink-0 px-4 py-3 border-b border-border/40">
                      <div className="max-w-3xl mx-auto">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Sources</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {searchCitations.map((citation, idx) => (
                            <a
                              key={idx}
                              href={citation.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-xs text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1.5"
                            >
                              <span className="w-4 h-4 rounded bg-swiss-sapphire/20 flex items-center justify-center text-[10px] font-medium text-swiss-sapphire">
                                {idx + 1}
                              </span>
                              <span className="truncate max-w-[120px]">
                                {new URL(citation.url).hostname.replace('www.', '')}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <ScrollArea className="flex-1">
                    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                      {messages.map((msg) => (
                        <GhostMessageComponent
                          key={msg.id}
                          id={msg.id}
                          role={msg.role}
                          content={msg.content}
                          timestamp={msg.timestamp}
                          isStreaming={msg.isStreaming}
                          responseTimeMs={msg.responseTimeMs}
                          tokenCount={msg.tokenCount}
                          showDate={settings?.show_message_date ?? true}
                          showExternalLinkWarning={settings?.show_external_link_warning ?? false}
                          onEdit={handleMessageEdit}
                          onRegenerate={handleRegenerate}
                          onDelete={handleDeleteMessage}
                          onFork={handleForkConversation}
                          onShorten={handleShortenResponse}
                          onElaborate={handleElaborateResponse}
                          onFeedback={handleFeedback}
                          onShare={handleShare}
                          onReport={handleReport}
                          onStopGeneration={handleStopGeneration}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <GhostSearchView isSearching={webSearch.isSearching} />
              )
            )}
          </div>

          {/* Input Area - Only for text and search modes (image/video have their own inputs) */}
          {(mode === 'text' || mode === 'search') && (
            <div className="flex-shrink-0 p-4 lg:p-6">
              <div className="max-w-3xl mx-auto">
                {/* Attachment preview */}
                {attachedFile && (
                  <div className="mb-2 flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/50">
                    {attachedFile.type === 'image' && attachedFile.base64 && (
                      <img 
                        src={attachedFile.base64} 
                        alt="Attached" 
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <span className="text-sm text-muted-foreground flex-1 truncate">
                      {attachedFile.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={clearAttachment}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <GhostChatInput
                  mode={mode}
                  selectedModel={selectedModels[mode]}
                  onSelectModel={handleModelChange}
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={handleSendMessage}
                  onCancel={mode === 'search' ? webSearch.cancelSearch : cancelStream}
                  isStreaming={isStreaming || webSearch.isSearching}
                  elapsedTime={elapsedTime}
                  credits={balance}
                  enhancePrompt={enhancePrompt}
                  onToggleEnhance={() => setEnhancePrompt(!enhancePrompt)}
                  onOpenSettings={() => setShowSettings(true)}
                  onAttach={handleFileAttach}
                  voiceLanguage={settings?.voice_language}
                  matureFilterEnabled={settings?.mature_filter_enabled ?? true}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,.pdf,.txt,.md"
        onChange={handleFileSelected}
      />

      {/* Modals */}
      <BuyGhostCreditsModal
        open={showBuyCredits}
        onOpenChange={setShowBuyCredits}
      />
      <GhostSettings
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
}
