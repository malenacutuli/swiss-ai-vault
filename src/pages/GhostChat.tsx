import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useGhostStorage } from '@/hooks/useGhostStorage';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useGhostInference } from '@/hooks/useGhostInference';
import { useAuth } from '@/contexts/AuthContext';

// Components
import { GhostSidebar, type GhostConversation, type GhostFolder } from '@/components/ghost/GhostSidebar';
import { GhostModeTabs, type GhostMode } from '@/components/ghost/GhostModeTabs';
import { GhostChatInput } from '@/components/ghost/GhostChatInput';
import { GhostMessage as GhostMessageComponent } from '@/components/ghost/GhostMessage';
import { GhostTextView, GhostImageView, GhostVideoView, GhostSearchView } from '@/components/ghost/views';
import { BuyGhostCreditsModal } from '@/components/ghost/BuyGhostCreditsModal';

import { EyeOff, Shield, Menu, X } from 'lucide-react';

// Default models per mode
const DEFAULT_MODELS: Record<GhostMode, string> = {
  text: 'qwen2.5-3b',
  image: 'auto-image',
  video: 'runway-gen3-turbo',
  search: 'gpt-4o-mini',
};

interface GhostMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export default function GhostChat() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get mode from URL or default to 'text'
  const mode = (searchParams.get('mode') as GhostMode) || 'text';

  // Ghost storage hook
  const {
    conversations,
    isInitialized,
    createConversation,
    getConversation,
    saveMessage,
    deleteConversation,
    exportConversation,
  } = useGhostStorage();

  // Ghost credits hook
  const { balance, isLoading: creditsLoading } = useGhostCredits();

  // Streaming inference hook
  const { streamResponse, cancelStream, isStreaming } = useGhostInference();

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<GhostMessageData[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [folders, setFolders] = useState<GhostFolder[]>([]);

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
  }));

  const handleNewChat = (isTemporary = false) => {
    const id = createConversation('New Chat');
    if (id) {
      setSelectedConversation(id);
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;

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

    // Save user message
    saveMessage(convId, 'user', userMessage.content);
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Handle based on mode
    if (mode === 'text' || mode === 'search') {
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
      const conv = getConversation(convId);
      const messageHistory = conv?.messages.map(m => ({
        role: m.role,
        content: m.content
      })) || [];
      messageHistory.push({ role: 'user', content: userMessage.content });

      try {
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
            onComplete: (fullResponse) => {
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, content: fullResponse, isStreaming: false }
                  : msg
              ));
              if (fullResponse) {
                saveMessage(convId!, 'assistant', fullResponse);
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
          }
        );
      } catch (error) {
        console.error('Stream error:', error);
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
  };

  const handleExportConversation = async (id: string) => {
    const blob = await exportConversation(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghost-chat-${id.slice(0, 8)}.svghost`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Chat exported successfully' });
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

  const handleCreateFolder = () => {
    const newFolder: GhostFolder = {
      id: crypto.randomUUID(),
      name: 'New Folder',
    };
    setFolders(prev => [...prev, newFolder]);
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
        onCreateFolder={handleCreateFolder}
        userName={user.email?.split('@')[0] || 'User'}
        userCredits={balance}
        isPro={false}
        onOpenSettings={() => navigate('/labs/settings')}
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

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-swiss-navy/20 border border-swiss-navy/30 flex items-center justify-center">
                <EyeOff className="w-4 h-4 text-swiss-navy" />
              </div>
              <span className="font-serif font-semibold text-foreground tracking-tight hidden sm:inline">
                Ghost Mode
              </span>
            </div>

            {/* Mode Tabs */}
            <GhostModeTabs
              activeMode={mode}
              onModeChange={handleModeChange}
              className="ml-4"
            />
          </div>

          {/* Right side indicators */}
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

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Mode-specific view */}
          <div className="flex-1 overflow-hidden">
            {mode === 'text' && (
              <GhostTextView hasMessages={messages.length > 0}>
                <ScrollArea className="h-full">
                  <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                    {messages.map((msg) => (
                      <GhostMessageComponent
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        isStreaming={msg.isStreaming}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </GhostTextView>
            )}
            {mode === 'image' && (
              <GhostImageView
                onNavigateToVideo={(imageUrl) => {
                  handleModeChange('video');
                  // TODO: Pass image URL to video view
                }}
              />
            )}
            {mode === 'video' && <GhostVideoView />}
            {mode === 'search' && (
              messages.length > 0 ? (
                <ScrollArea className="h-full">
                  <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                    {messages.map((msg) => (
                      <GhostMessageComponent
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        isStreaming={msg.isStreaming}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              ) : (
                <GhostSearchView />
              )
            )}
          </div>

          {/* Input Area */}
          <div className="flex-shrink-0 p-4 lg:p-6">
            <div className="max-w-3xl mx-auto">
              <GhostChatInput
                mode={mode}
                selectedModel={selectedModels[mode]}
                onSelectModel={handleModelChange}
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSendMessage}
                onCancel={cancelStream}
                isStreaming={isStreaming}
                credits={balance}
                enhancePrompt={enhancePrompt}
                onToggleEnhance={() => setEnhancePrompt(!enhancePrompt)}
                onOpenSettings={() => {}}
                onAttach={() => {}}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <BuyGhostCreditsModal
        open={showBuyCredits}
        onOpenChange={setShowBuyCredits}
      />
    </div>
  );
}
