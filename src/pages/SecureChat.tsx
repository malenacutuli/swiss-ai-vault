/**
 * SecureChat Page
 * Main encrypted chat interface with conversation sidebar, messages, and encryption status.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Settings, MoreVertical, Trash2, Send, Shield, Lock } from '@/icons';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SecurityBadges, EncryptionStatus, VaultStatusBadge } from '@/components/vault-chat/SecurityBadges';
import { VaultUnlockDialog } from '@/components/vault-chat/VaultUnlockDialog';
import { MessageBubble } from '@/components/vault-chat/MessageBubble';
import { EncryptionSetupWizard } from '@/components/vault/EncryptionSetupWizard';
import { useEncryptedChat } from '@/hooks/useEncryptedChat';
import { useEncryption } from '@/hooks/useEncryption';
import { cn } from '@/lib/utils';

export default function SecureChat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [messageInput, setMessageInput] = useState('');
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  
  const { isInitialized, isUnlocked, isLoading: encryptionLoading, lockVault } = useEncryption();
  
  const {
    conversations,
    currentConversation,
    messages,
    isLoading,
    isSending,
    isEncrypting,
    needsUnlock,
    loadConversations,
    selectConversation,
    createConversation,
    deleteConversation,
    sendMessage,
    clearCurrentConversation
  } = useEncryptedChat();
  
  // Show unlock or setup dialog as needed
  useEffect(() => {
    if (encryptionLoading) return;
    
    if (!isInitialized) {
      setShowSetupWizard(true);
    } else if (needsUnlock) {
      setShowUnlockDialog(true);
    }
  }, [isInitialized, needsUnlock, encryptionLoading]);
  
  // Load conversation from URL
  useEffect(() => {
    if (conversationId && isUnlocked) {
      selectConversation(conversationId);
    } else if (!conversationId) {
      clearCurrentConversation();
    }
  }, [conversationId, isUnlocked, selectConversation, clearCurrentConversation]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleCreateConversation = async () => {
    if (!isUnlocked) {
      if (!isInitialized) {
        setShowSetupWizard(true);
      } else {
        setShowUnlockDialog(true);
      }
      return;
    }
    
    const id = await createConversation();
    navigate(`/secure-chat/${id}`);
  };
  
  const handleSelectConversation = (id: string) => {
    navigate(`/secure-chat/${id}`);
  };
  
  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;
    
    const content = messageInput;
    setMessageInput('');
    await sendMessage(content);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    loadConversations();
  };
  
  // Show setup wizard if encryption not initialized
  if (showSetupWizard && !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <EncryptionSetupWizard 
          onComplete={handleSetupComplete}
          onSkip={() => {
            setShowSetupWizard(false);
            navigate('/dashboard');
          }}
        />
      </div>
    );
  }
  
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-72 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Secure Chat</h2>
          </div>
          <VaultStatusBadge 
            isUnlocked={isUnlocked} 
            onClick={() => isUnlocked ? lockVault() : setShowUnlockDialog(true)}
          />
        </div>
        
        <div className="p-3">
          <Button 
            onClick={handleCreateConversation} 
            className="w-full"
            disabled={!isUnlocked}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Encrypted Chat
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading && conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No conversations yet
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors group",
                    "hover:bg-muted",
                    conversationId === conv.id && "bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate flex-1 text-sm">{conv.title}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-foreground/60 hover:text-foreground bg-muted/30 hover:bg-muted rounded-md"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          aria-label="Conversation actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                            if (conversationId === conv.id) {
                              navigate('/secure-chat');
                            }
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {conv.isEncrypted && (
                      <Lock className="h-3 w-3 text-green-600 dark:text-green-400" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h1 className="font-semibold">{currentConversation.title}</h1>
                <SecurityBadges 
                  isEncrypted={currentConversation.isEncrypted}
                  zeroRetention={currentConversation.zeroRetention}
                  className="mt-1"
                />
              </div>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.length === 0 && !isLoading && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Start your encrypted conversation</p>
                    <p className="text-sm mt-1">All messages are end-to-end encrypted</p>
                  </div>
                )}
                
                {messages.map((message) => (
                  <MessageBubble 
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    timestamp={message.createdAt}
                  />
                ))}
                
                {isSending && (
                  <div className="flex justify-center">
                    <div className="text-sm text-muted-foreground animate-pulse">
                      AI is thinking...
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            {/* Input */}
            <div className="p-4 border-t">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <Textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message..."
                      className="min-h-[60px] pr-12 resize-none"
                      disabled={!isUnlocked || isSending}
                    />
                    <Button
                      size="icon"
                      className="absolute bottom-2 right-2"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || !isUnlocked || isSending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <EncryptionStatus 
                    isEncrypting={isEncrypting} 
                    isUnlocked={isUnlocked}
                  />
                  <span className="text-xs text-muted-foreground">
                    Enter to send, Shift+Enter for new line
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
              <h2 className="text-xl font-semibold mb-2">Secure Encrypted Chat</h2>
              <p className="text-muted-foreground mb-4 max-w-md">
                Your messages are encrypted end-to-end using AES-256-GCM. 
                Only you can read them.
              </p>
              <Button onClick={handleCreateConversation} disabled={!isUnlocked}>
                <Plus className="h-4 w-4 mr-2" />
                New Encrypted Chat
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Unlock Dialog */}
      <VaultUnlockDialog
        open={showUnlockDialog}
        onOpenChange={setShowUnlockDialog}
        onUnlocked={() => loadConversations()}
      />
    </div>
  );
}
