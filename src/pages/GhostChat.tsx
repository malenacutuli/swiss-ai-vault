import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/hooks/use-toast';
import { useGhostStorage } from '@/hooks/useGhostStorage';
import { useGhostCredits } from '@/hooks/useGhostCredits';
import { useGhostInference } from '@/hooks/useGhostInference';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Plus,
  Send,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Menu,
  X,
  Loader2,
  Square,
  Shield,
  Eye,
  EyeOff,
  Lock,
  Sparkles,
} from 'lucide-react';
import ghostIcon from '@/assets/ghost-icon.jpg';
import { BuyGhostCreditsModal } from '@/components/ghost/BuyGhostCreditsModal';
import { GhostModeToggle } from '@/components/ghost/GhostModeToggle';
import { GhostModelSelector, getSavedGhostModel } from '@/components/ghost/GhostModelSelector';
import { GhostMessage as GhostMessageComponent } from '@/components/ghost/GhostMessage';
import { ExportImportDialog } from '@/components/ghost/ExportImportDialog';
import { GhostDashboard } from '@/components/ghost/GhostDashboard';
import type { ExportableConversation } from '@/lib/ghost/export-import';

interface GhostMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export default function GhostChat() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ghost storage hook
  const {
    conversations,
    isInitialized,
    isLoading: storageLoading,
    createConversation,
    getConversation,
    saveMessage,
    deleteConversation,
    exportConversation,
    exportAllConversations,
    importConversation,
  } = useGhostStorage();

  // Ghost credits hook
  const {
    balance,
    formattedBalance,
    isLoading: creditsLoading,
  } = useGhostCredits();

  // Streaming inference hook
  const { streamResponse, cancelStream, isStreaming, streamStatus } = useGhostInference();

  // UI State
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<GhostMessageData[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(getSavedGhostModel);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [coldStartWarning, setColdStartWarning] = useState<string | null>(null);
  const [showExportImport, setShowExportImport] = useState(false);
  const [exportImportTab, setExportImportTab] = useState<'export' | 'import'>('export');

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleNewSession();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        if (e.shiftKey) {
          handleExportAll();
        } else if (selectedConversation) {
          handleExport(selectedConversation);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConversation]);

  const handleNewSession = () => {
    const id = createConversation('New Session');
    if (id) {
      setSelectedConversation(id);
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming || !selectedConversation) return;

    const userMessage: GhostMessageData = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    // Save user message to local storage
    saveMessage(selectedConversation, 'user', userMessage.content);
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Create placeholder for streaming assistant response
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }]);

    // Build message history for context
    const conv = getConversation(selectedConversation);
    const messageHistory = conv?.messages.map(m => ({
      role: m.role,
      content: m.content
    })) || [];
    messageHistory.push({ role: 'user', content: userMessage.content });

    // Set up cold start warning timers
    const coldStartTimer = setTimeout(() => {
      setColdStartWarning('Initializing model...');
    }, 3000);
    
    const longWaitTimer = setTimeout(() => {
      setColdStartWarning('GPU spin-up in progress — approximately 30 seconds');
    }, 10000);

    try {
      await streamResponse(
        messageHistory,
        selectedModel,
        {
          onToken: (token) => {
            // Clear cold start warnings on first token
            clearTimeout(coldStartTimer);
            clearTimeout(longWaitTimer);
            setColdStartWarning(null);
            
            // Update the streaming message with new token
            setMessages(prev => prev.map(msg => 
              msg.id === assistantId 
                ? { ...msg, content: msg.content + token }
                : msg
            ));
          },
          onComplete: (fullResponse) => {
            // Mark streaming complete and save to storage
            setMessages(prev => prev.map(msg => 
              msg.id === assistantId 
                ? { ...msg, content: fullResponse, isStreaming: false }
                : msg
            ));
            
            // Save completed response to local storage
            if (fullResponse) {
              saveMessage(selectedConversation, 'assistant', fullResponse);
            }
          },
          onError: (error) => {
            console.error('[Ghost Chat] Streaming error:', error);
            
            // Handle specific error types
            if (error.message.includes('Insufficient ghost credits')) {
              toast({
                title: 'Insufficient Credits',
                description: 'Additional tokens required to continue.',
                variant: 'destructive',
              });
            } else {
              toast({
                title: 'Error',
                description: error.message || 'Failed to generate response',
                variant: 'destructive',
              });
            }
            
            // Remove the empty assistant message on error
            setMessages(prev => prev.filter(msg => msg.id !== assistantId));
          },
        }
      );
    } finally {
      clearTimeout(coldStartTimer);
      clearTimeout(longWaitTimer);
      setColdStartWarning(null);
    }
  };

  const handleExport = async (convId: string) => {
    const blob = await exportConversation(convId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghost-session-${convId.slice(0, 8)}.svghost`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Session exported successfully' });
    }
  };

  const handleExportAll = async () => {
    const blob = await exportAllConversations();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghost-sessions-all-${Date.now()}.svghost`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'All sessions exported successfully' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const id = await importConversation(file);
      if (id) {
        setSelectedConversation(id);
        toast({ title: 'Imported', description: 'Session imported successfully' });
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: 'Invalid or corrupted file',
        variant: 'destructive',
      });
    }

    e.target.value = '';
  };

  const handleDelete = (convId: string) => {
    deleteConversation(convId);
    if (selectedConversation === convId) {
      setSelectedConversation(null);
      setMessages([]);
    }
    setConversationToDelete(null);
    toast({ title: 'Deleted', description: 'Session deleted' });
  };

  const handleSwitchToVaultChat = () => {
    setShowSwitchDialog(true);
  };

  const confirmSwitch = () => {
    setShowSwitchDialog(false);
    navigate('/chat');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground font-sans">Please log in to use Ghost Mode</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".svghost"
        onChange={handleImport}
        className="hidden"
      />

      {/* Sidebar */}
      <div
        className={cn(
          'flex flex-col border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-swiss-navy/20 border border-swiss-navy/30 flex items-center justify-center">
              <EyeOff className="w-5 h-5 text-swiss-navy" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-foreground tracking-tight">Ghost Sessions</h2>
              <p className="text-xs text-muted-foreground tracking-wide uppercase">Local Only</p>
            </div>
          </div>
          <Button
            onClick={handleNewSession}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium tracking-wide"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={cn(
                  'group flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all duration-200 ease-in-out',
                  selectedConversation === conv.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted/50'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {conv.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatTime(conv.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(conv.id);
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConversationToDelete(conv.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <EyeOff className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No sessions yet</p>
                <p className="text-xs mt-1">Create one to begin</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Usage Dashboard */}
        <div className="border-t border-border">
          <GhostDashboard
            onBuyCredits={() => setShowBuyCredits(true)}
            totalConversations={conversations.length}
            totalMessages={conversations.reduce((sum, c) => sum + (c.messageCount || 0), 0)}
          />
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={() => {
                setExportImportTab('export');
                setShowExportImport(true);
              }}
              disabled={conversations.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={() => {
                setExportImportTab('import');
                setShowExportImport(true);
              }}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Import
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/30 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-swiss-navy/20 border border-swiss-navy/30 flex items-center justify-center">
                <EyeOff className="w-4 h-4 text-swiss-navy" />
              </div>
              <span className="font-serif font-semibold text-foreground tracking-tight">Ghost Mode</span>
            </div>

            {/* Local Only Indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <Badge variant="outline" className="border-success/30 text-success text-xs font-medium tracking-caps">
                LOCAL ONLY
              </Badge>
            </div>

            {/* Streaming Status Indicator */}
            {isStreaming && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 border border-border">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary" />
                <span className="text-xs text-muted-foreground">
                  {streamStatus === 'connecting' ? 'Connecting...' : 'Generating...'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Credits Display */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border">
              <Sparkles className="w-4 h-4 text-swiss-sapphire" />
              <span className="text-sm font-medium text-foreground">
                {formattedBalance}
              </span>
              <span className="text-xs text-muted-foreground">tokens</span>
            </div>

            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              onClick={() => setShowBuyCredits(true)}
            >
              Purchase Credits
            </Button>

            <GhostModeToggle currentMode="ghost" />
          </div>
        </div>

        {/* Ghost Mode Banner */}
        <div className="px-6 py-3 bg-swiss-navy/5 border-b border-border text-center">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            <span className="font-medium text-foreground">Ghost Mode Active</span>
            <span className="mx-2">—</span>
            <span>Nothing stored on SwissVault servers</span>
          </p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          {selectedConversation ? (
            <ScrollArea className="h-full">
              <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-4',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-xl px-5 py-4 transition-all duration-200',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-card-foreground'
                      )}
                    >
                      <GhostMessageComponent
                        content={message.content}
                        role={message.role}
                        timestamp={message.timestamp}
                        isStreaming={message.isStreaming}
                      />
                      {!message.isStreaming && (
                        <>
                          <p className="text-xs opacity-50 mt-3">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </p>
                          {message.role === 'assistant' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-xs text-muted-foreground hover:text-foreground -ml-2"
                              onClick={() => {
                                toast({ title: 'Regenerate', description: 'Coming soon' });
                              }}
                            >
                              <RefreshCw className="w-3 h-3 mr-1.5" />
                              Regenerate
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {/* Streaming status indicators */}
                {isStreaming && streamStatus === 'connecting' && (
                  <div className="flex gap-4 justify-start">
                    <div className="bg-card border border-border rounded-xl px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Connecting...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Cold start warning */}
                {coldStartWarning && (
                  <div className="flex gap-4 justify-start">
                    <div className="bg-warning/10 border border-warning/20 rounded-xl px-5 py-4">
                      <div className="flex items-center gap-4">
                        <Loader2 className="w-4 h-4 animate-spin text-warning" />
                        <span className="text-sm text-warning">{coldStartWarning}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { cancelStream(); setColdStartWarning(null); }}
                          className="h-7 px-3 text-xs text-warning hover:text-warning/80"
                        >
                          <Square className="w-3 h-3 mr-1.5" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-24 h-24 rounded-2xl bg-swiss-navy/10 border border-swiss-navy/20 flex items-center justify-center mb-8">
                <EyeOff className="w-12 h-12 text-swiss-navy opacity-50" />
              </div>
              <h3 className="font-serif text-2xl font-semibold text-foreground mb-3 tracking-tight">
                Welcome to Ghost Mode
              </h3>
              <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
                Your conversations are stored locally and never touch SwissVault servers.
                Select a session or create a new one to get started.
              </p>
              <Button
                onClick={handleNewSession}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                Start New Session
              </Button>
            </div>
          )}
        </div>

        {/* Input Area */}
        {selectedConversation && (
          <div className="p-6 border-t border-border bg-card/30">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-4">
                {/* Model Selector */}
                <GhostModelSelector 
                  value={selectedModel} 
                  onValueChange={setSelectedModel}
                  disabled={isStreaming}
                />

                {/* Input */}
                <div className="flex-1 relative">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    className="min-h-[56px] max-h-32 resize-none bg-background border-border text-foreground placeholder:text-muted-foreground pr-12"
                    disabled={isStreaming}
                  />
                </div>

                {/* Send Button */}
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isStreaming}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-[56px] px-6"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Switch to VaultChat Dialog */}
      <AlertDialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-foreground">Switch to VaultChat?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Switching to VaultChat will store conversations on SwissVault servers (encrypted). 
              Your Ghost Mode sessions will remain stored locally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground hover:bg-muted">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSwitch}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!conversationToDelete} onOpenChange={() => setConversationToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-foreground">Delete Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete this Ghost session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground hover:bg-muted">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => conversationToDelete && handleDelete(conversationToDelete)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Buy Credits Modal */}
      <BuyGhostCreditsModal open={showBuyCredits} onOpenChange={setShowBuyCredits} />

      {/* Export/Import Dialog */}
      <ExportImportDialog
        open={showExportImport}
        onOpenChange={setShowExportImport}
        conversations={conversations}
        getConversation={(id) => {
          const conv = getConversation(id);
          if (!conv) return undefined;
          return {
            id: conv.id,
            title: conv.title,
            messages: conv.messages,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
          } as ExportableConversation;
        }}
        onImportComplete={(imported) => {
          // The imported conversations need to be added to storage
          for (const conv of imported) {
            const newId = createConversation(conv.title);
            if (newId) {
              for (const msg of conv.messages) {
                saveMessage(newId, msg.role, msg.content);
              }
            }
          }
          toast({
            title: 'Import successful',
            description: `Imported ${imported.length} conversations`,
          });
        }}
        defaultTab={exportImportTab}
      />
    </div>
  );
}
