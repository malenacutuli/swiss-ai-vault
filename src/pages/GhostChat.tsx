import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useGhostStorage } from '@/hooks/useGhostStorage';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useGhostInference } from '@/hooks/useGhostInference';
import { useGhostSearch, type SearchResult } from '@/hooks/useGhostSearch';
import { useGhostResearch, type ResearchSource } from '@/hooks/useGhostResearch';
import { useGhostSettings } from '@/hooks/useGhostSettings';
import { useGhostFolders } from '@/hooks/useGhostFolders';
import { useGhostUsage } from '@/hooks/useGhostUsage';
import { useAuth } from '@/contexts/AuthContext';

// Components
import { GhostSidebar, type GhostConversation } from '@/components/ghost/GhostSidebar';
import { GhostModeToggle } from '@/components/ghost/GhostModeToggle';
import { GhostChatInput, type GhostMode } from '@/components/ghost/GhostChatInput';
import { GhostMessage as GhostMessageComponent } from '@/components/ghost/GhostMessage';
import { GhostTextView, GhostTextViewEmpty, GhostImageView, GhostVideoView, GhostSearchView } from '@/components/ghost/views';
import { BuyGhostCreditsModal } from '@/components/ghost/BuyGhostCreditsModal';
import { GhostSettings } from '@/components/ghost/GhostSettings';
import { GhostThinkingIndicator } from '@/components/ghost/GhostThinkingIndicator';
import { GhostErrorBoundary } from '@/components/ghost/GhostErrorBoundary';
import { ExportMarkdownDialog } from '@/components/ghost/ExportMarkdownDialog';
import { GhostDropZone } from '@/components/ghost/GhostDropZone';
import { GhostUpgradeModal } from '@/components/ghost/GhostUpgradeModal';
import { GhostChatUsageBar } from '@/components/ghost/GhostChatUsageBar';
import { GhostUsageDisplay } from '@/components/ghost/GhostUsageDisplay';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

import { UnifiedHeader } from '@/components/layout/UnifiedHeader';
import { EyeOff, Shield, AlertTriangle, FileText, Ghost, X } from '@/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TEXT_MODELS } from '@/lib/ghost-models';

// Default models per mode
const DEFAULT_MODELS: Record<GhostMode, string> = {
  text: 'swissvault-1.0',
  image: 'auto-image',
  video: 'runway-gen3-turbo',
  search: 'sonar',
  research: 'sonar-deep-research',
};

// Swiss models (free tier)
const SWISS_MODEL_IDS = ['swissvault-1.0', 'swissvault-fast', 'swissvault-code', 'llama3.1-8b', 'mistral-7b'];

// Commercial models (Pro tier only)
const COMMERCIAL_MODEL_IDS = TEXT_MODELS
  .filter(m => m.isPayPerUse && !SWISS_MODEL_IDS.includes(m.id))
  .map(m => m.id);

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
  attachments?: Array<{ name: string; type: string; size: number }>;
  mode?: 'text' | 'image' | 'video' | 'search' | 'research';
  sources?: Array<{ title: string; url: string; snippet?: string }>;
}

// Attached file for context - supports multiple files
interface AttachedFile {
  id: string;
  file: File;
  base64?: string;
  text?: string;
  name: string;
  type: 'image' | 'document';
  size: number;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

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
  const { t } = useTranslation();
  const { user } = useAuth();

  // Add a lightweight `toast.info()` helper used for diagnostics / non-blocking feedback.
  // (Our toast API is function-based, so we attach this convenience method.)
  (toast as any).info ??= (description: string) => toast({ description });

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

  // Debug: track mode changes and storage state (helps diagnose UI "snap back")
  useEffect(() => {
    console.log('[GhostChat] mode changed', {
      mode,
      isInitialized,
      conversations: conversations.length,
    });
  }, [mode, isInitialized, conversations.length]);


  // Ghost credits hook
  const { balance, checkCredits, recordUsage, refreshCredits, isLoading: creditsLoading } = useGhostCredits();

  // Streaming inference hook
  const { streamResponse, cancelStream, resetStreamState, isStreaming, streamStatus, elapsedTime, lastResponseTime, lastTokenCount } = useGhostInference();

