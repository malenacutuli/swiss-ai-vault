import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Settings, FileText, Send, 
  Loader2, Quote, ChevronRight, Plus, Shield, Lock, Mic, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AudioBriefingDialog } from '@/components/briefings/AudioBriefingDialog';
import {
  getProject,
  getProjectDocuments,
  removeDocumentFromProject,
  migrateProjectDocumentIds,
  type MemoryProject,
  type MemoryItem,
} from '@/lib/memory/memory-store';
import { useProjectQuery } from '@/hooks/useProjectQuery';
import { AddDocumentsDialog } from '@/components/projects/AddDocumentsDialog';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { VaultUnlockDialog } from '@/components/vault-chat/VaultUnlockDialog';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ documentTitle: string; content: string }>;
  timestamp: number;
}

export default function ProjectDetailPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getMasterKey, isUnlocked, isLoading: encryptionLoading } = useEncryptionContext();
  
  const [project, setProject] = useState<MemoryProject | null>(null);
  const [documents, setDocuments] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDocs, setShowAddDocs] = useState(false);
  const [showBriefingDialog, setShowBriefingDialog] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { queryWithContext, isQuerying, isReady } = useProjectQuery(projectId);

  // Load saved conversation from localStorage
  useEffect(() => {
    if (!projectId) return;
    
    const storageKey = `project-conversation-${projectId}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[Project] Loaded ${parsed.length} saved messages`);
          setMessages(parsed);
        }
      } catch (e) {
        console.error('[Project] Failed to load conversation:', e);
        localStorage.removeItem(storageKey);
      }
    }
  }, [projectId]);

  // Save conversation on change
  useEffect(() => {
    if (!projectId) return;
    
    const storageKey = `project-conversation-${projectId}`;
    
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [projectId, messages]);

  // Clear conversation function
  const clearConversation = useCallback(() => {
    if (!projectId) return;
    setMessages([]);
    localStorage.removeItem(`project-conversation-${projectId}`);
  }, [projectId]);

  useEffect(() => {
    if (projectId && isUnlocked) {
      loadProject();
    } else if (!encryptionLoading && !isUnlocked) {
      setIsLoading(false);
    }
  }, [projectId, isUnlocked, encryptionLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadProject() {
    setIsLoading(true);
    try {
      const key = await getMasterKey();
      if (!key) return;
      
      // Migrate chunk IDs for existing projects (one-time fix)
      const migrated = await migrateProjectDocumentIds(projectId!, key);
      if (migrated > 0) {
        console.log(`[Project] Migrated ${migrated} chunk IDs`);
      }
      
      const [proj, docs] = await Promise.all([
        getProject(projectId!),
        getProjectDocuments(projectId!, key),
      ]);
      setProject(proj || null);
      setDocuments(docs);
    } finally {
      setIsLoading(false);
    }
  }

  const getDocumentTitle = (doc: MemoryItem): string => {
    return doc.metadata.title || doc.metadata.filename || 'Untitled Document';
  };

  async function handleSendMessage() {
    if (!inputValue.trim() || isQuerying) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    try {
      const history = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const { response, sources } = await queryWithContext(
        userMessage.content,
        history
      );

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        sources,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${error.message}`,
          timestamp: Date.now(),
        },
      ]);
    }
  }

  async function handleRemoveDocument(docId: string) {
    const key = await getMasterKey();
    if (!key) return;
    
    await removeDocumentFromProject(projectId!, docId, key);
    await loadProject();
  }

  function toggleSources(messageId: string) {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  // Show unlock dialog if vault is locked
  if (!encryptionLoading && !isUnlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Unlock Your Vault</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Unlock your vault to access project documents
            </p>
            <Button onClick={() => setShowUnlock(true)} className="w-full">
              Unlock Vault
            </Button>
          </CardContent>
        </Card>
        
        <VaultUnlockDialog
          open={showUnlock}
          onOpenChange={setShowUnlock}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <p className="text-muted-foreground">Project not found</p>
        <Button onClick={() => navigate('/ghost/projects')} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - Document List */}
      <div className="w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => navigate('/ghost/projects')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate">{project.name}</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate(`/ghost/projects/${projectId}/settings`)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 ml-10">
              {project.description}
            </p>
          )}
        </div>

        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Documents</span>
            <Button variant="ghost" size="sm" onClick={() => setShowAddDocs(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowBriefingDialog(true)}
            disabled={documents.length === 0}
          >
            <Mic className="h-4 w-4" />
            Brief Me
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No documents yet</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowAddDocs(true)}
                >
                  Add documents
                </Button>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 group"
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate flex-1">{getDocumentTitle(doc)}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs"
                    onClick={() => handleRemoveDocument(doc.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            All data stored locally
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Chat with {project.name}
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Ask questions about your {documents.length} documents.
                  <br />
                  AI will only answer from your documents (no hallucination).
                </p>
                {project.instructions && (
                  <Card className="mt-6 max-w-md mx-auto text-left">
                    <CardContent className="p-4">
                      <Badge variant="secondary" className="mb-2">
                        Custom Instructions
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {project.instructions}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex flex-col gap-2',
                    message.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="max-w-[80%]">
                      <button
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleSources(message.id)}
                      >
                        <Quote className="h-3 w-3" />
                        {message.sources.length} sources
                        <ChevronRight
                          className={cn(
                            'h-3 w-3 transition-transform',
                            expandedSources.has(message.id) && 'rotate-90'
                          )}
                        />
                      </button>

                      {expandedSources.has(message.id) && (
                        <div className="mt-2 space-y-2">
                          {message.sources.map((source, idx) => (
                            <Card key={idx} className="overflow-hidden">
                              <CardContent className="p-3">
                                <p className="text-xs font-medium text-primary mb-1">
                                  [SOURCE_{idx + 1}] {source.documentTitle}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-3">
                                  {source.content}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                documents.length === 0
                  ? 'Add documents to start chatting...'
                  : 'Ask about your documents...'
              }
              disabled={documents.length === 0 || !isReady}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isQuerying || !isReady}>
              {isQuerying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            🔒 Documents stay in your browser. Only relevant snippets sent to AI.
          </p>
        </div>
      </div>

      <AddDocumentsDialog
        open={showAddDocs}
        onOpenChange={setShowAddDocs}
        projectId={projectId!}
        existingDocIds={documents.map((d) => d.id)}
        onAdded={loadProject}
      />

      <AudioBriefingDialog
        open={showBriefingDialog}
        onOpenChange={setShowBriefingDialog}
        documents={documents.map((doc) => ({
          id: doc.id,
          title: doc.metadata.title || doc.metadata.filename || 'Untitled',
          content: doc.content || '',
        }))}
        projectId={projectId}
        onComplete={(briefing) => {
          console.log('[ProjectDetailPage] Briefing created:', briefing.id);
        }}
      />
    </div>
  );
}
