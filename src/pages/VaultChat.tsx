import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { chatEncryption } from '@/lib/encryption';
import { useToast } from '@/hooks/use-toast';
import { useRAGContext } from '@/hooks/useRAGContext';
import { useStorageMode } from '@/hooks/useStorageMode';
import { MessageBubble } from '@/components/vault-chat/MessageBubble';
import { EncryptionStatus } from '@/components/vault/EncryptionStatus';
import { EncryptingOverlay } from '@/components/vault-chat/EncryptingOverlay';
import { ChatSettingsModal } from '@/components/vault-chat/ChatSettingsModal';
import { ChatInput, ChatContext } from '@/components/vault-chat/ChatInput';
import { DeleteConversationDialog } from '@/components/vault-chat/DeleteConversationDialog';
import { ImportChatDialog } from '@/components/vault-chat/ImportChatDialog';
import { ExportChatDialog } from '@/components/vault-chat/ExportChatDialog';
import { localChatStorage } from '@/lib/storage/local-chat-storage';
import { useExportReminder } from '@/hooks/useExportReminder';
import { toast } from 'sonner';
import {
  Plus,
  Lock,
  Settings,
  Loader2,
  Shield,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationListView } from '@/components/vault-chat/ConversationListView';

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
// Helper function to insert message with retry on sequence collision
async function insertMessageWithRetry(
  conversationId: string,
  role: 'user' | 'assistant',
  ciphertext: string,
  tokenCount?: number,
  maxRetries: number = 3
): Promise<{ data: any; error: any }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Get fresh sequence number from database
    const { data: seqNum } = await supabase.rpc('get_next_sequence_number', {
      p_conversation_id: conversationId
    });
    
    const { data, error } = await supabase
      .from('encrypted_messages')
      .insert({
        conversation_id: conversationId,
        role: role,
        ciphertext: ciphertext,
        nonce: '', // Nonce is embedded in ciphertext for our format
        sequence_number: seqNum || 1,
        token_count: tokenCount,
        has_attachments: false
      })
      .select()
      .single();
    
    // If success or error is not a duplicate key violation, return
    if (!error || error.code !== '23505') {
      return { data, error };
    }
    
    // If duplicate key, wait briefly and retry
    console.warn(`[Vault Chat] Sequence collision on attempt ${attempt + 1}, retrying...`);
    await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
  }
  
  return { data: null, error: { message: 'Failed after max retries due to sequence collisions' } };
}