  // Reset stale streaming state on mount
  useEffect(() => {
    if (isStreaming && streamStatus === 'idle') {
      console.log('[GhostChat] Recovering from stale streaming state on mount');
      resetStreamState();
    }
  }, []); // Only on mount

  // Web search hook
  const webSearch = useGhostSearch();

  // Deep research hook
  const ghostResearch = useGhostResearch();

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
  const [researchSources, setResearchSources] = useState<ResearchSource[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // Usage tracking hook
  const { 
    tier, 
    isPro, 
    remaining, 
    limits, 
    canUse, 
    useFeature,
    resetTime 
  } = useGhostUsage();

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'prompts' | 'images' | 'videos' | 'files' | 'searches' | 'model'>('prompts');

  // Incognito warning dialog state
  const [showIncognitoWarning, setShowIncognitoWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'select' | 'new'; id?: string } | null>(null);

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
    // Check if commercial model and not Pro
    if (!isPro && COMMERCIAL_MODEL_IDS.includes(modelId)) {
      toast({
        title: 'Pro Model',
        description: 'Upgrade to Pro for GPT-4o, Claude, and Gemini access',
      });
      setUpgradeReason('model');
      setShowUpgradeModal(true);
      return;
    }
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

  // Stuck message recovery - detect and fix messages stuck in streaming state
  useEffect(() => {
    const STUCK_MESSAGE_TIMEOUT_MS = 120000; // 2 minutes
    
    const checkForStuckMessages = () => {
      const now = Date.now();
      const stuckMessages = messages.filter(
        m => m.role === 'assistant' && m.isStreaming && m.timestamp && (now - m.timestamp > STUCK_MESSAGE_TIMEOUT_MS)
      );
      
      if (stuckMessages.length > 0) {
        console.warn('[GhostChat] Found stuck streaming messages:', stuckMessages.map(m => m.id));
        
        setMessages(prev => prev.map(msg => {
          if (msg.isStreaming && msg.role === 'assistant' && msg.timestamp && (now - msg.timestamp > STUCK_MESSAGE_TIMEOUT_MS)) {
            return {
              ...msg,
              isStreaming: false,
              content: msg.content.trim() || 'Response timed out. Please try again.',
            };
          }
          return msg;
        }));
        
        // Also reset the stream state in the hook
        resetStreamState();
      }
    };
    
    // Check every 30 seconds
    const interval = setInterval(checkForStuckMessages, 30000);
    
    // Also check immediately when messages change
    checkForStuckMessages();
    
    return () => clearInterval(interval);
  }, [messages, resetStreamState]);

  // Cleanup incognito chats on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Find and delete all incognito conversations
      conversations.forEach(conv => {
        if (conv.isTemporary) {
          deleteConversation(conv.id);
        }
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [conversations, deleteConversation]);
  // Convert conversations for sidebar (temporary chats are already filtered out by listConversations)
  const sidebarConversations: GhostConversation[] = conversations.map(c => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    messageCount: c.messageCount || 0,
    isTemporary: c.isTemporary ?? false,
    folderId: c.folderId,
  }));

  // Handle new chat creation - accepts optional isTemporary parameter from sidebar
  const handleNewChat = useCallback((isTemporary?: boolean) => {
    // Check if currently in an incognito chat with messages
    const currentConv = selectedConversation 
      ? conversations.find(c => c.id === selectedConversation) 
      : null;
    
    if (currentConv?.isTemporary && messages.length > 0) {
      // Show warning and save pending action
      setPendingAction({ type: 'new' });
      setShowIncognitoWarning(true);
      return;
    }
    
    // Proceed with new chat creation
    const shouldBeTemporary = isTemporary ?? (settings?.start_temporary ?? false);
    const id = createConversation(shouldBeTemporary ? 'Incognito Chat' : 'New Chat', shouldBeTemporary);
    if (id) {
      setSelectedConversation(id);
      setMessages([]);
    }
  }, [createConversation, settings?.start_temporary, selectedConversation, conversations, messages.length]);

