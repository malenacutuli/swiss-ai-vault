import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { chatEncryption } from '@/lib/encryption';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Lock,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { toast } = useToast();

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
                        onClick={() => {
                          setSelectedConversation(conv.id);
                          setChatSidebarOpen(false);
                        }}
                        className={cn(
                          "p-4 cursor-pointer hover:bg-accent/50",
                          "transition-colors",
                          selectedConversation === conv.id && 
                            "bg-primary/10 border-l-4 border-primary"
                        )}
                      >
                        <h3 className="font-medium text-sm truncate text-foreground">{conv.title}</h3>
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
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Conversation: {selectedConversation.slice(0, 8)}...
                      <br />
                      <span className="text-xs">(Chat interface coming next)</span>
                    </p>
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
    </div>
  );
};

export default VaultChat;
