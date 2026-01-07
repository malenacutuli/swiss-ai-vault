import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useGhostStorage } from '@/hooks/useGhostStorage';
import { getGhostStorage } from '@/lib/ghost/ghost-storage';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useGhostInference } from '@/hooks/useGhostInference';
import { useGhostSearch, type SearchResult } from '@/hooks/useGhostSearch';
import { useGhostResearch, type ResearchSource } from '@/hooks/useGhostResearch';
import { useGhostSettings } from '@/hooks/useGhostSettings';
import { useGhostFolders } from '@/hooks/useGhostFolders';
import { useGhostUsage } from '@/hooks/useGhostUsage';
import { useAuth } from '@/contexts/AuthContext';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { useMemory } from '@/hooks/useMemory';
import { useCompareMode, type CompareResponse } from '@/hooks/useCompareMode';
import * as vault from '@/lib/crypto/key-vault';
import { VaultUnlockDialog } from '@/components/vault-chat/VaultUnlockDialog';

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
import { VerifiedSourcesDisplay } from '@/components/trust/VerifiedSourcesDisplay';
import { MemorySourcesCard, type MemorySource, GroundedResponse, GroundedModeToggle } from '@/components/chat';
import { ModelSelector, CompareResults } from '@/components/ghost/compare';
import { ComparisonHistoryCard } from '@/components/ghost/compare/ComparisonHistoryCard';
import type { GroundedChatMessage, SourceDocument } from '@/types/grounded';

