import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, Search, Image, Settings, Plus, 
  ChevronDown, Globe, Paperclip, Mic, Send, 
  Sparkles, Code, FileText, TrendingUp, HelpCircle,
  Lock, User, LogOut, CreditCard, Library, Clock,
  Check, X, Menu, ChevronRight, ExternalLink,
  Bot, Zap, Eye, MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useGhostStorage } from '@/hooks/useGhostStorage';
import { useGhostInference } from '@/hooks/useGhostInference';
import { useGhostUsage } from '@/hooks/useGhostUsage';
import { useGhostSettings } from '@/hooks/useGhostSettings';
import { useToast } from '@/hooks/use-toast';
import { TEXT_MODELS, IMAGE_MODELS, isVisionModel, type GhostModel } from '@/lib/ghost-models';
import { GhostUpgradeModal } from '@/components/ghost/GhostUpgradeModal';
import { GhostErrorBoundary } from '@/components/ghost/GhostErrorBoundary';
import { GhostMessage } from '@/components/ghost/GhostMessage';
import ReactMarkdown from 'react-markdown';

// Swiss models (free tier)
const SWISS_MODEL_IDS = ['swissvault-1.0', 'swissvault-fast', 'swissvault-code', 'llama3.1-8b', 'mistral-7b'];

// Models for the picker - simplified list
const QUICK_MODELS = [
  { id: 'auto', name: 'Best', description: 'Auto-select best model', icon: Sparkles, isPro: false },
  { id: 'swissvault-1.0', name: 'SwissVault', description: 'Swiss-hosted, private', icon: Lock, isPro: false },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI flagship', icon: null, isPro: true },
  { id: 'claude-sonnet-4.5', name: 'Claude 4.5', description: 'Anthropic latest', icon: null, isPro: true },
  { id: 'gemini-3-pro', name: 'Gemini 3', description: 'Google latest', icon: null, isPro: true },
  { id: 'grok-4.1', name: 'Grok 4.1', description: 'xAI latest', icon: null, isPro: true, badge: 'new' },
];

// Quick action chips
const QUICK_ACTIONS = [
  { id: 'local', label: 'Local', icon: Globe },
  { id: 'troubleshoot', label: 'Troubleshoot', icon: HelpCircle },
  { id: 'compare', label: 'Compare', icon: TrendingUp },
  { id: 'recommend', label: 'Recommend', icon: Sparkles },
  { id: 'code', label: 'Code', icon: Code },
];

// Suggested queries
const SUGGESTIONS = [
  "What are some good local restaurants for me to try?",
  "What are some good goals for me to set this year?",
];