const VaultChat = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [conversationToExport, setConversationToExport] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  const [zeroRetention, setZeroRetention] = useState(false);
  const [integrations, setIntegrations] = useState([
    { type: 'slack', isConnected: false, isActive: false },
    { type: 'notion', isConnected: false, isActive: false },
    { type: 'gmail', isConnected: false, isActive: false },
    { type: 'github', isConnected: false, isActive: false },
    { type: 'google_docs', isConnected: false, isActive: false },
    { type: 'asana', isConnected: false, isActive: false },
    { type: 'figma', isConnected: false, isActive: false },
    { type: 'azure_devops', isConnected: false, isActive: false },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Storage mode hook - routes to server or local based on zero_retention_mode
  const {
    isZeroTrace,
    isLoading: storageModeLoading,
    saveMessage,
    loadMessages: loadStorageMessages,
    loadConversations: loadStorageConversations,
    deleteConversation: deleteStorageConversation,
    getNextSequenceNumber,
    createConversation: createStorageConversation,
    updateConversationTitle,
  } = useStorageMode();
  
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

  // Export reminder for ZeroTrace chats
  const { recordExport } = useExportReminder({
    isZeroTrace,
    conversationId: selectedConversation,
    messageCount: messages.length,
    onExportRequest: (convId) => {
      setConversationToExport(convId);
      setExportDialogOpen(true);
    },
  });

  // searchParams for OAuth callback handling
  const [searchParams, setSearchParams] = useSearchParams();

  // Integration handlers
  const handleToggleIntegration = useCallback(async (type: string) => {
    if (!user) return;

    // Find current state
    const integration = integrations.find(i => i.type === type);
    if (!integration || !integration.isConnected) return;

    const newActiveState = !integration.isActive;

    // Update local state immediately (optimistic)
    setIntegrations(prev => prev.map(int => 
      int.type === type ? { ...int, isActive: newActiveState } : int
    ));

    try {
      // Persist to database
      const { error } = await supabase
        .from('chat_integrations')
        .update({ is_active: newActiveState })
        .eq('user_id', user.id)
        .eq('integration_type', type);

      if (error) throw error;

      toast({
        title: newActiveState ? 'Integration enabled' : 'Integration disabled',
        description: `${type} ${newActiveState ? 'will be' : 'will not be'} included in chat context`,
      });

    } catch (err) {
      // Revert on error
      setIntegrations(prev => prev.map(int => 
        int.type === type ? { ...int, isActive: !newActiveState } : int
      ));
      
      toast({
        title: 'Error',
        description: 'Failed to update integration',
        variant: 'destructive'
      });
    }
  }, [user, integrations, toast]);

  const [connectingIntegration, setConnectingIntegration] = useState<string | null>(null);

  // Fetch integrations from database and map to UI state
  const fetchIntegrations = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('chat_integrations')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching integrations:', error);
      return;
    }

    // Map database records to UI state
    setIntegrations(prev => prev.map(int => {
      const dbRecord = data?.find(d => d.integration_type === int.type);
      return {
        ...int,
        isConnected: !!dbRecord,
        isActive: dbRecord?.is_active ?? false,
        lastSynced: dbRecord?.last_synced_at
      };
    }));
  }, [user]);

  const handleConnectIntegration = useCallback(async (type: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to connect integrations',
        variant: 'destructive'
      });
      return;
    }

    setConnectingIntegration(type);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      // Check if integration is available
      const integrationDef = await import('@/hooks/useIntegrations').then(m => 
        m.INTEGRATION_DEFINITIONS.find(d => d.type === type)
      );
      
      if (integrationDef?.comingSoon) {
        toast({
          title: 'Coming Soon',
          description: `${integrationDef.name} integration is coming soon!`,
        });
        setConnectingIntegration(null);
        return;
      }

      // For Slack, use direct window redirect (avoids fetch cross-origin issues)
      if (type === 'slack') {
        window.location.href = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-oauth/authorize?token=${session.access_token}`;
        return;
      }

      // For other providers (Notion, Gmail, GitHub) - use body action pattern
      const { data, error } = await supabase.functions.invoke(`${type}-oauth`, {
        body: { action: 'authorize' }
      });

      if (error) {
        console.error(`OAuth error for ${type}:`, error);
        throw new Error(error.message || 'Failed to start OAuth');
      }
      
      if (!data?.url) {
        throw new Error('No authorization URL returned');
      }

      console.log(`[VaultChat] Redirecting to ${type} OAuth:`, data.url);
      window.location.href = data.url;

    } catch (err) {
      console.error(`Failed to connect ${type}:`, err);
      toast({
        title: 'Connection failed',
        description: (err as Error).message || `Could not connect to ${type}`,
        variant: 'destructive'
      });
      setConnectingIntegration(null);
    }
  }, [user, toast]);

  // Handle OAuth callback success/error from URL params
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success) {
      toast({
        title: 'Integration Connected!',
        description: `${success.charAt(0).toUpperCase() + success.slice(1)} has been connected successfully.`,
      });
      setSearchParams({});
      fetchIntegrations();
    } else if (error) {
      toast({
        title: 'Connection Failed',
        description: `Failed to connect: ${error.replace(/_/g, ' ')}`,
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast, fetchIntegrations]);

  // Load integrations from database on mount
  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleFileUpload = useCallback((files: FileList) => {
    Array.from(files).forEach(file => {
      uploadDocument(file);
    });
  }, [uploadDocument]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Cache for decrypted titles
  const [decryptedTitles, setDecryptedTitles] = useState<Record<string, string>>({});

  // Decrypt titles when conversations load
  useEffect(() => {
    const decryptTitles = async () => {
      const titles: Record<string, string> = {};
      
      for (const conv of conversations) {
        if (conv.encrypted_title) {
          try {
            let key = await chatEncryption.getKey(conv.id);
            if (!key) {
              key = await chatEncryption.restoreKey(conv.id);
            }
            if (key) {
              const decrypted = await chatEncryption.decryptMessage(conv.encrypted_title, key);
              titles[conv.id] = decrypted;
            } else {
              titles[conv.id] = 'Encrypted Conversation';
            }
          } catch (err) {
            console.error(`[Vault Chat] Failed to decrypt title for ${conv.id}:`, err);
            titles[conv.id] = 'Encrypted Conversation';
          }
        } else {
          titles[conv.id] = 'New Conversation';
        }
      }
      
      setDecryptedTitles(titles);
    };
    
    if (conversations.length > 0) {
      decryptTitles();
    }
  }, [conversations]);

  // Get display title from cache
  const getDisplayTitle = (conv: Conversation): string => {
    return decryptedTitles[conv.id] || (conv.encrypted_title ? 'Loading...' : 'New Conversation');
  };

  // Generate AI title for a conversation
  const generateConversationTitle = async (
    conversationId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> => {
    try {
      console.log('[Vault Chat] Generating title for conversation...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      
      // Call AI to generate a short title
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022', // Fast and cheap for title generation
            messages: [{
              role: 'user',
              content: `Generate a 3-6 word title summarizing this conversation. Reply with ONLY the title, no quotes, no explanation.

User: "${userMessage.substring(0, 200)}"
Assistant: "${assistantResponse.substring(0, 200)}"`
            }],
            max_tokens: 30,
            zero_retention: true // Don't log this meta-call
          }),
        }
      );
      
      if (!response.ok) {
        console.error('[Vault Chat] Title generation API error');
        return;
      }
      
      const data = await response.json();
      let title = data.choices?.[0]?.message?.content?.trim() || '';
      
      // Clean up title (remove quotes if present)
      title = title.replace(/^["']|["']$/g, '').trim();
      
      // Fallback if AI response is empty or too long
      if (!title || title.length > 60) {
        title = userMessage.substring(0, 50).split(' ').slice(0, -1).join(' ') + '...';
      }
      
      console.log('[Vault Chat] Generated title:', title);
      
      // Encrypt the title
      let key = await chatEncryption.getKey(conversationId);
      if (!key) {
        key = await chatEncryption.restoreKey(conversationId);
      }
      if (!key) {
        console.error('[Vault Chat] No key found for title encryption');
        return;
      }
      
      const encryptedTitle = await chatEncryption.encryptMessage(title, key);
      const titleNonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))));
      
      // Update the conversation with the new title
      await updateConversationTitle(conversationId, encryptedTitle, titleNonce);
      
      // Update local cache
      setDecryptedTitles(prev => ({ ...prev, [conversationId]: title }));
      
      // Also update the conversations list to reflect the change
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, encrypted_title: encryptedTitle, title_nonce: titleNonce }
          : conv
      ));
      
      console.log('[Vault Chat] ✅ Title saved');
    } catch (err) {
      console.error('[Vault Chat] Title generation failed:', err);
      // Non-critical, don't throw
    }
  };

  // Track if this is the first message in a conversation
  const isFirstExchange = useRef<boolean>(true);

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

      // Use storage mode hook to load messages (routes to server or local)
      const storageMessages = await loadStorageMessages(conversationId);
      
      const messageData: Message[] = storageMessages.map(msg => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        ciphertext: msg.ciphertext,
        nonce: msg.nonce,
        role: msg.role,
        sequence_number: msg.sequence_number,
        token_count: null,
        has_attachments: false,
        created_at: msg.created_at || new Date().toISOString(),
        expires_at: null
      }));

      // Decrypt messages
      const decrypted: DecryptedMessage[] = await Promise.all(
        messageData.map(async (msg) => {
          try {
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
      
      // Set isFirstExchange based on whether conversation already has messages
      isFirstExchange.current = decrypted.length === 0;
      
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
      isFirstExchange.current = true;
    }
  }, [selectedConversation]);

  useEffect(() => {
    loadConversations();
    const unsubscribe = subscribeToConversations();
    return () => {
      unsubscribe();
    };
  }, []);

  // Cleanup expired ZeroTrace conversations on load
  useEffect(() => {
    if (isZeroTrace && !storageModeLoading) {
      localChatStorage.cleanupExpiredContent().then(result => {
        if (result.conversationsDeleted > 0) {
          console.log(`[ZeroTrace] Cleaned up ${result.conversationsDeleted} expired conversations (${result.messagesDeleted} messages)`);
          // Refresh conversation list after cleanup
          loadConversations();
        }
      }).catch(err => {
        console.error('[ZeroTrace] Cleanup error:', err);
      });
    }
  }, [isZeroTrace, storageModeLoading]);

  const loadConversations = async () => {
    try {
      // Use storage mode hook to load conversations (routes to server or local)
      const storageConvs = await loadStorageConversations();
      
      // Map to Conversation type
      const convs: Conversation[] = storageConvs.map(conv => ({
        id: conv.id,
        user_id: user?.id || '',
        encrypted_title: conv.encrypted_title,
        title_nonce: conv.title_nonce,
        model_id: conv.model_id,
        key_hash: '',
        is_encrypted: true,
        zero_retention: conv.is_zero_trace,
        retention_mode: conv.is_zero_trace ? 'zerotrace' : 'forever',
        last_message_at: conv.last_message_at,
        created_at: conv.created_at || new Date().toISOString(),
        updated_at: conv.updated_at || new Date().toISOString()
      }));

      setConversations(convs);
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

      // 1. Generate encryption key and hash FIRST (don't store in DB yet)
      const key = await chatEncryption.generateKey();
      const keyHash = await chatEncryption.hashKey(key);
      
      // 2. Create nonce for title encryption
      const titleNonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))));

      // 3. Create conversation in database FIRST (so FK constraint is satisfied)
      const { data: convData, error: convError } = await supabase
        .from('encrypted_conversations')
        .insert({
          user_id: currentUser.id,
          encrypted_title: null,
          title_nonce: titleNonce,
          model_id: selectedModel,
          key_hash: keyHash,
          is_encrypted: true,
          zero_retention: zeroRetention,
          retention_mode: zeroRetention ? 'zerotrace' : 'forever'
        })
        .select()
        .single();

      if (convError) {
        console.error('[Vault Chat] Failed to create conversation:', convError);
        throw new Error(`Failed to create conversation: ${convError.message}`);
      }

      const conversation = convData as Conversation;
      console.log('[Vault Chat] Created conversation:', conversation.id);

      // 4. NOW store key with the REAL conversation ID
      // Store in IndexedDB first
      await chatEncryption.storeKey(conversation.id, key);
      
      // 5. Store in database (this will now succeed because conversation exists)
      await chatEncryption.storeKeyInDatabase(conversation.id, key, keyHash);
      
      console.log('[Vault Chat] ✅ Encryption key stored successfully');

      // 6. Update UI state
      setSelectedConversation(conversation.id);
      isFirstExchange.current = true; // New conversation, first exchange pending

      // 7. Refresh conversations list
      await loadConversations();

      toast({
        title: 'New conversation created',
        description: 'Your encrypted conversation is ready',
      });

    } catch (error) {
      console.error('[Vault Chat] Error creating conversation:', error);
      toast({
        title: 'Failed to create conversation',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  /**
   * Check if a conversation has a valid encryption key.
   * If not, offer to delete the orphaned conversation.
   */
  const recoverOrDeleteOrphanedConversation = async (conversationId: string): Promise<boolean> => {
    // First check IndexedDB
    let key = await chatEncryption.getKey(conversationId);
    if (key) return true;

    // Try to restore from database
    key = await chatEncryption.restoreKey(conversationId);
    if (key) return true;

    // Check if key exists in database at all
    const { data: keyData } = await supabase
      .from('conversation_keys')
      .select('wrapped_key')
      .eq('conversation_id', conversationId)
      .single();

    if (!keyData) {
      // No key in database - conversation is unrecoverable
      const confirmed = window.confirm(
        'This conversation\'s encryption key is lost and cannot be recovered. ' +
        'The messages are permanently encrypted and unreadable. ' +
        'Would you like to delete this conversation?'
      );

      if (confirmed) {
        await supabase
          .from('encrypted_conversations')
          .delete()
          .eq('id', conversationId);
        
        toast({
          title: 'Conversation deleted',
          description: 'The orphaned conversation has been removed',
        });

        setSelectedConversation(null);
        await loadConversations();
      }
      return false;
    }

    return true; // Key exists
  };

  /**
   * Handle selecting a conversation with key recovery check
   */
  const handleSelectConversation = async (conversationId: string) => {
    setSelectedConversation(conversationId);

    try {
      // Try to get key from IndexedDB first
      let key = await chatEncryption.getKey(conversationId);
      
      if (!key) {
        // Try to restore from database
        console.log('[Vault Chat] Key not in IndexedDB, trying database...');
        key = await chatEncryption.restoreKey(conversationId);
        
        if (!key) {
          // Key doesn't exist anywhere - orphaned conversation
          console.error('[Vault Chat] No key found for conversation:', conversationId);
          
          const canRecover = await recoverOrDeleteOrphanedConversation(conversationId);
          if (!canRecover) {
            setSelectedConversation(null);
            return;
          }
        }
      }

      // Load messages
      await loadMessages(conversationId);
      
    } catch (error) {
      console.error('[Vault Chat] Error selecting conversation:', error);
      toast({
        title: 'Error loading conversation',
        description: (error as Error).message,
        variant: 'destructive'
      });
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

      // Get next sequence number and save user message via storage mode
      const userSeqNum = await getNextSequenceNumber(selectedConversation);
      const userMsgId = crypto.randomUUID();
      
      await saveMessage({
        id: userMsgId,
        conversation_id: selectedConversation,
        role: 'user',
        encrypted_content: encryptedUserMessage,
        nonce: '', // Nonce is embedded in ciphertext for our format
        sequence_number: userSeqNum
      });

      // Add to UI immediately
      const userMsgData: DecryptedMessage = {
        id: userMsgId,
        conversation_id: selectedConversation,
        ciphertext: encryptedUserMessage,
        nonce: '',
        role: 'user',
        sequence_number: userSeqNum,
        token_count: Math.ceil(messageContent.length / 4),
        has_attachments: false,
        created_at: new Date().toISOString(),
        expires_at: null,
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

      // Get next sequence number and save assistant message via storage mode
      const assistantSeqNum = await getNextSequenceNumber(selectedConversation);
      const assistantMsgId = crypto.randomUUID();
      
      await saveMessage({
        id: assistantMsgId,
        conversation_id: selectedConversation,
        role: 'assistant',
        encrypted_content: encryptedAssistantMessage,
        nonce: '', // Nonce is embedded in ciphertext for our format
        sequence_number: assistantSeqNum
      });

      // Add to UI
      const assistantMsgData: DecryptedMessage = {
        id: assistantMsgId,
        conversation_id: selectedConversation,
        ciphertext: encryptedAssistantMessage,
        nonce: '',
        role: 'assistant',
        sequence_number: assistantSeqNum,
        token_count: data.usage?.completion_tokens || null,
        has_attachments: false,
        created_at: new Date().toISOString(),
        expires_at: null,
        content: assistantContent,
        decrypted: true
      };
      setMessages(prev => [...prev, assistantMsgData]);

      // Update conversation's last_message_at (only for server mode)
      if (!isZeroTrace) {
        await supabase
          .from('encrypted_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', selectedConversation);
      }

      // Generate title after first exchange (when there were 0 messages before)
      // Only generate if conversation doesn't already have a title
      const wasFirstExchange = isFirstExchange.current;
      const convHasTitle = currentConversation?.encrypted_title;
      if (wasFirstExchange && !convHasTitle) {
        isFirstExchange.current = false;
        // Generate title in background (don't block UI)
        generateConversationTitle(selectedConversation, messageContent, assistantContent);
      } else {
        isFirstExchange.current = false;
      }

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

  const currentConversation = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="h-screen bg-background">
      <main className="h-full flex flex-col">
        {selectedConversation ? (
          // CHAT VIEW
          <div className="flex-1 flex flex-col">
            {/* Chat Header with Back Button */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedConversation(null)}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="font-medium text-foreground truncate">
                  {currentConversation ? getDisplayTitle(currentConversation) : 'Conversation'}
                </h2>
                {isZeroTrace && (
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 hidden sm:flex">
                    <Shield className="w-3 h-3 mr-1" />
                    ZeroTrace
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(true)}
                  className="h-8 w-8"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
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
          // LIST VIEW (Full Width)
          <ConversationListView
            conversations={conversations}
            onSelect={handleSelectConversation}
            onNewChat={createNewConversation}
            onImport={() => setImportDialogOpen(true)}
            isCreating={creating}
            isZeroTrace={isZeroTrace}
            getDisplayTitle={getDisplayTitle}
          />
        )}
      </main>

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

      {isZeroTrace && (
        <ImportChatDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportSuccess={async (conversationId) => {
            // Refresh conversations and select the imported one
            const convs = await loadStorageConversations();
            const mappedConvs: Conversation[] = convs.map(c => ({
              id: c.id,
              user_id: user?.id || '',
              encrypted_title: c.encrypted_title,
              title_nonce: c.title_nonce,
              model_id: c.model_id,
              key_hash: '',
              is_encrypted: true,
              zero_retention: true,
              retention_mode: 'local',
              last_message_at: c.updated_at,
              created_at: c.created_at,
              updated_at: c.updated_at,
              is_zero_trace: true,
            }));
            setConversations(mappedConvs);
            setSelectedConversation(conversationId);
          }}
        />
      )}

      {isZeroTrace && conversationToExport && (
        <ExportChatDialog
          open={exportDialogOpen}
          onOpenChange={(open) => {
            setExportDialogOpen(open);
            if (!open) setConversationToExport(null);
          }}
          conversationId={conversationToExport}
          conversationTitle={conversations.find(c => c.id === conversationToExport)?.encrypted_title || 'ZeroTrace Chat'}
          messageCount={messages.length}
          wrappedKey={{ ciphertext: '', nonce: '' }} // Key wrapping handled inside dialog
          onExportComplete={() => {
            recordExport();
            setExportDialogOpen(false);
            setConversationToExport(null);
          }}
        />
      )}
    </div>
  );
};

export default VaultChat;