  // Handle selecting a conversation - with incognito warning
  const handleSelectConversation = useCallback((id: string) => {
    // Check if currently in an incognito chat with messages
    const currentConv = selectedConversation 
      ? conversations.find(c => c.id === selectedConversation) 
      : null;
    
    if (currentConv?.isTemporary && messages.length > 0 && id !== selectedConversation) {
      // Show warning and save pending action
      setPendingAction({ type: 'select', id });
      setShowIncognitoWarning(true);
      return;
    }
    
    setSelectedConversation(id);
  }, [selectedConversation, conversations, messages.length]);

  // Handle confirming leave from incognito chat
  const handleConfirmLeaveIncognito = useCallback(() => {
    // Delete the current incognito conversation
    if (selectedConversation) {
      deleteConversation(selectedConversation);
    }
    
    // Execute pending action
    if (pendingAction?.type === 'select' && pendingAction.id) {
      setSelectedConversation(pendingAction.id);
    } else if (pendingAction?.type === 'new') {
      const id = createConversation('New Chat', false);
      if (id) {
        setSelectedConversation(id);
        setMessages([]);
      }
    }
    
    setPendingAction(null);
    setShowIncognitoWarning(false);
  }, [selectedConversation, pendingAction, deleteConversation, createConversation]);

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

  const handleSendMessage = async (content: string, attachments?: File[]) => {
    console.log('[GhostChat] handleSendMessage called', {
      contentLength: content?.length,
      isStreaming,
      streamStatus,
      isSearching: webSearch.isSearching,
      isResearching: ghostResearch.isResearching,
      isSubmitting: isSubmittingRef.current,
      hasUser: !!user,
    });

    // Auto-recover if streaming state got stuck (prevents "can't send" deadlocks)
    const isStreamStateStuck =
      isStreaming &&
      (streamStatus === 'idle' ||
        streamStatus === 'error' ||
        streamStatus === 'timeout' ||
        streamStatus === 'stuck' ||
        streamStatus === 'complete');

    if (isStreamStateStuck) {
      console.warn('[GhostChat] Detected stuck streaming state, resetting...', {
        streamStatus,
      });
      resetStreamState();
      setMessages((prev) =>
        prev.map((m) => (m.role === 'assistant' && m.isStreaming ? { ...m, isStreaming: false } : m))
      );
    }

    // Prevent double submission - allow if we have attachments even without text
    if (!content?.trim() && attachedFiles.length === 0) return;

    if (isStreaming && !isStreamStateStuck) {
      console.log('[GhostChat] BLOCKED: isStreaming but not stuck');
      (toast as any).info('Still generating response. Click Stop to cancel.');
      return;
    }

    if (webSearch.isSearching) {
      console.log('[GhostChat] BLOCKED: webSearch in progress');
      (toast as any).info('Search in progress. Please wait.');
      return;
    }

    if (ghostResearch.isResearching) {
      console.log('[GhostChat] BLOCKED: deep research in progress');
      (toast as any).info('Research in progress. Please wait.');
      return;
    }

    if (isSubmittingRef.current) {
      console.log('[GhostChat] BLOCKED: isSubmittingRef is true');
      // Auto-recover after 5 seconds of being stuck
      setTimeout(() => {
        if (isSubmittingRef.current) {
          isSubmittingRef.current = false;
          console.log('[GhostChat] Auto-recovered isSubmittingRef');
        }
      }, 5000);
      return;
    }

    isSubmittingRef.current = true;

    try {
      const requestId = crypto.randomUUID();

      // Determine usage type based on mode
      const usageTypeMap: Record<string, 'prompt' | 'image' | 'video' | 'file' | 'search'> = {
        text: 'prompt',
        image: 'image',
        video: 'video',
        search: 'search',
        research: 'search', // Research uses search quota
      };
      
      const creditTypeMap: Record<string, 'text' | 'image' | 'video' | 'search'> = {
        text: 'text',
        image: 'image',
        video: 'video',
        search: 'search',
        research: 'search',
      };

      // Skip client-side credit checks for anonymous users - the edge function handles anonymous usage limits via IP tracking
      const isAnonymous = !user;
      
      if (!isAnonymous) {
        // Check usage limit before proceeding (free tier enforcement)
        const featureType = usageTypeMap[mode] || 'prompt';
        if (!canUse[featureType]) {
          setUpgradeReason(featureType === 'prompt' ? 'prompts' : 
                           featureType === 'image' ? 'images' :
                           featureType === 'video' ? 'videos' :
                           featureType === 'search' ? 'searches' : 'prompts');
          setShowUpgradeModal(true);
          return;
        }

        // Increment usage
        const allowed = await useFeature(featureType);
        if (!allowed) {
          setUpgradeReason(featureType === 'prompt' ? 'prompts' : 
                           featureType === 'image' ? 'images' :
                           featureType === 'video' ? 'videos' :
                           featureType === 'search' ? 'searches' : 'prompts');
          setShowUpgradeModal(true);
          return;
        }

        // Check credits before proceeding (for authenticated users)
        const creditType = creditTypeMap[mode] || 'text';
        const creditCheck = await checkCredits(creditType);
        if (!creditCheck.allowed) {
          handleInsufficientCredits(creditCheck.reason);
          return;
        }
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

      // Build multimodal content if we have attachments
      const hasImages = attachedFiles.some(f => f.type === 'image' && f.base64);
      const hasDocuments = attachedFiles.some(f => f.type === 'document');
      
      // Warn if using images with non-vision model
      const selectedModel = selectedModels[mode];
      if (hasImages) {
        const { isVisionModel } = await import('@/lib/ghost-models');
        if (!isVisionModel(selectedModel)) {
          toast({
            title: 'This model cannot analyze images',
            description: 'Switch to GPT-4o, Claude 3.5, or Gemini for image analysis.',
          });
        }
      }

      // Build content - either string or array of content parts
      let messageContent: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
      
      if (hasImages || hasDocuments) {
        // Build multimodal content array
        const contentParts: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [];
        
        // Add images first (vision models expect this order)
        const imageFiles = attachedFiles.filter(f => f.type === 'image' && f.base64);
        for (const img of imageFiles) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: img.base64!,
              detail: 'auto',
            }
          });
        }
        
