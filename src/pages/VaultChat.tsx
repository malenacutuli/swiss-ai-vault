import { useState, useEffect, useRef } from 'react';
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
import { MessageInput } from '@/components/vault-chat/MessageInput';
import { E2EEncryptedBadge } from '@/components/vault-chat/E2EEncryptedBadge';
import { EncryptingOverlay } from '@/components/vault-chat/EncryptingOverlay';
import { DocumentUpload } from '@/components/vault-chat/DocumentUpload';
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
import { DeleteConversationDialog } from '@/components/vault-chat/DeleteConversationDialog';

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  encrypted_content: string;
  token_count: number | null;
  model_used: string | null;
  finish_reason: string | null;
  credits_used: number | null;
  latency_ms: number | null;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  model_id: string;
  last_message_at: string | null;
  message_count: number;
  is_encrypted: boolean;
  is_shared: boolean;
  created_at: string;
}

const VaultChat = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // RAG Context for document uploads
  const {
    uploadedDocuments,
    isUploading: isUploadingDocument,
    uploadDocument,
    clearContext,
    hasContext,
  } = useRAGContext();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    setMessages([]);
    setDecryptedMessages(new Map());

    try {
      const { data, error } = await supabase
        .from('vault_chat_messages' as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const messageData = (data as unknown as Message[]) || [];
      setMessages(messageData);

      // Decrypt messages
      const key = await chatEncryption.getKey(conversationId);
      if (!key) {
        console.error('[Vault Chat] Encryption key not found for conversation');
        return;
      }

      const decrypted = new Map<string, string>();
      for (const message of messageData) {
        try {
          const content = await chatEncryption.decryptMessage(
            message.encrypted_content,
            key
          );
          decrypted.set(message.id, content);
        } catch (error) {
          console.error(`[Vault Chat] Decryption failed for message ${message.id}:`, error);
          decrypted.set(message.id, '[Decryption failed]');
        }
      }
      setDecryptedMessages(decrypted);
      
      // Scroll to bottom after messages load
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('[Vault Chat] Error loading messages:', error);
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
      setDecryptedMessages(new Map());
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
      const { data, error } = await supabase
        .from('vault_chat_conversations' as any)
        .select('*')
        .is('deleted_at', null)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversations((data as unknown as Conversation[]) || []);
      setLoading(false);
    } catch (error) {
      console.error('[Vault Chat] Error loading conversations:', error);
      setLoading(false);
    }
  };

  const subscribeToConversations = () => {
    const channel = supabase
      .channel('vault_chat_conversations_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vault_chat_conversations'
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate temporary ID for encryption key
      const tempId = crypto.randomUUID();
      
      // Initialize encryption and get key hash
      const { keyHash } = await chatEncryption.initializeConversation(tempId);

      // Create conversation in database
      const { data, error } = await supabase
        .from('vault_chat_conversations' as any)
        .insert({
          user_id: user.id,
          title: 'New Conversation',
          model_id: 'gpt-4o-mini',
          encryption_key_hash: keyHash,
          is_encrypted: true
        })
        .select()
        .single();

      if (error) throw error;

      // Update encryption key storage with real conversation ID
      const convData = data as unknown as Conversation;
      const keyData = await chatEncryption.getKey(tempId);
      if (keyData) {
        await chatEncryption.storeKey(convData.id, keyData);
        await chatEncryption.deleteKey(tempId);
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

  const handleSendMessage = async (messageContent: string) => {
    if (!selectedConversation) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get encryption key
      const key = await chatEncryption.getKey(selectedConversation);
      if (!key) throw new Error('Encryption key not found');

      // Get current conversation
      const conversation = conversations.find(c => c.id === selectedConversation);
      if (!conversation) throw new Error('Conversation not found');

      // Start encryption animation (minimum 500ms for perceived security)
      setIsEncrypting(true);
      const encryptionStart = Date.now();

      // Encrypt user message
      const encryptedUserMessage = await chatEncryption.encryptMessage(messageContent, key);

      // Ensure minimum encryption display time
      const elapsed = Date.now() - encryptionStart;
      if (elapsed < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
      }
      setIsEncrypting(false);

      // Insert user message
      const { data: userMessage, error: userError } = await supabase
        .from('vault_chat_messages' as any)
        .insert({
          conversation_id: selectedConversation,
          role: 'user',
          encrypted_content: encryptedUserMessage,
          token_count: Math.ceil(messageContent.length / 4)
        })
        .select()
        .single();

      if (userError) throw userError;

      // Add to UI immediately with decrypted content
      const userMsgData = userMessage as unknown as Message;
      setMessages(prev => [...prev, userMsgData]);
      setDecryptedMessages(prev => new Map(prev).set(userMsgData.id, messageContent));
      setTimeout(scrollToBottom, 100);

      // Generate AI response
      setIsGenerating(true);

      // Build message history (decrypt previous messages)
      const messageHistory = [];
      for (const msg of messages) {
        const content = decryptedMessages.get(msg.id);
        if (content && msg.role !== 'system') {
          messageHistory.push({
            role: msg.role,
            content: content
          });
        }
      }
      messageHistory.push({
        role: 'user',
        content: messageContent
      });

      // Call chat completions
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
            model: conversation.model_id,
            messages: messageHistory,
            max_tokens: 2048,
            temperature: 0.7,
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
        .from('vault_chat_messages' as any)
        .insert({
          conversation_id: selectedConversation,
          role: 'assistant',
          encrypted_content: encryptedAssistantMessage,
          token_count: data.usage?.completion_tokens,
          model_used: conversation.model_id,
          finish_reason: data.choices[0].finish_reason,
          latency_ms: data.latency_ms,
          credits_used: 0.001
        })
        .select()
        .single();

      if (assistantError) throw assistantError;

      // Add to UI
      const assistantMsgData = assistantMessage as unknown as Message;
      setMessages(prev => [...prev, assistantMsgData]);
      setDecryptedMessages(prev => new Map(prev).set(assistantMsgData.id, assistantContent));
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
      // Soft delete in database
      const { error } = await supabase
        .from('vault_chat_conversations' as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', conversationToDelete);

      if (error) throw error;

      // Delete encryption key
      await chatEncryption.deleteKey(conversationToDelete);

      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== conversationToDelete));

      // Clear selection if deleted conversation was selected
      if (selectedConversation === conversationToDelete) {
        setSelectedConversation(null);
        setMessages([]);
        setDecryptedMessages(new Map());
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

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                          <h3 className="font-medium text-sm truncate text-foreground pr-8">{conv.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {conv.model_id.split('-')[0]}
                            </span>
                            {conv.is_encrypted && (
                              <Lock className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {conv.message_count} messages
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {conv.last_message_at ? 'Recently' : 'New'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Delete button - appears on hover */}
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
                <Button variant="ghost" className="w-full justify-start" size="sm">
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
                  {/* Chat Header with E2E Badge */}
                  <div className="hidden md:flex items-center justify-between px-6 py-3 border-b border-border bg-card">
                    <h2 className="font-medium text-foreground truncate">
                      {conversations.find(c => c.id === selectedConversation)?.title || 'Conversation'}
                    </h2>
                    <E2EEncryptedBadge />
                  </div>
                  {/* Message List */}
                  <ScrollArea className="flex-1 p-6">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Lock className="h-5 w-5 animate-pulse" />
                          <span>Loading encrypted messages...</span>
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
                            role={message.role}
                            content={decryptedMessages.get(message.id) || ''}
                            isDecrypting={!decryptedMessages.has(message.id)}
                            decryptionError={decryptedMessages.get(message.id) === '[Decryption failed]'}
                            timestamp={message.created_at}
                            model={message.model_used || undefined}
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
                      <div className="flex items-end gap-2">
                        <DocumentUpload
                          onUpload={uploadDocument}
                          uploadedDocuments={uploadedDocuments}
                          isUploading={isUploadingDocument}
                          disabled={!selectedConversation || loadingMessages || isGenerating || isEncrypting}
                          userId={user?.id}
                          conversationId={selectedConversation}
                        />
                        <div className="flex-1">
                          <MessageInput
                            onSend={handleSendMessage}
                            disabled={!selectedConversation || loadingMessages || isGenerating || isEncrypting}
                            placeholder="Send an encrypted message..."
                          />
                        </div>
                      </div>
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
          conversations.find(c => c.id === conversationToDelete)?.title || 'Conversation'
        }
      />
    </div>
  );
};

export default VaultChat;
