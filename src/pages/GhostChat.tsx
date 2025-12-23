import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useGhostStorage } from '@/hooks/useGhostStorage';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useGhostInference } from '@/hooks/useGhostInference';
import { useGhostTTS } from '@/hooks/useGhostTTS';
import { useGhostSearch, type SearchResult } from '@/hooks/useGhostSearch';
import { useGhostSettings } from '@/hooks/useGhostSettings';
import { useAuth } from '@/contexts/AuthContext';

// Components
import { GhostSidebar, type GhostConversation, type GhostFolder } from '@/components/ghost/GhostSidebar';
import { GhostModeTabs, type GhostMode } from '@/components/ghost/GhostModeTabs';
import { GhostChatInput } from '@/components/ghost/GhostChatInput';
import { GhostMessage as GhostMessageComponent } from '@/components/ghost/GhostMessage';
import { GhostTextView, GhostImageView, GhostVideoView, GhostSearchView } from '@/components/ghost/views';
import { BuyGhostCreditsModal } from '@/components/ghost/BuyGhostCreditsModal';
import { GhostSettings } from '@/components/ghost/GhostSettings';

import { EyeOff, Shield, Menu, X } from 'lucide-react';

// Default models per mode
const DEFAULT_MODELS: Record<GhostMode, string> = {
  text: 'qwen2.5-3b',
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

export default function GhostChat() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Web search hook
  const webSearch = useGhostSearch();

  // TTS hook for read-aloud
  const tts = useGhostTTS();

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
  const [folders, setFolders] = useState<GhostFolder[]>([]);
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
  }));

  const handleNewChat = (isTemporary = false) => {
    const id = createConversation('New Chat');
    if (id) {
      setSelectedConversation(id);
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming || webSearch.isSearching) return;

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
    if (mode === 'text') {
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
          },
          {
            systemPrompt: settings?.system_prompt || undefined,
            temperature: settings?.default_temperature ?? 0.7,
            topP: settings?.default_top_p ?? 0.9,
          }
        );
      } catch (error) {
        console.error('Stream error:', error);
      }
    } else if (mode === 'search') {
      // Web search mode
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      }]);
      setSearchCitations([]);

      try {
        await webSearch.search(userMessage.content, {
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
          onComplete: (response) => {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: response.answer, isStreaming: false }
                : msg
            ));
            if (response.answer) {
              saveMessage(convId!, 'assistant', response.answer);
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

  // File attachment handlers
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
        onCreateFolder={handleCreateFolder}
        userName={user.email?.split('@')[0] || 'User'}
        userCredits={balance}
        isPro={false}
        onOpenSettings={() => setShowSettings(true)}
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
              <span className="text-xs text-muted-foreground uppercase tracking-wider hidden sm:inline font-sans">
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
                        id={msg.id}
                        role={msg.role}
                        content={msg.content}
                        isStreaming={msg.isStreaming}
                        ttsState={{
                          isPlaying: tts.isPlaying,
                          isPaused: tts.isPaused,
                          isLoading: tts.isLoading,
                          progress: tts.progress,
                          currentMessageId: tts.currentMessageId,
                        }}
                        onSpeak={(messageId, content) => tts.speak(content, messageId, {
                          voice: settings?.voice_id as any,
                          speed: settings?.voice_speed,
                        })}
                        onStopSpeak={tts.stop}
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
                  setVideoInputImage(imageUrl);
                  handleModeChange('video');
                }}
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
                          isStreaming={msg.isStreaming}
                          ttsState={{
                            isPlaying: tts.isPlaying,
                            isPaused: tts.isPaused,
                            isLoading: tts.isLoading,
                            progress: tts.progress,
                            currentMessageId: tts.currentMessageId,
                          }}
                          onSpeak={(messageId, content) => tts.speak(content, messageId, {
                            voice: settings?.voice_id as any,
                            speed: settings?.voice_speed,
                          })}
                          onStopSpeak={tts.stop}
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
                  credits={balance}
                  enhancePrompt={enhancePrompt}
                  onToggleEnhance={() => setEnhancePrompt(!enhancePrompt)}
                  onOpenSettings={() => setShowSettings(true)}
                  onAttach={handleFileAttach}
                  voiceLanguage={settings?.voice_language}
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