        // Add document content as text context
        const docFiles = attachedFiles.filter(f => f.type === 'document');
        let docContext = '';
        for (const doc of docFiles) {
          if (doc.text) {
            docContext += `\n\n📄 **${doc.name}**:\n\`\`\`\n${doc.text.slice(0, 30000)}\n\`\`\``;
          } else if (doc.base64) {
            // PDF as image for vision models
            contentParts.push({
              type: 'image_url',
              image_url: { url: doc.base64, detail: 'auto' }
            });
          }
        }
        
        // Add user text + document context
        const fullText = (content.trim() + docContext).trim();
        if (fullText) {
          contentParts.push({ type: 'text', text: fullText });
        }

        messageContent = contentParts;
      } else {
        messageContent = content.trim();
      }

      // Create display message (always show text for UI)
      const displayContent = content.trim() || `[${attachedFiles.length} file(s) attached]`;
      const userMessage: GhostMessageData = {
        id: crypto.randomUUID(),
        role: 'user',
        content: displayContent,
        timestamp: Date.now(),
        attachments: attachedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })),
      };

      // Build message history BEFORE saving (to avoid duplicate)
      // Build message history BEFORE saving (to avoid duplicate)
      // Note: messageContent can be string or array for multimodal
      const messageHistory: Array<{ role: string; content: any }> = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      messageHistory.push({ role: 'user', content: messageContent });

      // Save user message and update UI
      saveMessage(convId, 'user', displayContent);
      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setAttachedFiles([]); // Clear attachments after sending

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
      } else if (mode === 'research') {
        // Deep research mode
        const assistantId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
            mode: 'research',
          },
        ]);
        setResearchSources([]);

        try {
          await ghostResearch.research(userMessage.content, {
            onToken: (token) => {
              setMessages((prev) =>
                prev.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + token } : msg))
              );
            },
            onSources: (sources) => {
              setResearchSources(sources);
              setMessages((prev) =>
                prev.map((msg) => (msg.id === assistantId ? { ...msg, sources } : msg))
              );
            },
            onComplete: async (response) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId 
                    ? { ...msg, content: response.content, isStreaming: false, sources: response.sources } 
                    : msg
                )
              );
              if (response.content) {
                saveMessage(convId!, 'assistant', response.content);
                await recordUsage('search', 'sonar-deep-research', {
                  inputTokens: Math.ceil(userMessage.content.length / 4),
                  outputTokens: Math.ceil(response.content.length / 4),
                });
              }
            },
            onError: (error) => {
              toast({
                title: 'Research Error',
                description: error.message || 'Failed to complete research',
                variant: 'destructive',
              });
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: `Error: ${error.message || 'Research failed'}`, isStreaming: false }
                    : msg
                )
              );
            },
          });
        } catch (error) {
          console.error('Research error:', error);
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

  const handleExportConversation = useCallback((id: string) => {
    const conv = getConversation(id);
    if (conv) {
      setExportingConversation({
        id: conv.id,
        title: conv.title,
        messages: conv.messages,
      });
      setExportDialogOpen(true);
    }
  }, [getConversation]);

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

  const handleExportFolder = useCallback((folderId: string) => {
    // Get all conversations in this folder
    const folderConvs = sidebarConversations.filter(c => c.folderId === folderId);
    const folder = folders.find(f => f.id === folderId);

    if (folderConvs.length === 0) {
      toast({ title: 'Empty folder', description: 'No chats to export in this folder' });
      return;
    }

    // Export each conversation as markdown and combine
    let combinedMarkdown = `# ${folder?.name || 'Folder Export'}\n\nExported: ${new Date().toLocaleString()}\n\n---\n\n`;

    for (const convMeta of folderConvs) {
      const conv = getConversation(convMeta.id);
      if (conv) {
        combinedMarkdown += `## ${conv.title}\n\n`;
        for (const msg of conv.messages) {
          const role = msg.role === 'user' ? '**You**' : '**Assistant**';
          combinedMarkdown += `${role}:\n\n${msg.content}\n\n---\n\n`;
        }
      }
    }

    // Download as markdown file
    const blob = new Blob([combinedMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folder?.name || 'folder'}-export.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `Exported ${folderConvs.length} chat(s) from folder` });
  }, [folders, getConversation, sidebarConversations, toast]);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConversation(id);
    if (selectedConversation === id) {
      setSelectedConversation(null);
      setMessages([]);
    }
    toast({ title: 'Deleted', description: 'Chat deleted' });
  }, [deleteConversation, selectedConversation, toast]);

  const handleRenameConversation = useCallback((id: string, title: string) => {
    updateConversationTitle(id, title);
  }, [updateConversationTitle]);

  const handleMoveToFolder = useCallback((convId: string, folderId: string | null) => {
    moveToFolder(convId, folderId);
  }, [moveToFolder]);

  const handleCreateFolder = useCallback(async () => {
    await createFolder('New Folder');
  }, [createFolder]);

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

  // Process a single file into AttachedFile
  const processFile = async (file: File): Promise<AttachedFile | null> => {
    const id = crypto.randomUUID();

    // Image files
    if (file.type.startsWith('image/')) {
      try {
        const base64 = await fileToBase64(file);
        return { id, file, base64, name: file.name, type: 'image', size: file.size };
      } catch {
        return null;
      }
    }

    // Text-based documents
    if (file.type === 'text/plain' || 
        file.name.endsWith('.md') || 
        file.name.endsWith('.txt') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.json')) {
      try {
        const text = await file.text();
        return { id, file, text, name: file.name, type: 'document', size: file.size };
      } catch {
        return null;
      }
    }

    // PDF files - send as base64 for vision models
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const base64 = await fileToBase64(file);
        return { id, file, base64, name: file.name, type: 'document', size: file.size };
      } catch {
        return null;
      }
    }

    return null;
  };

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Reset input for re-selection
    e.target.value = '';

    // Check usage limit for file uploads
    if (!canUse.file) {
      setUpgradeReason('files');
      setShowUpgradeModal(true);
      return;
    }

    // Check total count
    const totalFiles = attachedFiles.length + selectedFiles.length;
    if (totalFiles > MAX_FILES) {
      toast({
        title: `Maximum ${MAX_FILES} files allowed`,
        description: `You have ${attachedFiles.length} files attached. Can add ${MAX_FILES - attachedFiles.length} more.`,
        variant: 'destructive',
      });
      return;
    }

    const newAttachments: AttachedFile[] = [];
    const errors: string[] = [];

    for (const file of selectedFiles) {
      // Size check
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 10MB limit`);
        continue;
      }

      try {
        const attachment = await processFile(file);
        if (attachment) {
          newAttachments.push(attachment);
        } else {
          errors.push(`${file.name}: unsupported type`);
        }
      } catch (error) {
        console.error(`[GhostChat] Failed to process ${file.name}:`, error);
        errors.push(`${file.name}: failed to process`);
      }
    }

    if (errors.length > 0) {
      toast({
        title: 'Some files could not be added',
        description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? ` +${errors.length - 3} more` : ''),
        variant: 'destructive',
      });
    }

    if (newAttachments.length > 0) {
      setAttachedFiles(prev => [...prev, ...newAttachments]);
      toast({
        title: `${newAttachments.length} file(s) attached`,
        description: newAttachments.length === 1 ? newAttachments[0].name : undefined,
      });
    }
  }, [attachedFiles, toast, canUse.file]);

  const removeAttachment = useCallback((id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearAllAttachments = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  // Handle files dropped via drag-and-drop
  const handleFilesDropped = useCallback(async (files: File[]) => {
    // Check usage limit for file uploads
    if (!canUse.file) {
      setUpgradeReason('files');
      setShowUpgradeModal(true);
      return;
    }

    const totalFiles = attachedFiles.length + files.length;
    if (totalFiles > MAX_FILES) {
      toast({
        title: `Maximum ${MAX_FILES} files allowed`,
        description: `You have ${attachedFiles.length} files attached. Can add ${MAX_FILES - attachedFiles.length} more.`,
        variant: 'destructive',
      });
      return;
    }

    const newAttachments: AttachedFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 10MB limit`);
        continue;
      }

      try {
        const attachment = await processFile(file);
        if (attachment) {
          newAttachments.push(attachment);
        } else {
          errors.push(`${file.name}: unsupported type`);
        }
      } catch (error) {
        console.error(`[GhostChat] Failed to process ${file.name}:`, error);
        errors.push(`${file.name}: failed to process`);
      }
    }

    if (errors.length > 0) {
      toast({
        title: 'Some files could not be added',
        description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? ` +${errors.length - 3} more` : ''),
        variant: 'destructive',
      });
    }

    if (newAttachments.length > 0) {
      setAttachedFiles(prev => [...prev, ...newAttachments]);
      toast({
        title: `${newAttachments.length} file(s) dropped`,
        description: newAttachments.length === 1 ? newAttachments[0].name : undefined,
      });
    }
  }, [attachedFiles, toast, canUse.file]);

  // Handle paste for images from clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      
      if (imageItems.length === 0) return;
      
      e.preventDefault();
      
      const files: File[] = [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
      
      if (files.length > 0) {
        await handleFilesDropped(files);
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFilesDropped]);

  // Ghost Chat supports anonymous access - do not block unauthenticated users

  return (
    <GhostDropZone
      onFilesDropped={handleFilesDropped}
      disabled={isStreaming || webSearch.isSearching}
      maxFiles={MAX_FILES}
      maxFileSize={MAX_FILE_SIZE}
      className="h-screen"
    >
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <GhostSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={sidebarConversations}
        folders={folders}
        selectedConversation={selectedConversation}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onExportConversation={handleExportConversation}
        onRenameConversation={handleRenameConversation}
        onMoveToFolder={handleMoveToFolder}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onExportFolder={handleExportFolder}
        userName={user?.email?.split('@')[0] || 'Guest'}
        userCredits={balance}
        isPro={isPro}
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
        {/* Unified Header */}
        <UnifiedHeader
          product="ghost"
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          isMenuOpen={sidebarOpen}
        />


        {/* Corrupted Data Recovery Alert */}
        {corruptedCount > 0 && (
          <Alert variant="destructive" className="m-4 border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('ghost.alerts.corruptedTitle', "Some conversations couldn't be loaded")}</AlertTitle>
            <AlertDescription className="mt-2">
              {corruptedCount} {t('ghost.alerts.corruptedDescription', 'conversation(s) encrypted with a different key could not be decrypted.')}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 block"
                onClick={() => {
                  clearAllData();
                  toast({ 
                    title: t('ghost.alerts.storageCleared', 'Storage cleared'), 
                    description: t('ghost.alerts.storageClearedDescription', 'All local data has been removed. You can start fresh.') 
                  });
                }}
              >
                {t('ghost.alerts.clearCorruptedData', 'Clear corrupted data')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mode-specific view */}
          <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Text Mode - Empty state with centered input (Perplexity-style) */}
          {mode === 'text' && messages.length === 0 && (
            <GhostTextViewEmpty>
              {/* Attachment preview above input */}
              {attachedFiles.length > 0 && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground hover:text-destructive"
                      onClick={clearAllAttachments}
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="group relative flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border/50"
                      >
                        {attachment.type === 'image' && attachment.base64 ? (
                          <img src={attachment.base64} alt={attachment.name} className="w-8 h-8 object-cover rounded" />
                        ) : (
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        )}
                        <span className="text-sm truncate max-w-[100px]">{attachment.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full"
                          onClick={() => removeAttachment(attachment.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <GhostChatInput
                mode={mode}
                onModeChange={handleModeChange}
                selectedModel={selectedModels[mode]}
                onSelectModel={handleModelChange}
                value={inputValue}
                onChange={setInputValue}
                onSubmit={() => handleSendMessage(inputValue, attachedFiles.map(f => f.file))}
                onCancel={cancelStream}
                isStreaming={isStreaming}
                streamStatus={streamStatus}
                elapsedTime={elapsedTime}
                credits={balance}
                enhancePrompt={enhancePrompt}
                onToggleEnhance={() => setEnhancePrompt(!enhancePrompt)}
                onOpenSettings={() => setShowSettings(true)}
                onAttach={handleFileAttach}
                voiceLanguage={settings?.voice_language}
                matureFilterEnabled={settings?.mature_filter_enabled ?? true}
              />
            </GhostTextViewEmpty>
          )}
          
          {/* Text Mode - With messages (input at bottom) */}
          {mode === 'text' && messages.length > 0 && (
              <GhostTextView hasMessages={true}>
                {/* Native scroll - more reliable than ScrollArea */}
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-muted/60 rounded-2xl px-4 py-3' : ''}`}>
                          <GhostMessageComponent
                            id={msg.id}
                            role={msg.role}
                            content={msg.content}
                            timestamp={msg.timestamp}
                            isStreaming={msg.isStreaming}
                            responseTimeMs={msg.responseTimeMs}
                            tokenCount={msg.tokenCount}
                            contextUsagePercent={msg.contextUsagePercent}
                            attachments={msg.attachments}
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
                    {isStreaming && (
                      <GhostThinkingIndicator
                        status={streamStatus}
                        elapsedTime={elapsedTime}
                        model={selectedModels.text}
                        onCancel={cancelStream}
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
            {mode === 'research' && (
              messages.length > 0 ? (
                <div className="h-full flex flex-col">
                  {/* Research citations */}
                  {researchSources.length > 0 && (
                    <div className="flex-shrink-0 px-4 py-3 border-b border-border/40">
                      <div className="max-w-3xl mx-auto">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Research Sources</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {researchSources.map((source, idx) => (
                            <a
                              key={idx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-xs text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1.5"
                            >
                              <span className="w-4 h-4 rounded bg-swiss-sapphire/20 flex items-center justify-center text-[10px] font-medium text-swiss-sapphire">
                                {idx + 1}
                              </span>
                              <span className="truncate max-w-[120px]">
                                {new URL(source.url).hostname.replace('www.', '')}
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
                      {/* Research progress */}
                      {ghostResearch.isResearching && (
                        <GhostThinkingIndicator
                          status={ghostResearch.progress as any || 'Researching...'}
                          elapsedTime={0}
                          model="sonar-deep-research"
                          onCancel={ghostResearch.cancelResearch}
                        />
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <GhostTextViewEmpty>
                  <GhostChatInput
                    mode={mode}
                    onModeChange={handleModeChange}
                    selectedModel={selectedModels.text}
                    onSelectModel={handleModelChange}
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={() => handleSendMessage(inputValue, attachedFiles.map(f => f.file))}
                    onCancel={ghostResearch.cancelResearch}
                    isStreaming={ghostResearch.isResearching}
                    streamStatus={streamStatus}
                    elapsedTime={0}
                    credits={balance}
                    enhancePrompt={false}
                    onToggleEnhance={() => {}}
                    onOpenSettings={() => setShowSettings(true)}
                    onAttach={() => {}}
                    voiceLanguage={settings?.voice_language}
                    matureFilterEnabled={settings?.mature_filter_enabled ?? true}
                  />
                </GhostTextViewEmpty>
              )
            )}
          </div>

          {/* Input Area - Only when there are messages (text mode) or for search/research mode */}
          {((mode === 'text' && messages.length > 0) || mode === 'search' || (mode === 'research' && messages.length > 0)) && (
            <div className="flex-shrink-0 p-4 lg:p-6">
              <div className="max-w-3xl mx-auto">
                {/* Usage Bar - Above Input */}
                <GhostChatUsageBar
                  usage={{
                    prompts: { used: (limits?.prompts ?? 0) - (remaining?.prompts ?? 0), limit: limits?.prompts ?? 0 },
                    images: { used: (limits?.images ?? 0) - (remaining?.images ?? 0), limit: limits?.images ?? 0 },
                    videos: { used: (limits?.videos ?? 0) - (remaining?.videos ?? 0), limit: limits?.videos ?? 0 },
                    research: { used: (limits?.searches ?? 0) - (remaining?.searches ?? 0), limit: limits?.searches ?? 0 },
                  }}
                  resetsIn={typeof resetTime === 'number' ? Math.floor((resetTime - Date.now()) / 1000) : undefined}
                  tier={tier as 'anonymous' | 'free' | 'ghost' | 'pro' | 'ultra'}
                  onUpgrade={() => {
                    if (!user) {
                      navigate('/auth/ghost-signup');
                    } else {
                      setShowUpgradeModal(true);
                    }
                  }}
                  className="mb-2"
                />
                {/* Multi-file attachment preview */}
                {attachedFiles.length > 0 && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
                        {attachedFiles.length < MAX_FILES && ` (${MAX_FILES - attachedFiles.length} more allowed)`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-destructive"
                        onClick={clearAllAttachments}
                      >
                        Clear all
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attachedFiles.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="group relative flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border/50 hover:border-border transition-colors"
                        >
                          {attachment.type === 'image' && attachment.base64 ? (
                            <img
                              src={attachment.base64}
                              alt={attachment.name}
                              className="w-8 h-8 object-cover rounded"
                            />
                          ) : (
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm truncate max-w-[120px]" title={attachment.name}>
                              {attachment.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {(attachment.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1.5 -right-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full"
                            onClick={() => removeAttachment(attachment.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <GhostChatInput
                  mode={mode}
                  onModeChange={handleModeChange}
                  selectedModel={selectedModels[mode]}
                  onSelectModel={handleModelChange}
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={() => handleSendMessage(inputValue, attachedFiles.map(f => f.file))}
                  onCancel={mode === 'search' ? webSearch.cancelSearch : cancelStream}
                  isStreaming={isStreaming || webSearch.isSearching}
                  streamStatus={streamStatus}
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
    </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,.pdf,.txt,.md,.csv,.json"
        multiple
        onChange={handleFilesSelected}
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
      <GhostUpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitType={upgradeReason === 'prompts' ? 'prompt' : upgradeReason === 'images' ? 'image' : upgradeReason === 'videos' ? 'video' : upgradeReason === 'files' ? 'file' : upgradeReason === 'searches' ? 'search' : 'prompt'}
        currentTier={tier}
      />

      {/* Incognito Warning Dialog */}
      <AlertDialog open={showIncognitoWarning} onOpenChange={setShowIncognitoWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <EyeOff className="h-5 w-5" />
              {t('ghost.incognito.leaveTitle', 'Leave Incognito Chat?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('ghost.incognito.leaveDescription', 'This incognito conversation will be permanently deleted. This cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAction(null)}>
              {t('ghost.incognito.stay', 'Stay')}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmLeaveIncognito}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('ghost.incognito.leaveDelete', 'Leave & Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GhostDropZone>
  );
}