interface GhostMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

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
  const [searchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // State
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('auto');
  const [messages, setMessages] = useState<GhostMessageData[]>([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'prompts' | 'images' | 'videos' | 'files' | 'searches' | 'model'>('prompts');
  
  // Hooks
  const { 
    conversations, 
    isInitialized, 
    createConversation, 
    saveMessage, 
    getConversation,
    deleteConversation 
  } = useGhostStorage();
  
  const { 
    streamResponse, 
    cancelStream, 
    isStreaming,
    lastResponseTime,
    lastTokenCount 
  } = useGhostInference();
  
  const { 
    tier, 
    isPro, 
    remaining, 
    limits, 
    canUse, 
    useFeature,
    resetTime 
  } = useGhostUsage();
  
  const { settings } = useGhostSettings();
  
  // Anonymous usage tracking (localStorage for non-authenticated users)
  const [anonymousUsage, setAnonymousUsage] = useState(() => {
    if (user) return null;
    const stored = localStorage.getItem('ghost_anon_usage');
    if (stored) {
      const data = JSON.parse(stored);
      const today = new Date().toISOString().split('T')[0];
      if (data.date === today) return data;
    }
    return { date: new Date().toISOString().split('T')[0], prompts: 0, limit: 10 };
  });
  
  const promptsRemaining = useMemo(() => {
    if (user) {
      return remaining.prompts === Infinity ? '∞' : remaining.prompts;
    }
    return (anonymousUsage?.limit || 10) - (anonymousUsage?.prompts || 0);
  }, [user, remaining.prompts, anonymousUsage]);
  
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
  
  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    
    // Check anonymous limit
    if (!user && anonymousUsage) {
      if (anonymousUsage.prompts >= anonymousUsage.limit) {
        setUpgradeReason('prompts');
        setShowUpgradeModal(true);
        return;
      }
      // Update anonymous usage
      const updated = { ...anonymousUsage, prompts: anonymousUsage.prompts + 1 };
      setAnonymousUsage(updated);
      localStorage.setItem('ghost_anon_usage', JSON.stringify(updated));
    } else if (user) {
      // Check usage limits for authenticated users
      if (!canUse.prompt) {
        setUpgradeReason('prompts');
        setShowUpgradeModal(true);
        return;
      }
      const allowed = await useFeature('prompt');
      if (!allowed.allowed) {
        setUpgradeReason('prompts');
        setShowUpgradeModal(true);
        return;
      }
    }
    
    const userMessage = input.trim();
    setInput('');
    
    // Create conversation if none selected
    let convId = selectedConversation;
    if (!convId && user) {
      convId = createConversation('New Chat');
      if (convId) {
        setSelectedConversation(convId);
      }
    }
    
    // Add user message
    const userMsgData: GhostMessageData = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsgData]);
    
    // Save if authenticated
    if (convId) {
      saveMessage(convId, 'user', userMessage);
    }
    
    // Create assistant placeholder
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }]);
    
    // Build message history
    const messageHistory = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    messageHistory.push({ role: 'user', content: userMessage });
    
    // Determine actual model to use
    const modelToUse = selectedModel === 'auto' ? 'swissvault-1.0' : selectedModel;
    
    // Stream response
    try {
      let fullContent = '';
      await streamResponse(
        messageHistory,
        modelToUse,
        {
          onToken: (chunk) => {
            fullContent += chunk;
            setMessages(prev => prev.map(m => 
              m.id === assistantId 
                ? { ...m, content: fullContent }
                : m
            ));
          },
          onComplete: (response) => {
            // Mark as done streaming
            setMessages(prev => prev.map(m => 
              m.id === assistantId 
                ? { ...m, isStreaming: false }
                : m
            ));
            // Save assistant message
            if (convId) {
              saveMessage(convId, 'assistant', response);
            }
          },
          onError: (error) => {
            console.error('Stream error:', error);
            setMessages(prev => prev.map(m => 
              m.id === assistantId 
                ? { ...m, content: 'Sorry, an error occurred. Please try again.', isStreaming: false }
                : m
            ));
          },
        },
        {
          temperature: settings?.default_temperature || 0.7,
          systemPrompt: settings?.system_prompt,
        }
      );
    } catch (error) {
      // Error already handled in onError callback
      console.error('Unexpected stream error:', error);
    }
  }, [input, isStreaming, user, anonymousUsage, canUse.prompt, selectedConversation, messages, selectedModel, settings, streamResponse, createConversation, saveMessage, useFeature]);
  
  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Handle model selection
  const handleModelSelect = (modelId: string) => {
    const model = QUICK_MODELS.find(m => m.id === modelId);
    if (model?.isPro && !user) {
      navigate('/auth/ghost-signup?plan=ghost_pro');
      return;
    }
    if (model?.isPro && !isPro) {
      setUpgradeReason('model');
      setShowUpgradeModal(true);
      return;
    }
    setSelectedModel(modelId);
  };
  
  // New chat
  const handleNewChat = () => {
    setSelectedConversation(null);
    setMessages([]);
    setInput('');
  };
  
  const isEmptyState = messages.length === 0;
  const selectedModelData = QUICK_MODELS.find(m => m.id === selectedModel) || QUICK_MODELS[0];
  
  return (
    <div className="min-h-screen bg-background flex">
      {/* Minimal Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col py-4 z-50 transition-all duration-200",
          sidebarExpanded ? "w-56" : "w-16"
        )}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          {sidebarExpanded && (
            <span className="font-semibold text-foreground whitespace-nowrap">Ghost</span>
          )}
        </div>
        
        {/* New Chat */}
        <Button 
          variant="ghost" 
          size={sidebarExpanded ? "sm" : "icon"}
          className={cn("mx-2 mb-2", sidebarExpanded && "justify-start")}
          onClick={handleNewChat}
        >
          <Plus className="w-4 h-4" />
          {sidebarExpanded && <span className="ml-2">New Chat</span>}
        </Button>
        
        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-1">
          <SidebarItem icon={Library} label="Library" expanded={sidebarExpanded} onClick={() => navigate('/ghost/library')} />
          <SidebarItem icon={Search} label="Discover" expanded={sidebarExpanded} />
          <SidebarItem icon={MessageSquare} label="Spaces" expanded={sidebarExpanded} active />
          <SidebarItem icon={TrendingUp} label="Finance" expanded={sidebarExpanded} />
          <SidebarItem icon={MoreHorizontal} label="More" expanded={sidebarExpanded} />
        </nav>
        
        {/* Bottom */}
        <div className="px-2 space-y-1 mt-auto">
          {!user ? (
            <>
              <Button
                variant="ghost"
                size={sidebarExpanded ? "sm" : "icon"}
                className={cn(sidebarExpanded && "w-full justify-start")}
                onClick={() => navigate('/auth?mode=login')}
              >
                <User className="w-4 h-4" />
                {sidebarExpanded && <span className="ml-2">Sign In</span>}
              </Button>
              <Button
                variant="default"
                size={sidebarExpanded ? "sm" : "icon"}
                className={cn(sidebarExpanded && "w-full justify-start")}
                onClick={() => navigate('/auth/ghost-signup')}
              >
                <Zap className="w-4 h-4" />
                {sidebarExpanded && <span className="ml-2">Sign Up Free</span>}
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size={sidebarExpanded ? "sm" : "icon"}
                  className={cn(sidebarExpanded && "w-full justify-start")}
                >
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  {sidebarExpanded && (
                    <span className="ml-2 truncate max-w-[120px]">{user.email}</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setShowUpgradeModal(true)}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Upgrade
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Upgrade button with dot */}
          <Button
            variant="ghost"
            size={sidebarExpanded ? "sm" : "icon"}
            className={cn("relative", sidebarExpanded && "w-full justify-start")}
            onClick={() => setShowUpgradeModal(true)}
          >
            <ExternalLink className="w-4 h-4" />
            {sidebarExpanded && <span className="ml-2">Upgrade</span>}
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
          </Button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className={cn("flex-1 flex flex-col transition-all duration-200", sidebarExpanded ? "ml-56" : "ml-16")}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {!user && (
              <span className="text-sm text-muted-foreground">
                {promptsRemaining} prompts remaining
              </span>
            )}
          </div>
          
          {/* Model Selector - Perplexity style */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                {selectedModelData.name}
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {QUICK_MODELS.map(model => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => handleModelSelect(model.id)}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium",
                        selectedModel === model.id && "text-primary"
                      )}>
                        {model.name}
                      </span>
                      {model.badge && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {model.badge}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{model.description}</span>
                  </div>
                  {selectedModel === model.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                  {model.isPro && !isPro && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-500">
                      PRO
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          {isEmptyState ? (
            /* Empty State - Perplexity Style */
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4">
              <h1 className="text-4xl font-semibold text-foreground mb-8">
                How can we help?
              </h1>
              
              {/* Input Card */}
              <div className="w-full max-w-2xl">
                <div className="border border-border rounded-2xl bg-card p-4 shadow-sm">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything. Type @ for mentions and / for shortcuts."
                    className="border-0 p-0 resize-none focus-visible:ring-0 text-base min-h-[60px] bg-transparent"
                    rows={2}
                  />
                  
                  {/* Input Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1">
                      {/* Mode toggles - Perplexity style */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn(
                          "h-8 px-3 rounded-full",
                          searchMode && "bg-primary/10 text-primary"
                        )}
                        onClick={() => setSearchMode(!searchMode)}
                      >
                        <Search className="w-3.5 h-3.5 mr-1" />
                        Search
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-3 rounded-full">
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        Focus
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Globe className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Image className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Paperclip className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Mic className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        className="h-8 w-8 bg-primary hover:bg-primary/90 rounded-full"
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Quick Actions - Perplexity style */}
                <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                  {QUICK_ACTIONS.map(action => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="rounded-full h-8 px-4 border-border"
                      onClick={() => setInput(`${action.label.toLowerCase()}: `)}
                    >
                      <action.icon className="w-3.5 h-3.5 mr-1.5" />
                      {action.label}
                    </Button>
                  ))}
                </div>
                
                {/* Suggestions */}
                <div className="mt-6 space-y-2">
                  {SUGGESTIONS.map((suggestion, i) => (
                    <button
                      key={i}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors text-sm text-muted-foreground flex items-center gap-3"
                      onClick={() => setInput(suggestion)}
                    >
                      <Search className="w-4 h-4 flex-shrink-0 text-muted-foreground/60" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto py-8 px-4">
              {messages.map((msg, i) => (
                <div key={msg.id} className={cn("mb-6", msg.role === 'user' ? 'text-right' : '')}>
                  <div className={cn(
                    "inline-block max-w-[85%] rounded-2xl px-4 py-3 text-left",
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content || '...'}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.isStreaming && (
                    <div className="mt-2 flex items-center gap-1 justify-start">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        {/* Bottom Input (when not empty state) */}
        {!isEmptyState && (
          <div className="border-t border-border p-4 bg-background">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2 border border-border rounded-2xl p-3 bg-card">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up..."
                  className="border-0 p-0 resize-none focus-visible:ring-0 min-h-[24px] max-h-[200px] bg-transparent"
                  rows={1}
                />
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    className="h-8 w-8 bg-primary hover:bg-primary/90 rounded-full"
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Upgrade Modal */}
      <GhostUpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitType={upgradeReason === 'prompts' ? 'prompt' : 
                   upgradeReason === 'images' ? 'image' :
                   upgradeReason === 'videos' ? 'video' : 'file'}
        currentTier={tier}
      />
    </div>
  );
}

// Sidebar Item Component
function SidebarItem({ 
  icon: Icon, 
  label, 
  expanded, 
  active,
  onClick
}: { 
  icon: any; 
  label: string; 
  expanded: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button 
      variant="ghost" 
      size={expanded ? "sm" : "icon"}
      className={cn(
        "w-full",
        expanded ? "justify-start" : "",
        active && "bg-muted"
      )}
      onClick={onClick}
    >
      <Icon className="w-4 h-4" />
      {expanded && <span className="ml-2">{label}</span>}
    </Button>
  );
}