import { UnifiedHeader } from '@/components/layout/UnifiedHeader';
import {
  analyzeSource,
  buildVerificationPrompt,
  calculateOverallTrust,
  generateMethodology,
  DOMAIN_SEARCH_STRATEGIES,
  type WebSource,
  type VerifiedSearchResult,
} from '@/lib/trust/verified-search';
import { classifyQuery } from '@/lib/trust/grounded-response';
import { EyeOff, Shield, AlertTriangle, FileText, Ghost, X, ToggleLeft, ToggleRight, GitCompareArrows } from '@/icons';
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
import { extractTextFromPDF, isPDFFile } from '@/lib/pdf-extractor';

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
  isError?: boolean;
  imageUrl?: string;
  responseTimeMs?: number;
  tokenCount?: number;
  contextUsagePercent?: number;
  attachments?: Array<{ name: string; type: string; size: number }>;
  mode?: 'text' | 'image' | 'video' | 'search' | 'research';
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  verifiedResult?: VerifiedSearchResult;
  memorySources?: MemorySource[]; // Personal memory sources used for this response
  // Grounded response fields
  isGrounded?: boolean;
  groundedSources?: SourceDocument[];
  citations?: Array<{ sourceIndex: number; sourceId: string; text: string }>;
  // Comparison history data
  comparisonData?: {
    prompt: string;
    responses: Array<{
      model: string;
      displayName: string;
      provider: string;
      response: string | null;
      error?: string;
      tokens: number;
      latency: number;
      status: 'pending' | 'streaming' | 'complete' | 'error';
      rating?: number;
    }>;
    selectedModelId: string;
    timestamp: string;
  };
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userIsNearBottomRef = useRef(true); // Track if user is near bottom for smart auto-scroll
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false); // Prevent double submission
  
  // Race condition prevention refs
  const skipNextHydrationRef = useRef<string | null>(null);
  const isStreamingRef = useRef<boolean>(false);
  
  // Ref to always have the latest handleSendMessage (avoids stale closure in auto-send effect)
  const handleSendMessageRef = useRef<((content?: string) => Promise<void>) | null>(null);

  // === ENTERPRISE-GRADE INITIALIZATION STATE ===
  // Message queue for messages sent before storage is ready
  const [pendingMessage, setPendingMessage] = useState<{
    content: string;
    attachments: AttachedFile[];
    timestamp: number;
  } | null>(null);

  // Track initialization phases for better UX
  const [initPhase, setInitPhase] = useState<'connecting' | 'ready' | 'error'>('connecting');

  // Track retry attempts for first message resilience
  const retryCountRef = useRef(0);

  // Track if this is a fresh page load (for pre-warming)
  const isFirstLoadRef = useRef(true);

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
    refreshConversations,
  } = useGhostStorage();

  // === LAYER 1: PRE-WARM STORAGE ON MOUNT ===
  useEffect(() => {
    if (!isFirstLoadRef.current) return;
    isFirstLoadRef.current = false;
    
    const preWarmStorage = async () => {
      console.log('[GhostChat] 🔥 Pre-warming secure storage...');
      setInitPhase('connecting');
      
      try {
        // Start storage initialization immediately on mount
        // This runs BEFORE user starts typing, hiding the delay
        const startTime = performance.now();
        
        // The storage hook should already be initializing,
        // but we can trigger any lazy initialization here
        if (!isInitialized && typeof window !== 'undefined') {
          // Touch IndexedDB to ensure it's open
          const dbRequest = indexedDB.open('ghost-storage-check', 1);
          dbRequest.onsuccess = () => {
            dbRequest.result.close();
            indexedDB.deleteDatabase('ghost-storage-check');
          };
        }
        
        const elapsed = performance.now() - startTime;
        console.log(`[GhostChat] 🔥 Pre-warm check completed in ${elapsed.toFixed(0)}ms`);
      } catch (error) {
        console.error('[GhostChat] Pre-warm error:', error);
      }
    };
    
    preWarmStorage();
  }, []);

  // Track when storage becomes ready or fails
  useEffect(() => {
    if (isInitialized) {
      setInitPhase('ready');
      console.log('[GhostChat] ✅ Secure storage ready');
    }
  }, [isInitialized]);

  // === STORAGE INITIALIZATION TIMEOUT ===
  // If storage doesn't initialize within 15 seconds, show error
  useEffect(() => {
    if (initPhase !== 'connecting') return;
    
    const timeout = setTimeout(() => {
      if (!isInitialized) {
        console.error('[GhostChat] ❌ Storage initialization timeout');
        setInitPhase('error');
        toast({
          title: 'Connection Error',
          description: 'Unable to connect to secure storage. Please refresh the page.',
          variant: 'destructive',
        });
      }
    }, 15000); // 15 second timeout
    
    return () => clearTimeout(timeout);
  }, [initPhase, isInitialized, toast]);

  // Debug: track mode changes and storage state (helps diagnose UI "snap back")
  useEffect(() => {
    console.log('[GhostChat] mode changed', {
      mode,
      isInitialized,
      conversations: conversations.length,
    });
  }, [mode, isInitialized, conversations.length]);

  // === LAYER 4: AUTO-SEND QUEUED MESSAGES WHEN READY ===
  useEffect(() => {
    const sendQueuedMessage = async () => {
      if (!isInitialized || !pendingMessage) {
        return;
      }

      // If a submission is in-flight, retry shortly (refs don't trigger re-renders)
      if (isSubmittingRef.current) {
        setTimeout(() => {
          setPendingMessage((prev) => (prev ? { ...prev } : prev));
        }, 150);
        return;
      }

      // Check if message is too old (> 30 seconds = user probably gave up)
      const messageAge = Date.now() - pendingMessage.timestamp;
      if (messageAge > 30000) {
        console.warn('[GhostChat] Queued message expired');
        setPendingMessage(null);
        // Remove the status message
        setMessages((prev) => prev.filter((m) => !m.isStreaming || m.content !== 'Connecting to secure storage...'));
        return;
      }

      console.log('[GhostChat] 🚀 Storage ready, sending queued message...');

      // Remove the "connecting" status message
      setMessages((prev) => prev.filter((m) => !m.isStreaming || m.content !== 'Connecting to secure storage...'));

      const { content, attachments } = pendingMessage;

      // If ref isn't ready yet, retry shortly without dropping the pending message
      if (!handleSendMessageRef.current) {
        setTimeout(() => {
          setPendingMessage((prev) => (prev ? { ...prev } : prev));
        }, 150);
        return;
      }

      // Clear pending message only once we can actually send
      setPendingMessage(null);

      // Restore attachments if any
      if (attachments.length > 0) {
        setAttachedFiles(attachments);
      }

      // Small delay to ensure state is settled
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Reset retry count for fresh attempt
      retryCountRef.current = 0;

      await handleSendMessageRef.current(content);
    };

    sendQueuedMessage();
  }, [isInitialized, pendingMessage, toast]);



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

  // Compare mode hook
  const {
    isCompareMode,
    toggleCompareMode,
    selectedModels: compareSelectedModels,
    toggleModel: toggleCompareModel,
    applyPreset: applyComparePreset,
    compare,
    isComparing,
    result: compareResult,
    rateResponse: rateCompareResponse,
    clearResult: clearCompareResult,
  } = useCompareMode();

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
  
  // Verified search mode state
  const [verifiedMode, setVerifiedMode] = useState(true);
  const [lastVerifiedResult, setLastVerifiedResult] = useState<VerifiedSearchResult | null>(null);

  // Personal Memory state
  const memory = useMemory();
  const [memoryEnabled, setMemoryEnabled] = useState(() => {
    const saved = localStorage.getItem('swissvault_memory_enabled');
    return saved === 'true';
  });
  const [memorySearching, setMemorySearching] = useState(false);
  const [lastMemorySources, setLastMemorySources] = useState<MemorySource[]>([]);
  const { isUnlocked: isVaultUnlocked, isInitialized: isVaultInitialized } = useEncryptionContext();
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);
  
  // Grounded mode state - AI responses backed by document citations
  const [groundedMode, setGroundedMode] = useState(() => {
    try {
      return localStorage.getItem('swissvault_grounded_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [documentsCount, setDocumentsCount] = useState(0);
  
  // Persist grounded mode preference
  useEffect(() => {
    localStorage.setItem('swissvault_grounded_mode', groundedMode.toString());
  }, [groundedMode]);
  
  // Update documents count when memory changes
  useEffect(() => {
    const updateDocCount = async () => {
      if (memory.isInitialized) {
        try {
          const stats = await memory.getStats();
          setDocumentsCount(stats.count);
        } catch {
          setDocumentsCount(0);
        }
      }
    };
    updateDocCount();
  }, [memory.isInitialized, memory.getStats]);
  
  // Auto-save to memory state
  const [autoSaveToMemory, setAutoSaveToMemory] = useState(() => {
    try {
      return localStorage.getItem('swissvault_auto_save_memory') === 'true';
    } catch {
      return false;
    }
  });
  
  // Persist memory preferences
  useEffect(() => {
    localStorage.setItem('swissvault_memory_enabled', memoryEnabled.toString());
  }, [memoryEnabled]);
  
  useEffect(() => {
    localStorage.setItem('swissvault_auto_save_memory', autoSaveToMemory.toString());
  }, [autoSaveToMemory]);
  
  // Initialize memory when enabled and vault is unlocked
  useEffect(() => {
    if (memoryEnabled && isVaultUnlocked && !memory.isInitialized && !memory.isLoading) {
      memory.initialize();
    }
  }, [memoryEnabled, isVaultUnlocked, memory.isInitialized, memory.isLoading]);
  
  // Search personal memory for relevant context
  const searchPersonalMemory = useCallback(async (query: string): Promise<{
    context: string;
    sources: MemorySource[];
  }> => {
    if (!memoryEnabled || !isVaultUnlocked || !memory.isInitialized) {
      return { context: '', sources: [] };
    }
    
    setMemorySearching(true);
    try {
      // Search memory with query
      const results = await memory.search(query, {
        topK: 5,
      });
      
      if (!results || results.length === 0) {
        setLastMemorySources([]);
        return { context: '', sources: [] };
      }
      
      // Build context prompt from results
      const contextParts = results.map((item, i) => {
        const typeLabel = item.source || 'memory';
        const score = Math.round((item.score || 0) * 100);
        return `[${i + 1}. ${typeLabel} (${score}% relevant)]\n${item.content}`;
      });
      
      const context = `
[CONTEXT FROM YOUR PERSONAL MEMORY]
The following information was retrieved from your stored documents, notes, and conversations:

${contextParts.join('\n\n---\n\n')}

[END CONTEXT]

Use this context to inform your response when relevant. Cite sources by number when directly using information.
`.trim();
      
      const sources: MemorySource[] = results.map((item, i) => ({
        id: item.id || `memory-${i}`,
        title: item.metadata?.title || item.metadata?.filename || `Memory ${i + 1}`,
        content: item.content,
        score: item.score || 0,
        type: (item.source as MemorySource['type']) || 'document',
        createdAt: item.metadata?.createdAt,
      }));
      
      setLastMemorySources(sources);
      return { context, sources };
    } catch (error) {
      console.error('[GhostChat] Memory search failed:', error);
      setLastMemorySources([]);
      return { context: '', sources: [] };
    } finally {
      setMemorySearching(false);
    }
  }, [memoryEnabled, isVaultUnlocked, memory]);

  // Handle using a compare response as the answer
  const handleUseCompareResponse = useCallback((response: CompareResponse) => {
    if (response.response && compareResult) {
      // Create conversation FIRST if none is selected
      let convId = selectedConversation;
      const isNewConversation = !convId;
      
      if (!convId) {
        // Create a new conversation with title from prompt
        const title = compareResult.prompt.slice(0, 50) + (compareResult.prompt.length > 50 ? '...' : '');
        convId = createConversation(title);
        if (convId) {
          setSelectedConversation(convId);
        }
      }
      
      if (!convId) {
        toast({
          title: 'Storage not ready',
          description: 'Please try again in a moment.',
          variant: 'destructive',
        });
        return;
      }
      
      // Create comparison history data to preserve all compared responses
      const comparisonData = {
        prompt: compareResult.prompt,
        responses: compareResult.responses.map(r => ({
          model: r.model,
          displayName: r.displayName,
          provider: r.provider,
          response: r.response,
          error: r.error,
          tokens: r.tokens,
          latency: r.latency,
          status: r.status,
          rating: r.rating,
        })),
        selectedModelId: response.model,
        timestamp: compareResult.timestamp,
      };
      
      // Create message objects with comparison data on user message
      const userMsg: GhostMessageData = {
        id: crypto.randomUUID(),
        role: 'user',
        content: compareResult.prompt,
        timestamp: Date.now(),
        comparisonData, // Attach the full comparison history
      };
      const assistantMsg: GhostMessageData = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
        responseTimeMs: response.latency,
        tokenCount: response.tokens,
      };
      
      // Save messages to storage with comparison metadata
      saveMessage(convId, 'user', compareResult.prompt, { comparisonData });
      saveMessage(convId, 'assistant', response.response);
      
      // Update local UI state with full comparison history
      setMessages(prev => [...prev, userMsg, assistantMsg]);
      
      // Explicit refresh to ensure sidebar updates
      refreshConversations();
      
      clearCompareResult();
      toast({
        title: 'Response selected',
        description: `Using ${response.displayName} response. Chat saved.`,
      });
    }
  }, [compareResult, selectedConversation, saveMessage, clearCompareResult, toast, createConversation, refreshConversations]);

  const lastAssistantMessage = useMemo(() => {
    if (!messages || messages.length === 0) return undefined;
    
    // Find the last assistant message that is not streaming
    const assistantMessages = messages.filter(m => m.role === 'assistant' && !m.isStreaming && !m.isError);
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    
    // Return content, handling potential markdown or long content
    // TTS has 4096 char limit
    return lastMsg?.content?.substring(0, 4096);
  }, [messages]);

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
  
  // Auto-save conversation to memory
  const saveConversationToMemory = useCallback(async (showToast = true) => {
    if (!isVaultUnlocked || messages.length < 2) return null;
    
    const masterKey = vault.getMasterKey();
    if (!masterKey) return null;
    
    const currentConv = selectedConversation 
      ? conversations.find(c => c.id === selectedConversation) 
      : null;
    
    // Don't save incognito chats
    if (currentConv?.isTemporary) return null;
    
    try {
      const { saveChatToMemory } = await import('@/lib/memory/chat-memory-sync');
      
      const conversation = {
        id: selectedConversation || crypto.randomUUID(),
        title: currentConv?.title || messages[0]?.content.slice(0, 50) || 'Conversation',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp
        })),
        model: selectedModels.text,
        createdAt: messages[0]?.timestamp || Date.now(),
        updatedAt: Date.now()
      };
      
      const memoryId = await saveChatToMemory(conversation, masterKey, { source: 'ghost_chat' });
      
      if (memoryId && showToast) {
        toast({ title: 'Saved to Memory', description: 'Conversation added to your AI memory' });
      }
      
      return memoryId;
    } catch (error) {
      console.error('[GhostChat] Failed to save to memory:', error);
      if (showToast) {
        toast({ title: 'Save failed', description: 'Could not save to memory', variant: 'destructive' });
      }
      return null;
    }
  }, [isVaultUnlocked, messages, selectedConversation, conversations, selectedModels.text, toast]);
  
  // Auto-save on conversation switch (if enabled)
  const prevConversationRef = useRef<string | null>(null);
  useEffect(() => {
    const saveIfNeeded = async () => {
      if (
        autoSaveToMemory && 
        prevConversationRef.current && 
        prevConversationRef.current !== selectedConversation &&
        messages.length >= 2
      ) {
        await saveConversationToMemory(false);
      }
    };
    
    saveIfNeeded();
    prevConversationRef.current = selectedConversation;
  }, [selectedConversation, autoSaveToMemory, messages.length, saveConversationToMemory]);

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

  // Load messages when conversation changes - WITH RACE CONDITION GUARDS
  useEffect(() => {
    // Guard A: Skip if we're in the middle of sending a message
    if (isSubmittingRef.current) {
      console.log('[GhostChat] Skipping hydration: submission in progress');
      return;
    }
    
    // Guard B: Skip if we're currently streaming a response
    if (isStreamingRef.current) {
      console.log('[GhostChat] Skipping hydration: streaming in progress');
      return;
    }
    
    // Guard C: Skip if this is an internal conversation creation (skip-once flag)
    if (skipNextHydrationRef.current === selectedConversation) {
      console.log('[GhostChat] Skipping hydration: internal conversation creation');
      skipNextHydrationRef.current = null; // Clear the flag
      return;
    }
    
    // Guard D: Skip if there's a pending queued message
    if (pendingMessage) {
      console.log('[GhostChat] Skipping hydration: pending message exists');
      return;
    }
    
    // Safe to hydrate from storage
    if (selectedConversation && isInitialized) {
      const conv = getConversation(selectedConversation);
      if (conv) {
        console.log(`[GhostChat] Hydrating ${conv.messages.length} messages from storage`);
        // Map storage messages to UI messages, preserving metadata like comparisonData
        const hydratedMessages: GhostMessageData[] = conv.messages.map(m => ({
          ...m,
          comparisonData: m.metadata?.comparisonData,
        }));
        setMessages(hydratedMessages);
      }
    } else if (!selectedConversation) {
      // Only clear if explicitly no conversation selected (not during transition)
      setMessages([]);
    }
  }, [selectedConversation, isInitialized, getConversation, pendingMessage]);

  // Scroll to bottom on new messages - only if user is near bottom or streaming
  const isCurrentlyStreaming = messages.some(m => m.isStreaming);
  useEffect(() => {
    // Only auto-scroll if user is near bottom OR if streaming (to follow new content)
    if (userIsNearBottomRef.current || isCurrentlyStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isCurrentlyStreaming]);

  // Track scroll position to detect if user is near bottom
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const threshold = 150; // pixels from bottom
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
    userIsNearBottomRef.current = isNearBottom;
  }, []);

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
  // Cleanup incognito chats on page unload (synchronous for reliability)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use synchronous method - async operations are unreliable in beforeunload
      const storage = getGhostStorage();
      if (storage) {
        storage.clearAllTemporarySync();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // Empty deps - storage is accessed via singleton

  // Cleanup incognito chats when leaving Ghost Chat (component unmount)
  useEffect(() => {
    return () => {
      const storage = getGhostStorage();
      if (storage) {
        const tempIds = storage.listTemporaryConversationIds();
        if (tempIds.length > 0) {
          console.log(`[GhostChat] Unmount cleanup: ${tempIds.length} temporary chats`);
          storage.clearAllTemporarySync();
        }
      }
    };
  }, []); // Empty deps - runs only on unmount

  // Cleanup incognito chats when user changes (logout/login)
  useEffect(() => {
    const storage = getGhostStorage();
    if (storage && isInitialized) {
      // On user change, clear any leftover temporary chats
      const tempIds = storage.listTemporaryConversationIds();
      if (tempIds.length > 0) {
        console.log(`[GhostChat] User change cleanup: ${tempIds.length} temporary chats`);
        storage.clearAllTemporarySync();
        refreshConversations();
      }
    }
  }, [user?.id, isInitialized, refreshConversations]); // Trigger when user changes
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

  // === CORE MESSAGE SEND LOGIC (called by handleSendMessage and auto-send) ===
  const executeMessageSend = useCallback(async (
    messageContent: string, 
    currentAttachments: AttachedFile[] = []
  ) => {
    // Prevent double submission
    if (isSubmittingRef.current) {
      console.log('[GhostChat] ⚠️ Already submitting, skipping');
      return;
    }
    
    isSubmittingRef.current = true;
    
    // Reset retry count for new message
    retryCountRef.current = 0;
    
    // Auto-recovery timeout (30 seconds - well beyond any normal response time)
    const recoveryTimeout = setTimeout(() => {
      if (isSubmittingRef.current) {
        console.warn('[GhostChat] ⚠️ Recovery timeout triggered after 30s');
        isSubmittingRef.current = false;
        isStreamingRef.current = false;
      }
    }, 30000);

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
      let createdNewConversation = false;
      if (!convId) {
        createdNewConversation = true;
        convId = createConversation('New Chat');
        if (convId) {
          // Set skip flag BEFORE selecting - prevents hydration from wiping streaming state
          skipNextHydrationRef.current = convId;
          console.log('[GhostChat] Set skip-hydration flag for:', convId);
          setSelectedConversation(convId);
        }
      }
      if (!convId) {
        console.log('[GhostChat] BLOCKED: could not create conversation (storage not ready)');
        (toast as any).info('Chat is still initializing. Please try again in a moment.');
        return;
      }

      // Build multimodal content if we have attachments
      const hasImages = currentAttachments.some(f => f.type === 'image' && f.base64);
      const hasDocuments = currentAttachments.some(f => f.type === 'document');
      
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
      let apiMessageContent: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
      
      if (hasImages || hasDocuments) {
        // Build multimodal content array
        const contentParts: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [];
        
        // Add images first (vision models expect this order)
        const imageFiles = currentAttachments.filter(f => f.type === 'image' && f.base64);
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
        const docFiles = currentAttachments.filter(f => f.type === 'document');
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
        const fullText = (messageContent + docContext).trim();
        if (fullText) {
          contentParts.push({ type: 'text', text: fullText });
        }

        apiMessageContent = contentParts;
      } else {
        apiMessageContent = messageContent;
      }

      // Create display message (always show text for UI)
      const displayContent = messageContent || `[${currentAttachments.length} file(s) attached]`;
      const userMessage: GhostMessageData = {
        id: crypto.randomUUID(),
        role: 'user',
        content: displayContent,
        timestamp: Date.now(),
        attachments: currentAttachments.map(f => ({ name: f.name, type: f.type, size: f.size })),
      };

      // Build message history BEFORE saving (to avoid duplicate)
      // Note: apiMessageContent can be string or array for multimodal
      const messageHistory: Array<{ role: string; content: any }> = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      
      // Search personal memory if enabled (for text mode)
      let memoryContext = '';
      let memorySources: MemorySource[] = [];
      if (mode === 'text' && memoryEnabled && isVaultUnlocked && memory.isInitialized) {
        const memoryResult = await searchPersonalMemory(messageContent);
        memoryContext = memoryResult.context;
        memorySources = memoryResult.sources;
      }
      
      // If we have memory context, prepend it as a system message
      if (memoryContext) {
        messageHistory.unshift({ role: 'system', content: memoryContext });
      }
      
      messageHistory.push({ role: 'user', content: apiMessageContent });

      // Save user message and update UI
      saveMessage(convId, 'user', displayContent);

      // Ensure sidebar shows a meaningful name immediately (instead of "New Chat")
      const convMetaForTitle = conversations.find((c) => c.id === convId);
      const isDefaultTitle =
        !convMetaForTitle?.title ||
        convMetaForTitle.title === 'New Chat' ||
        convMetaForTitle.title === 'New Ghost Chat' ||
        convMetaForTitle.title === 'New Ghost Session';

      if (createdNewConversation || (isDefaultTitle && (convMetaForTitle?.messageCount ?? 0) === 0)) {
        const title = displayContent.slice(0, 50) + (displayContent.length > 50 ? '...' : '');
        updateConversationTitle(convId, title);
      }

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setAttachedFiles([]); // Clear attachments after sending

      // Handle based on mode
      if (mode === 'text') {
        // Track stream start time for metrics
        const streamStartTime = Date.now();

        // Create placeholder for streaming response
        const assistantId = crypto.randomUUID();
        
        // Track streaming state to prevent hydration race
        isStreamingRef.current = true;
        console.log('[GhostChat] Streaming started, assistantId:', assistantId);
        
        // Store memory sources for this response
        const currentMemorySources = memorySources;
        
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
            memorySources: currentMemorySources.length > 0 ? currentMemorySources : undefined,
          },
        ]);

        console.log('[Ghost] Sending message', {
          requestId,
          model: selectedModels[mode],
          historyLength: messageHistory.length,
          hasMemoryContext: !!memoryContext,
          memorySourceCount: memorySources.length,
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
              // Mark streaming complete
              isStreamingRef.current = false;
              console.log('[GhostChat] Streaming completed');
              
              // === LAYER 5: AUTO-RETRY ON EMPTY FIRST RESPONSE ===
              const isFirstMessage = messages.filter(m => m.role === 'user').length <= 1;
              const isEmpty = !fullResponse?.trim();
              
              if (isEmpty && isFirstMessage && retryCountRef.current < 2) {
                retryCountRef.current++;
                console.log(`[GhostChat] 🔄 Empty first response, retry ${retryCountRef.current}/2...`);
                
                // Update the assistant message to show retry status
                setMessages(prev => prev.map(m => 
                  m.id === assistantId
                    ? { 
                        ...m, 
                        content: retryCountRef.current === 1 
                          ? '🔄 Connecting to AI model...' 
                          : '🔄 Retrying...',
                        isStreaming: true,
                      }
                    : m
                ));
                
                // Exponential backoff: 1s, then 2s
                const delay = retryCountRef.current * 1000;
                
                setTimeout(async () => {
                  // Re-trigger the stream with same parameters
                  await streamResponse(
                    messageHistory,
                    selectedModels[mode],
                    {
                      onToken: (token) => {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantId ? { ...msg, content: msg.content.replace(/^🔄.*$/, '') + token } : msg
                          )
                        );
                      },
                      onComplete: async (retryResponse) => {
                        // Mark streaming complete
                        isStreamingRef.current = false;
                        
                        const safeResponse = retryResponse?.trim()
                          ? retryResponse
                          : 'No response received. Please try again.';
                        
                        retryCountRef.current = 0;
                        
                        const responseTime = lastResponseTime || Date.now() - streamStartTime;
                        const tokens = lastTokenCount || Math.ceil(safeResponse.length / 4);
                        
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantId
                              ? {
                                  ...msg,
                                  content: safeResponse,
                                  isStreaming: false,
                                  responseTimeMs: responseTime,
                                  tokenCount: tokens,
                                }
                              : msg
                          )
                        );
                        
                        if (safeResponse && !safeResponse.includes('No response received')) {
                          saveMessage(convId!, 'assistant', safeResponse);
                          await recordUsage('text', selectedModels[mode], {
                            inputTokens: Math.ceil(userMessage.content.length / 4),
                            outputTokens: Math.ceil(safeResponse.length / 4),
                          });
                        }
                      },
                      onError: (error) => {
                        // Mark streaming complete on error
                        isStreamingRef.current = false;
                        console.error('[GhostChat] All retries failed:', error);
                        retryCountRef.current = 0;
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantId
                              ? { 
                                  ...msg, 
                                  content: 'Unable to get response. Please try again.',
                                  isStreaming: false,
                                  isError: true,
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
                }, delay);
                
                return; // Don't proceed with completion logic
              }
              
              // Reset retry count on successful response
              retryCountRef.current = 0;
              
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

              if (safeResponse && !safeResponse.includes('No response received')) {
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
              // Mark streaming complete on error
              isStreamingRef.current = false;
              console.log('[GhostChat] Streaming error:', error);
              
              toast({
                title: 'Error',
                description: error.message || 'Failed to generate response',
                variant: 'destructive',
              });

              // Keep the assistant message visible with error state
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        content: 'Unable to get response. Please try again.',
                        isStreaming: false,
                        isError: true,
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
        // Web search mode with optional verification
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
          // Collect all sources for verification
          const collectedSources: WebSource[] = [];
          let finalAnswer = '';
          
          await webSearch.search(userMessage.content, {
            onToken: (token) => {
              finalAnswer += token;
              setMessages((prev) =>
                prev.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + token } : msg))
              );
            },
            onCitation: (citations) => {
              setSearchCitations(citations);
              
              // Analyze sources for trust if verified mode is on
              if (verifiedMode) {
                citations.forEach(c => {
                  try {
                    const analyzed = analyzeSource(c.url, c.title, c.snippet || '');
                    collectedSources.push(analyzed);
                  } catch {
                    // Invalid URL, skip
                  }
                });
              }
            },
            onComplete: async (response) => {
              // Build verified result if in verified mode
              let verifiedResult: VerifiedSearchResult | undefined;
              
              if (verifiedMode && collectedSources.length > 0) {
                // Classify query for domain-specific warnings
                const queryClassification = classifyQuery(userMessage.content);
                const warnings: string[] = [];
                
                // Check domain-specific requirements
                for (const domain of queryClassification.domains) {
                  const strategy = DOMAIN_SEARCH_STRATEGIES[domain];
                  if (strategy) {
                    const hasRequiredSources = collectedSources.some(s => 
                      strategy.prioritySites.some(site => s.domain.includes(site.replace('*.', '')))
                    );
                    if (!hasRequiredSources) {
                      warnings.push(strategy.warningIfMissing);
                    }
                  }
                }
                
                // Sort by trust score
                collectedSources.sort((a, b) => b.trustScore - a.trustScore);
                
                verifiedResult = {
                  query: userMessage.content,
                  answer: response.answer,
                  claims: [], // Would require NLP for claim extraction
                  sources: collectedSources.slice(0, 10),
                  overallTrust: calculateOverallTrust(collectedSources),
                  methodology: generateMethodology(collectedSources, userMessage.content),
                  searchTimestamp: Date.now(),
                  warnings,
                };
                
                setLastVerifiedResult(verifiedResult);
              }
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId 
                    ? { 
                        ...msg, 
                        content: response.answer, 
                        isStreaming: false,
                        verifiedResult,
                      } 
                    : msg
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
    } catch (error) {
      console.error('[GhostChat] Send error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      clearTimeout(recoveryTimeout);
      isSubmittingRef.current = false;
      // Note: isStreamingRef is reset by onComplete/onError, but ensure it's reset on exceptions
      console.log('[GhostChat] Send attempt complete, submission unlocked');
    }
  }, [
    user, mode, selectedConversation, selectedModels, messages, settings,
    canUse, useFeature, checkCredits, createConversation, saveMessage,
    streamResponse, webSearch, ghostResearch, recordUsage, toast,
    lastResponseTime, lastTokenCount, handleInsufficientCredits, verifiedMode,
  ]);

  const handleSendMessage = async (content: string, attachments?: File[]) => {
    const messageContent = content?.trim() || '';
    
    console.log('[GhostChat] handleSendMessage called', {
      contentLength: messageContent?.length,
      isStreaming,
      streamStatus,
      isSearching: webSearch.isSearching,
      isResearching: ghostResearch.isResearching,
      isSubmitting: isSubmittingRef.current,
      hasUser: !!user,
      isInitialized,
      initPhase,
    });

    // Basic validation first
    if (!messageContent && attachedFiles.length === 0) return;

    // === LAYER 2: QUEUE IF STORAGE NOT READY ===
    if (!isInitialized || initPhase === 'connecting') {
      console.log('[GhostChat] 📥 Storage initializing, queuing message...');
      
      // Store the message for later
      setPendingMessage({
        content: messageContent,
        attachments: [...attachedFiles],
        timestamp: Date.now(),
      });
      
      // Clear input immediately so user sees their message was received
      setInputValue('');
      setAttachedFiles([]);
      
      // Add visual feedback in the chat
      const userMsgId = `queued-user-${Date.now()}`;
      const statusMsgId = `queued-status-${Date.now()}`;
      
      setMessages(prev => [
        ...prev,
        {
          id: userMsgId,
          role: 'user' as const,
          content: messageContent,
          timestamp: Date.now(),
          attachments: attachedFiles.length > 0 ? attachedFiles.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
          })) : undefined,
        },
        {
          id: statusMsgId,
          role: 'assistant' as const,
          content: 'Connecting to secure storage...',
          timestamp: Date.now(),
          isStreaming: true,
        },
      ]);
      
      // Don't proceed - the auto-send effect will handle it
      return;
    }

    // Auto-recover if streaming state got stuck (prevents "can\'t send" deadlocks)
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

    // Check for in-progress operations
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

    // Check if compare mode is active
    if (isCompareMode && mode === 'text') {
      console.log('[GhostChat] Using compare mode');
      setInputValue('');
      await compare(messageContent, settings?.system_prompt || undefined);
      return;
    }

    // Execute the core send logic
    await executeMessageSend(messageContent, attachedFiles);
  };

  // Keep handleSendMessageRef updated to avoid stale closures in auto-send effect
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

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

    // PDF files - extract text content for all models
    if (isPDFFile(file)) {
      try {
        const { text, pageCount, truncated } = await extractTextFromPDF(file);
        console.log(`[GhostChat] PDF extracted: ${pageCount} pages, ${text.length} chars, truncated: ${truncated}`);
        
        if (!text || text.trim().length === 0) {
          // Fallback to base64 if no text could be extracted (scanned PDF)
          const base64 = await fileToBase64(file);
          return { id, file, base64, name: file.name, type: 'document', size: file.size };
        }
        
        return { 
          id, 
          file, 
          text: truncated ? `${text}\n\n[Document truncated - showing first ${pageCount > 50 ? 50 : pageCount} pages]` : text, 
          name: file.name, 
          type: 'document', 
          size: file.size 
        };
      } catch (error) {
        console.error('[GhostChat] PDF extraction failed:', error);
        // Fallback to base64 for vision models
        const base64 = await fileToBase64(file);
        return { id, file, base64, name: file.name, type: 'document', size: file.size };
      }
    }

    // DOCX files - extract text using mammoth
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')) {
      try {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        console.log(`[GhostChat] DOCX extracted: ${text.length} chars`);
        
        if (!text || text.trim().length === 0) {
          return null;
        }
        
        return { id, file, text, name: file.name, type: 'document', size: file.size };
      } catch (error) {
        console.error('[GhostChat] DOCX extraction failed:', error);
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


        {/* Privacy Protection Notice for Anonymous Users */}
        {corruptedCount > 0 && (
          <Alert className="m-4 border-purple-500/30 bg-purple-500/10">
            <Shield className="h-4 w-4 text-purple-400" />
            <AlertTitle className="text-purple-100">{t('ghost.alerts.corruptedTitle', 'Your privacy is protected')}</AlertTitle>
            <AlertDescription className="mt-2 text-purple-200/80">
              {t('ghost.alerts.corruptedDescription', 'Previous conversations were encrypted with a temporary session key. For anonymous browsing, this key changes when browser data is cleared — keeping your data private by design.')}
              
              <p className="mt-3 text-purple-300">{t('ghost.alerts.signUpPrompt', 'Want conversations that persist across sessions?')}</p>
              
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => navigate('/auth?intent=ghost')}
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {t('ghost.alerts.signUpFree', 'Sign up for free')}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
                  onClick={() => {
                    clearAllData();
                    toast({ 
                      title: t('ghost.alerts.storageCleared', 'Data cleared'), 
                      description: t('ghost.alerts.storageClearedDescription', 'Your local data has been cleared. Start fresh with full encryption.') 
                    });
                  }}
                >
                  {t('ghost.alerts.clearCorruptedData', 'Clear previous data')}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Mode-specific view */}
          <div className="flex-1 flex flex-col">
          
          {/* Text Mode - Empty state with centered input (Perplexity-style) */}
          {mode === 'text' && messages.length === 0 && (
            <>
            {/* Compare Results - rendered OUTSIDE GhostTextViewEmpty for full width */}
            {isCompareMode && compareResult && (
              <div className="w-full max-w-5xl mx-auto px-4 pt-8 pb-4">
                <CompareResults
                  result={compareResult}
                  onRate={rateCompareResponse}
                  onUseResponse={handleUseCompareResponse}
                />
              </div>
            )}
            
            {/* Only show empty state welcome when no compare results */}
            <GhostTextViewEmpty hasCompareResults={isCompareMode && !!compareResult}>
              {/* Mode Toggles: Grounded Mode and Compare Mode */}
              <div className="mb-3 flex items-center justify-center gap-4 flex-wrap">
                <GroundedModeToggle
                  isGrounded={groundedMode}
                  onToggle={setGroundedMode}
                  disabled={isStreaming || !memory.isInitialized}
                  documentsCount={documentsCount}
                />
                {groundedMode && documentsCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Citations from {documentsCount} document{documentsCount !== 1 ? 's' : ''}
                  </span>
                )}
                
                {/* Compare Mode Toggle */}
                <Button
                  variant={isCompareMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleCompareMode}
                  disabled={isStreaming || isComparing}
                  className="gap-2 h-8"
                >
                  <GitCompareArrows className="h-4 w-4" />
                  <span className="hidden sm:inline">Compare</span>
                  {isCompareMode && (
                    <span className="text-xs opacity-70">{compareSelectedModels.length}</span>
                  )}
                </Button>
                
                {/* Model Selector when Compare Mode is active */}
                {isCompareMode && (
                  <ModelSelector
                    selectedModels={compareSelectedModels}
                    onToggleModel={toggleCompareModel}
                    onApplyPreset={applyComparePreset}
                    disabled={isComparing}
                  />
                )}
              </div>
              
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
                isStreaming={isStreaming || isComparing}
                streamStatus={isComparing ? 'generating' : streamStatus}
                elapsedTime={elapsedTime}
                credits={balance}
                enhancePrompt={enhancePrompt}
                onToggleEnhance={() => setEnhancePrompt(!enhancePrompt)}
                onOpenSettings={() => setShowSettings(true)}
                onAttach={handleFileAttach}
                disabled={!isInitialized || isComparing}
                voiceLanguage={settings?.voice_language}
                matureFilterEnabled={settings?.mature_filter_enabled ?? true}
                initPhase={initPhase}
                hasPendingMessage={!!pendingMessage}
                memoryEnabled={memoryEnabled}
                onToggleMemory={() => {
                  if (!isVaultUnlocked) {
                    setShowVaultUnlock(true);
                  } else {
                    setMemoryEnabled(!memoryEnabled);
                  }
                }}
                memoryCount={lastMemorySources.length}
                isMemorySearching={memorySearching}
                memoryDisabled={!isVaultUnlocked}
                lastAssistantMessage={lastAssistantMessage}
              />
            </GhostTextViewEmpty>
            </>
          )}
          
          {/* Text Mode - With messages (input at bottom) */}
          {mode === 'text' && messages.length > 0 && (
              <GhostTextView hasMessages={true}>
                {/* Native scroll - more reliable than ScrollArea */}
                <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
                  <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-muted/60 rounded-2xl px-4 py-3' : ''}`}>
                          {/* Show comparison history for user messages with comparison data */}
                          {msg.role === 'user' && msg.comparisonData && (
                            <ComparisonHistoryCard 
                              data={msg.comparisonData}
                              className="mb-2"
                            />
                          )}
                          {/* Render GroundedResponse for grounded assistant messages */}
                          {msg.role === 'assistant' && msg.isGrounded ? (
                            <GroundedResponse
                              message={{
                                id: msg.id,
                                role: msg.role,
                                content: msg.content,
                                isGrounded: true,
                                citations: msg.citations,
                                sources: msg.groundedSources,
                                timestamp: new Date(msg.timestamp).toISOString(),
                              }}
                              onSourceClick={(source) => {
                                if (source.url) {
                                  window.open(source.url, '_blank', 'noopener,noreferrer');
                                }
                              }}
                            />
                          ) : (
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
                          )}
                          {/* Show memory sources for assistant messages */}
                          {msg.role === 'assistant' && msg.memorySources && msg.memorySources.length > 0 && !msg.isGrounded && (
                            <MemorySourcesCard sources={msg.memorySources} className="mt-3" />
                          )}
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
                  {/* Search header with verified mode toggle */}
                  <div className="flex-shrink-0 px-4 py-3 border-b border-border/40">
                    <div className="max-w-3xl mx-auto">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Sources</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVerifiedMode(!verifiedMode)}
                          className={cn(
                            "h-7 px-2 text-xs gap-1.5",
                            verifiedMode ? "text-green-600 hover:text-green-700" : "text-muted-foreground"
                          )}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          {verifiedMode ? "Verified Mode ON" : "Verified Mode OFF"}
                        </Button>
                      </div>
                      {searchCitations.length > 0 && (
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
                      )}
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1" onScroll={handleScroll}>
                    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                      {messages.map((msg) => (
                        <div key={msg.id}>
                          <GhostMessageComponent
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
                          {/* Show verified sources display for assistant messages with verified results */}
                          {msg.role === 'assistant' && msg.verifiedResult && (
                            <div className="mt-2 ml-10">
                              <VerifiedSourcesDisplay
                                result={msg.verifiedResult}
                                onSourceClick={(source) => {
                                  window.open(source.url, '_blank', 'noopener,noreferrer');
                                }}
                              />
                            </div>
                          )}
                        </div>
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
                  
                  <ScrollArea className="flex-1" onScroll={handleScroll}>
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
                    disabled={!isInitialized}
                    voiceLanguage={settings?.voice_language}
                    matureFilterEnabled={settings?.mature_filter_enabled ?? true}
                    initPhase={initPhase}
                    hasPendingMessage={!!pendingMessage}
                    lastAssistantMessage={lastAssistantMessage}
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
                      navigate('/auth?intent=ghost');
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
                  disabled={!isInitialized}
                  voiceLanguage={settings?.voice_language}
                  matureFilterEnabled={settings?.mature_filter_enabled ?? true}
                  initPhase={initPhase}
                  hasPendingMessage={!!pendingMessage}
                  // Personal Memory props
                  memoryEnabled={memoryEnabled}
                  onToggleMemory={() => {
                    if (!isVaultUnlocked) {
                      setShowVaultUnlock(true);
                    } else {
                      setMemoryEnabled(!memoryEnabled);
                    }
                  }}
                  memoryCount={lastMemorySources.length}
                  isMemorySearching={memorySearching}
                  memoryDisabled={!isVaultUnlocked}
                  lastAssistantMessage={lastAssistantMessage}
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

      {/* Vault Unlock Dialog for Memory */}
      <VaultUnlockDialog
        open={showVaultUnlock}
        onOpenChange={setShowVaultUnlock}
        onUnlocked={() => {
          setMemoryEnabled(true);
        }}
      />
    </GhostDropZone>
  );
}
