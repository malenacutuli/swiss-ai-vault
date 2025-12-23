import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Plus,
  Send,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Coins,
  ArrowLeftRight,
  Menu,
  X,
  MessageSquare,
} from 'lucide-react';
import ghostIcon from '@/assets/ghost-icon.jpg';
import { BuyGhostCreditsModal } from '@/components/ghost/BuyGhostCreditsModal';
import { GhostModeToggle } from '@/components/ghost/GhostModeToggle';

const SWISS_MODELS = [
  { id: 'llama-3.1-70b-swiss', name: 'Llama 3.1 70B', provider: 'Swiss' },
  { id: 'qwen-2.5-72b-swiss', name: 'Qwen 2.5 72B', provider: 'Swiss' },
  { id: 'mistral-7b-swiss', name: 'Mistral 7B', provider: 'Swiss' },
];

interface GhostMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
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

  // UI State
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<GhostMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState(SWISS_MODELS[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

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
    const id = createConversation('New Ghost Session');
    if (id) {
      setSelectedConversation(id);
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isGenerating || !selectedConversation) return;

    const userMessage: GhostMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    // Save to local storage
    saveMessage(selectedConversation, 'user', userMessage.content);
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);

    try {
      // Build message history for context
      const conv = getConversation(selectedConversation);
      const messageHistory = conv?.messages.map(m => ({
        role: m.role,
        content: m.content
      })) || [];
      
      // Add the new user message
      messageHistory.push({ role: 'user', content: userMessage.content });

      // Call Swiss-hosted AI via ghost-inference edge function
      const { data, error } = await supabase.functions.invoke('ghost-inference', {
        body: {
          model: selectedModel,
          messages: messageHistory,
          stream: false,
          temperature: 0.7,
          max_tokens: 4096
        }
      });

      if (error) {
        throw new Error(error.message || 'Inference failed');
      }

      if (data.error) {
        if (data.error === 'Insufficient ghost credits') {
          toast({
            title: 'Insufficient Credits',
            description: `You need at least ${data.required} ghost tokens. Current balance: ${data.balance}`,
            variant: 'destructive',
          });
          setIsGenerating(false);
          return;
        }
        throw new Error(data.error);
      }

      // Extract response content
      const responseContent = data.choices?.[0]?.message?.content || 'No response generated';
      
      const assistantMessage: GhostMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
      };

      saveMessage(selectedConversation, 'assistant', assistantMessage.content);
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('[Ghost Chat] Inference error:', error);
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to generate response',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
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
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <p className="text-muted-foreground">Please log in to use Ghost Chat</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900">
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
          'flex flex-col border-r border-purple-500/20 bg-slate-900/80 backdrop-blur-sm transition-all duration-300',
          sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-purple-500/20">
          <div className="flex items-center gap-3 mb-4">
            <img src={ghostIcon} alt="Ghost" className="w-8 h-8 rounded-lg" />
            <h2 className="text-lg font-semibold text-white">Ghost Sessions</h2>
          </div>
          <Button
            onClick={handleNewSession}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Ghost Session
          </Button>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={cn(
                  'group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors',
                  selectedConversation === conv.id
                    ? 'bg-purple-600/30 border border-purple-500/50'
                    : 'hover:bg-purple-500/10'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {conv.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(conv.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(conv.id);
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConversationToDelete(conv.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No sessions yet. Create one to start.
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-purple-500/20 space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            onClick={handleExportAll}
            disabled={conversations.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-white"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            
            <div className="flex items-center gap-2">
              <img src={ghostIcon} alt="Ghost" className="w-6 h-6 rounded" />
              <span className="font-semibold text-white">Ghost Mode</span>
            </div>

            {/* Local Only Indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs">
                LOCAL ONLY
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Credits Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <Coins className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">
                {formattedBalance} tokens
              </span>
            </div>

            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => setShowBuyCredits(true)}
            >
              Buy Credits
            </Button>

            <GhostModeToggle currentMode="ghost" />
          </div>
        </div>

        {/* Ghost Mode Banner */}
        <div className="px-4 py-2 bg-purple-900/30 border-b border-purple-500/20 text-center">
          <p className="text-sm text-purple-300">
            <span className="font-semibold">🔒 Ghost Mode Active</span> — Nothing stored on SwissVault servers
          </p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          {selectedConversation ? (
            <ScrollArea className="h-full">
              <div className="max-w-4xl mx-auto p-6 space-y-6">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-4',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-3',
                        message.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800/80 border border-purple-500/20 text-slate-100'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-50 mt-2">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                      {message.role === 'assistant' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs text-purple-400 hover:text-purple-300 -ml-2"
                          onClick={() => {
                            // TODO: Implement regenerate
                            toast({ title: 'Regenerate', description: 'Coming soon' });
                          }}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Regenerate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {isGenerating && (
                  <div className="flex gap-4 justify-start">
                    <div className="bg-slate-800/80 border border-purple-500/20 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <img src={ghostIcon} alt="Ghost" className="w-24 h-24 mb-6 opacity-50" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Welcome to Ghost Mode
              </h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Your conversations are stored locally and never touch SwissVault servers.
                Select a session or create a new one to get started.
              </p>
              <Button
                onClick={handleNewSession}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Start New Session
              </Button>
            </div>
          )}
        </div>

        {/* Input Area */}
        {selectedConversation && (
          <div className="p-4 border-t border-purple-500/20 bg-slate-900/60">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-3">
                {/* Model Selector */}
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-48 bg-slate-800/50 border-purple-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-purple-500/30">
                    {SWISS_MODELS.map(model => (
                      <SelectItem key={model.id} value={model.id} className="text-white">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                            {model.provider}
                          </Badge>
                          {model.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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
                    className="min-h-[52px] max-h-32 resize-none bg-slate-800/50 border-purple-500/30 text-white placeholder:text-muted-foreground pr-12"
                    disabled={isGenerating}
                  />
                </div>

                {/* Send Button */}
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isGenerating}
                  className="bg-purple-600 hover:bg-purple-700 text-white h-[52px] px-6"
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
        <AlertDialogContent className="bg-slate-900 border-purple-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Switch to VaultChat?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Switching to VaultChat will store conversations on SwissVault servers (encrypted). 
              Your Ghost Mode sessions will remain stored locally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-purple-500/30 text-white hover:bg-purple-500/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSwitch}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!conversationToDelete} onOpenChange={() => setConversationToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-purple-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete this Ghost session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-purple-500/30 text-white hover:bg-purple-500/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => conversationToDelete && handleDelete(conversationToDelete)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Buy Credits Modal */}
      <BuyGhostCreditsModal open={showBuyCredits} onOpenChange={setShowBuyCredits} />
    </div>
  );
}
