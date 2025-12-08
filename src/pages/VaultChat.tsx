import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { chatEncryption } from '@/lib/encryption';
import { useToast } from '@/hooks/use-toast';
import { useRAGContext } from '@/hooks/useRAGContext';
import { MessageBubble } from '@/components/vault-chat/MessageBubble';
import { EncryptionStatus } from '@/components/vault/EncryptionStatus';
import { EncryptingOverlay } from '@/components/vault-chat/EncryptingOverlay';
import { ChatSettingsModal } from '@/components/vault-chat/ChatSettingsModal';
import { ChatInput, ChatContext } from '@/components/vault-chat/ChatInput';
import { DeleteConversationDialog } from '@/components/vault-chat/DeleteConversationDialog';
import {
  Plus,
  Search,
  Lock,
  Settings,
  Menu,
  X,
  Loader2,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Matches encrypted_conversations table schema
interface Conversation {
  id: string;
  user_id: string;
  encrypted_title: string | null;
  title_nonce: string;
  model_id: string;
  key_hash: string;
  is_encrypted: boolean;
  zero_retention: boolean;
  retention_mode: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// Matches encrypted_messages table schema
interface Message {
  id: string;
  conversation_id: string;
  ciphertext: string;
  nonce: string;
  role: string;
  sequence_number: number;
  token_count: number | null;
  has_attachments: boolean;
  created_at: string;
  expires_at: string | null;
}

// Decrypted message for display
interface DecryptedMessage extends Message {
  content: string;
  decrypted: boolean;
}

const VaultChat = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  const [zeroRetention, setZeroRetention] = useState(false);
  const [integrations, setIntegrations] = useState([
    { type: 'slack', isConnected: false, isActive: false },
    { type: 'notion', isConnected: false, isActive: false },
    { type: 'gmail', isConnected: false, isActive: false },
    { type: 'github', isConnected: false, isActive: false },
    { type: 'docs', isConnected: false, isActive: false },
    { type: 'asana', isConnected: false, isActive: false },
    { type: 'figma', isConnected: false, isActive: false },
    { type: 'azure', isConnected: false, isActive: false },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // RAG Context - pass selectedConversation to connect document uploads
  const {
    uploadedDocuments,
    isUploading: isUploadingDocument,
    uploadDocument,
    searchContext,
    getContextPrompt,
    clearContext,
    hasContext,
    contextEnabled,
    setContextEnabled,
  } = useRAGContext(selectedConversation);

  // Load integrations from database
  useEffect(() => {
    const loadIntegrations = async () => {
      if (!user) return;
      
      const { data: dbIntegrations } = await supabase
        .from('chat_integrations')
        .select('integration_type, is_active')
        .eq('user_id', user.id);
      
      if (dbIntegrations) {
        setIntegrations(prev => prev.map(int => {
          const dbInt = dbIntegrations.find(d => d.integration_type === int.type);
          return dbInt 
            ? { ...int, isConnected: true, isActive: dbInt.is_active }
            : int;
        }));
      }
    };
    
    loadIntegrations();
  }, [user]);

  // Integration handlers
  const handleToggleIntegration = useCallback(async (type: string) => {
    setIntegrations(prev => prev.map(int => 
      int.type === type ? { ...int, isActive: !int.isActive } : int
    ));
    
    if (user) {
      const integration = integrations.find(i => i.type === type);
      if (integration?.isConnected) {
        await supabase
          .from('chat_integrations')
          .update({ is_active: !integration.isActive })
          .eq('user_id', user.id)
          .eq('integration_type', type);
      }
    }
  }, [integrations, user]);

  const handleConnectIntegration = useCallback((type: string) => {
    window.location.href = `/dashboard/integrations?connect=${type}`;
  }, []);

  const handleFileUpload = useCallback((files: FileList) => {
    Array.from(files).forEach(file => {
      uploadDocument(file);
    });
  }, [uploadDocument]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Get display title (decrypt if needed, or use placeholder)
  const getDisplayTitle = (conv: Conversation): string => {
    // For now, just return a readable title based on creation
    // TODO: Implement title decryption
    return conv.encrypted_title ? 'Encrypted Conversation' : 'New Conversation';
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    setMessages([]);

    try {
      // Try to get key from IndexedDB first, then restore from database
      let key = await chatEncryption.getKey(conversationId);
      
      if (!key) {
        console.log('[Vault Chat] Key not in IndexedDB, trying database...');
        key = await chatEncryption.restoreKey(conversationId);
      }
      
      if (!key) {
        console.error('[Vault Chat] Encryption key not found anywhere');
        toast({
          title: 'Encryption Error',
          description: 'Could not find encryption key for this conversation',
          variant: 'destructive'
        });
        return;
      }

      // Load from encrypted_messages table (CORRECT TABLE)
      const { data, error } = await supabase
        .from('encrypted_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sequence_number', { ascending: true });

      if (error) throw error;
      
      const messageData = (data || []) as Message[];

      // Decrypt messages
      const decrypted: DecryptedMessage[] = await Promise.all(
        messageData.map(async (msg) => {
          try {
            // Reconstruct the encrypted format: nonce + ciphertext
            const content = await chatEncryption.decryptMessage(
              msg.ciphertext,
              key
            );
            return { ...msg, content, decrypted: true };
          } catch (error) {
            console.error(`[Vault Chat] Decryption failed for message ${msg.id}:`, error);
            return { ...msg, content: '[Decryption failed]', decrypted: false };
          }
        })
      );
      
      setMessages(decrypted);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('[Vault Chat] Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive'
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    } else {
      setMessages([]);
    }
  }, [selectedConversation]);

  useEffect(() => {
    loadConversations();
    const unsubscribe = subscribeToConversations();
    return () => {
      unsubscribe();
    };
  }, []);

  const loadConversations = async () => {
    try {
      // Load from encrypted_conversations table (CORRECT TABLE)
      const { data, error } = await supabase
        .from('encrypted_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversations((data || []) as Conversation[]);
      setLoading(false);
    } catch (error) {
      console.error('[Vault Chat] Error loading conversations:', error);
      setLoading(false);
    }
  };

  const subscribeToConversations = () => {
    const channel = supabase
      .channel('encrypted_conversations_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'encrypted_conversations'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setConversations(prev => [payload.new as Conversation, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setConversations(prev => prev.map(conv =>
            conv.id === (payload.new as Conversation).id ? payload.new as Conversation : conv
          ));
        } else if (payload.eventType === 'DELETE') {
          setConversations(prev => prev.filter(conv => conv.id !== (payload.old as Conversation).id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createNewConversation = async () => {
    if (creating) return;
    setCreating(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');

      // Generate temporary ID for encryption key
      const tempId = crypto.randomUUID();
      
      // Initialize encryption and get key hash
      const { keyHash } = await chatEncryption.initializeConversation(tempId);

      // Create a simple nonce for the title (we'll encrypt titles properly later)
      const titleNonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))));

      // Create conversation in encrypted_conversations table (CORRECT TABLE)
      const { data, error } = await supabase
        .from('encrypted_conversations')
        .insert({
          user_id: currentUser.id,
          encrypted_title: null, // Will be set when user sends first message
          title_nonce: titleNonce,
          model_id: selectedModel,
          key_hash: keyHash,
          is_encrypted: true,
          zero_retention: zeroRetention,
          retention_mode: zeroRetention ? 'zerotrace' : 'forever'
        })
        .select()
        .single();

      if (error) throw error;

      const convData = data as Conversation;

      // Update encryption key storage with real conversation ID
      const keyData = await chatEncryption.getKey(tempId);
      if (keyData) {
        await chatEncryption.storeKey(convData.id, keyData);
        await chatEncryption.deleteKey(tempId);
        
        // Update database key record with real conversation ID
        await supabase
          .from('conversation_keys')
          .update({ conversation_id: convData.id })
          .eq('conversation_id', tempId)
          .eq('user_id', currentUser.id);
      }

      // Select the new conversation
      setSelectedConversation(convData.id);
      setChatSidebarOpen(false);

      console.log('[Vault Chat] ✅ Created encrypted conversation:', convData.id);
    } catch (error) {
      console.error('[Vault Chat] ❌ Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create conversation. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async (messageContent: string, context?: ChatContext) => {
    if (!selectedConversation) return;
    
    // Use model and retention from context DIRECTLY to avoid stale state bug
    const modelToUse = context?.model || selectedModel;
    const retentionToUse = context?.retentionMode || 'forever';
    
    // Update state for UI display
    if (context?.model) {
      setSelectedModel(context.model);
    }

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');

      // Get encryption key
      let key = await chatEncryption.getKey(selectedConversation);
      if (!key) {
        key = await chatEncryption.restoreKey(selectedConversation);
      }
      if (!key) throw new Error('Encryption key not found');

      // Start encryption animation
      setIsEncrypting(true);
      const encryptionStart = Date.now();

      // Get RAG context if enabled
      let ragContext: string | undefined;
      
      if ((hasContext || integrations.some(i => i.isActive)) && contextEnabled) {
        console.log('[Vault Chat] 🔍 Searching for relevant context...');
        const relevantChunks = await searchContext(messageContent, 5);
        
        if (relevantChunks.length > 0) {
          ragContext = getContextPrompt(relevantChunks);
          console.log(`[Vault Chat] 📚 Found ${relevantChunks.length} relevant chunks`);
        }
      }

      // Encrypt user message
      const encryptedUserMessage = await chatEncryption.encryptMessage(messageContent, key);

      // Ensure minimum encryption display time
      const elapsed = Date.now() - encryptionStart;
      if (elapsed < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
      }
      setIsEncrypting(false);

      // Get next sequence number
      const nextSequence = messages.length + 1;

      // Insert user message into encrypted_messages table (CORRECT TABLE)
      const { data: userMessage, error: userError } = await supabase
        .from('encrypted_messages')
        .insert({
          conversation_id: selectedConversation,
          role: 'user',
          ciphertext: encryptedUserMessage,
          nonce: '', // Nonce is embedded in ciphertext for our format
          sequence_number: nextSequence,
          token_count: Math.ceil(messageContent.length / 4),
          has_attachments: false
        })
        .select()
        .single();

      if (userError) throw userError;

      // Add to UI immediately
      const userMsgData: DecryptedMessage = {
        ...(userMessage as Message),
        content: messageContent,
        decrypted: true
      };
      setMessages(prev => [...prev, userMsgData]);
      setTimeout(scrollToBottom, 100);

      // Generate AI response
      setIsGenerating(true);

      // Build message history
      const messageHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      messageHistory.push({
        role: 'user',
        content: messageContent
      });

      // Call chat completions with RAG context and correct model
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: messageHistory,
            max_tokens: 2048,
            temperature: 0.7,
            rag_context: ragContext,
            zero_retention: retentionToUse === 'zerotrace',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[Vault Chat] API error:', errorData);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices[0].message.content;

      // Encrypt assistant message
      const encryptedAssistantMessage = await chatEncryption.encryptMessage(assistantContent, key);

      // Insert assistant message
      const { data: assistantMessage, error: assistantError } = await supabase
        .from('encrypted_messages')
        .insert({
          conversation_id: selectedConversation,
          role: 'assistant',
          ciphertext: encryptedAssistantMessage,
          nonce: '',
          sequence_number: nextSequence + 1,
          token_count: data.usage?.completion_tokens,
          has_attachments: false
        })
        .select()
        .single();

      if (assistantError) throw assistantError;

      // Add to UI
      const assistantMsgData: DecryptedMessage = {
        ...(assistantMessage as Message),
        content: assistantContent,
        decrypted: true
      };
      setMessages(prev => [...prev, assistantMsgData]);

      // Update conversation's last_message_at
      await supabase
        .from('encrypted_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation);

      setTimeout(scrollToBottom, 100);

      console.log('[Vault Chat] ✅ Message sent and AI responded');
    } catch (error) {
      console.error('[Vault Chat] ❌ Send failed:', error);
      setIsEncrypting(false);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;

    try {
      // Delete conversation (will cascade to messages via FK)
      const { error } = await supabase
        .from('encrypted_conversations')
        .delete()
        .eq('id', conversationToDelete);

      if (error) throw error;

      // Delete encryption key
      await chatEncryption.deleteKey(conversationToDelete);

      // Also delete from conversation_keys table
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase
          .from('conversation_keys')
          .delete()
          .eq('conversation_id', conversationToDelete)
          .eq('user_id', currentUser.id);
      }

      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== conversationToDelete));

      // Clear selection if deleted conversation was selected
      if (selectedConversation === conversationToDelete) {
        setSelectedConversation(null);
        setMessages([]);
      }

      toast({
        title: 'Deleted',
        description: 'Conversation deleted successfully',
      });

      console.log('[Vault Chat] ✅ Conversation deleted');
    } catch (error) {
      console.error('[Vault Chat] ❌ Delete failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    } finally {
      setConversationToDelete(null);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const title = getDisplayTitle(conv);
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const currentConversation = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-[280px]'}`}>
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
        
        <main className="h-[calc(100vh-4rem)]">
          <div className="flex h-full">
            {/* Mobile Overlay */}
            {chatSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={() => setChatSidebarOpen(false)}
              />
            )}

            {/* Chat Sidebar */}
            <div
              className={cn(
                "w-80 border-r border-border",
                "bg-card flex flex-col",
                "fixed md:relative z-50 h-[calc(100vh-4rem)]",
                "transition-transform duration-200",
                chatSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
              )}
            >
              {/* Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <Lock className="h-5 w-5 text-primary" />
                    Vault Chat
                  </h1>
                  <button
                    onClick={() => setChatSidebarOpen(false)}
                    className="md:hidden p-2 hover:bg-accent rounded"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <Button 
                  onClick={createNewConversation} 
                  className="w-full" 
                  size="lg"
                  disabled={creating}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {creating ? 'Creating...' : 'New Chat'}
                </Button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Conversation List */}
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading...</div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredConversations.map(conv => (
                      <div
                        key={conv.id}
                        className={cn(
                          "p-4 cursor-pointer hover:bg-accent/50",
                          "transition-colors group relative",
                          selectedConversation === conv.id && 
                            "bg-primary/10 border-l-4 border-primary"
                        )}
                      >
                        <div
                          onClick={() => {
                            setSelectedConversation(conv.id);
                            setChatSidebarOpen(false);
                          }}
                        >
                          <h3 className="font-medium text-sm truncate text-foreground pr-8">
                            {getDisplayTitle(conv)}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {conv.model_id.split('-')[0]}
                            </span>
                            {conv.is_encrypted && (
                              <Lock className="h-3 w-3 text-green-500" />
                            )}
                            {conv.zero_retention && (
                              <span className="text-xs text-amber-500">Zero Retention</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {conv.retention_mode}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {conv.last_message_at ? 'Recently' : 'New'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConversationToDelete(conv.id);
                            setDeleteDialogOpen(true);
                          }}
                          className={cn(
                            "absolute top-2 right-2 p-2 rounded",
                            "bg-destructive/10 hover:bg-destructive/20 text-destructive",
                            "opacity-0 group-hover:opacity-100 transition-opacity"
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Footer */}
              <div className="p-4 border-t border-border">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start" 
                  size="sm"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Chat Settings
                </Button>
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
              {/* Mobile Header */}
              <div className="md:hidden border-b border-border p-4 bg-card">
                <button
                  onClick={() => setChatSidebarOpen(true)}
                  className="p-2 hover:bg-accent rounded"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              {selectedConversation ? (
                <div className="flex-1 flex flex-col">
                  {/* Chat Header with Encryption Status */}
                  <div className="hidden md:flex items-center justify-between px-6 py-3 border-b border-border bg-card">
                    <h2 className="font-medium text-foreground truncate">
                      {currentConversation ? getDisplayTitle(currentConversation) : 'Conversation'}
                    </h2>
                    <EncryptionStatus
                      conversationId={selectedConversation}
                      isEncrypted={currentConversation?.is_encrypted ?? true}
                      keyHash={currentConversation?.key_hash}
                      onExportKey={() => {
                        toast({
                          title: 'Export Key',
                          description: 'Key export functionality coming soon',
                        });
                      }}
                    />
                  </div>
                  
                  {/* Message List */}
                  <ScrollArea className="flex-1 p-6">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Lock className="h-5 w-5 animate-pulse" />
                          <span>Decrypting messages...</span>
                        </div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full min-h-[300px]">
                        <div className="text-center">
                          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">Send your first encrypted message</p>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-4xl mx-auto">
                        {messages.map((message) => (
                          <MessageBubble
                            key={message.id}
                            role={message.role as 'user' | 'assistant' | 'system'}
                            content={message.content}
                            isDecrypting={!message.decrypted}
                            decryptionError={message.content === '[Decryption failed]'}
                            timestamp={message.created_at}
                          />
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* AI Generating Indicator */}
                  {isGenerating && (
                    <div className="px-6 py-2 bg-primary/5 border-t border-primary/20">
                      <div className="flex items-center gap-2 text-primary max-w-4xl mx-auto">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">AI is responding...</span>
                      </div>
                    </div>
                  )}

                  {/* Encrypting Overlay */}
                  <EncryptingOverlay visible={isEncrypting} />

                  {/* Message Input */}
                  <div className="border-t border-border p-4 bg-card">
                    <div className="max-w-4xl mx-auto">
                      <ChatInput
                        onSend={handleSendMessage}
                        disabled={!selectedConversation || loadingMessages}
                        isEncrypting={isEncrypting}
                        isSending={isGenerating}
                        integrations={integrations}
                        documents={uploadedDocuments}
                        onFileUpload={handleFileUpload}
                        onToggleIntegration={handleToggleIntegration}
                        onConnectIntegration={handleConnectIntegration}
                      />
                      {hasContext && (
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>{uploadedDocuments.length} document(s) in context</span>
                          <button 
                            onClick={clearContext}
                            className="text-destructive hover:underline"
                          >
                            Clear context
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center max-w-2xl">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <Lock className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-foreground">Start a Secure Conversation</h2>
                    <p className="text-muted-foreground mb-6">
                      Your conversations are end-to-end encrypted and never leave your device unencrypted.
                    </p>
                    <Button onClick={createNewConversation} size="lg" disabled={creating}>
                      <Plus className="h-5 w-5 mr-2" />
                      {creating ? 'Creating...' : 'New Encrypted Chat'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <DeleteConversationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConversation}
        conversationTitle={
          conversationToDelete 
            ? getDisplayTitle(conversations.find(c => c.id === conversationToDelete)!)
            : 'Conversation'
        }
      />

      <ChatSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        conversationId={selectedConversation}
        currentModel={selectedModel}
        onModelChange={setSelectedModel}
        zeroRetention={zeroRetention}
        onZeroRetentionChange={setZeroRetention}
      />
    </div>
  );
};

export default VaultChat;
