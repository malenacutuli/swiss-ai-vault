import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useNotebookLM } from '@/hooks/useNotebookLM';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { processDocument } from '@/lib/memory/document-processor';

// Icons
import { 
  Plus, Upload, Globe, Youtube, FileText, 
  Mic, Network, BookOpen, 
  HelpCircle, FileBarChart, Presentation, Table2,
  Send, Trash2, X, Sparkles, Loader2,
  Clock, MessageSquare, GraduationCap, ChevronLeft,
  FlaskConical, Home
} from 'lucide-react';

// Types
interface LocalSource {
  id: string;
  name: string;
  type: 'pdf' | 'youtube' | 'web' | 'drive' | 'text' | 'file';
  url?: string;
  content?: string;
  charCount?: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    source_id: string;
    source_name: string;
    text: string;
  }>;
}

type OutputType = 
  | 'podcast' | 'mindmap' | 'report' 
  | 'flashcards' | 'quiz' | 'slides' 
  | 'table' | 'faq' | 'timeline' | 'study_guide';

// Output configurations
const OUTPUTS: Array<{
  type: OutputType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  { type: 'podcast', label: 'Audio Summary', icon: Mic, description: 'Two-host podcast discussion' },
  { type: 'mindmap', label: 'Mind Map', icon: Network, description: 'Visual concept connections' },
  { type: 'report', label: 'Executive Report', icon: FileBarChart, description: 'Comprehensive analysis' },
  { type: 'flashcards', label: 'Flashcards', icon: BookOpen, description: 'Study cards for review' },
  { type: 'quiz', label: 'Quiz', icon: HelpCircle, description: 'Test your knowledge' },
  { type: 'slides', label: 'Presentation', icon: Presentation, description: 'Slide deck with notes' },
  { type: 'table', label: 'Data Table', icon: Table2, description: 'Comparative analysis' },
  { type: 'faq', label: 'FAQ', icon: MessageSquare, description: 'Common questions answered' },
  { type: 'timeline', label: 'Timeline', icon: Clock, description: 'Chronological events' },
  { type: 'study_guide', label: 'Study Guide', icon: GraduationCap, description: 'Learning companion' },
];

export default function Studio() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // NotebookLM hook
  const notebookLM = useNotebookLM();

  // State
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [notebookTitle, setNotebookTitle] = useState('Untitled notebook');
  const [sources, setSources] = useState<LocalSource[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [generatedOutputs, setGeneratedOutputs] = useState<Array<{ type: OutputType; data: any }>>([]);
  
  // UI State
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<OutputType | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeOutput, setActiveOutput] = useState<{ type: OutputType; data: any } | null>(null);

  // Source input states
  const [webUrl, setWebUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [pastedText, setPastedText] = useState('');

  // ============================================
  // NOTEBOOK INITIALIZATION
  // ============================================

  const initializeNotebook = useCallback(async () => {
    if (notebookId) return notebookId;
    
    try {
      const notebook = await notebookLM.createNotebook(notebookTitle);
      setNotebookId(notebook.id);
      console.log('[Studio] Notebook created:', notebook.id);
      return notebook.id;
    } catch (e: any) {
      console.error('[Studio] Failed to create notebook:', e);
      toast({ title: "Failed to create notebook", variant: "destructive" });
      return null;
    }
  }, [notebookId, notebookTitle, notebookLM, toast]);

  // ============================================
  // SOURCE MANAGEMENT
  // ============================================

  const handleAddWebSource = async () => {
    if (!webUrl.trim()) return;
    
    let nbId = notebookId;
    if (!nbId) {
      nbId = await initializeNotebook();
      if (!nbId) return;
    }

    const tempId = crypto.randomUUID();
    let hostname = 'Website';
    try {
      hostname = new URL(webUrl).hostname;
    } catch {}
    
    setSources(prev => [...prev, {
      id: tempId,
      name: hostname,
      type: 'web',
      url: webUrl,
      status: 'processing'
    }]);

    try {
      const addedSources = await notebookLM.addSources(nbId, [{ web_url: webUrl, title: hostname }]);
      setSources(prev => prev.map(s => 
        s.id === tempId 
          ? { ...s, id: addedSources[0]?.id || tempId, status: 'ready' as const }
          : s
      ));
      setWebUrl('');
      setShowAddSourceModal(false);
    } catch (e) {
      setSources(prev => prev.map(s => 
        s.id === tempId ? { ...s, status: 'error' as const } : s
      ));
    }
  };

  const handleAddYoutubeSource = async () => {
    if (!youtubeUrl.trim()) return;
    
    let nbId = notebookId;
    if (!nbId) {
      nbId = await initializeNotebook();
      if (!nbId) return;
    }

    const tempId = crypto.randomUUID();
    setSources(prev => [...prev, {
      id: tempId,
      name: 'YouTube Video',
      type: 'youtube',
      url: youtubeUrl,
      status: 'processing'
    }]);

    try {
      const addedSources = await notebookLM.addSources(nbId, [{ youtube_url: youtubeUrl, title: 'YouTube Video' }]);
      setSources(prev => prev.map(s => 
        s.id === tempId 
          ? { ...s, id: addedSources[0]?.id || tempId, status: 'ready' as const }
          : s
      ));
      setYoutubeUrl('');
      setShowAddSourceModal(false);
    } catch (e) {
      setSources(prev => prev.map(s => 
        s.id === tempId ? { ...s, status: 'error' as const } : s
      ));
    }
  };

  const handleAddTextSource = async () => {
    if (!pastedText.trim()) return;
    
    let nbId = notebookId;
    if (!nbId) {
      nbId = await initializeNotebook();
      if (!nbId) return;
    }

    const tempId = crypto.randomUUID();
    const title = `Text (${new Date().toLocaleDateString()})`;
    
    setSources(prev => [...prev, {
      id: tempId,
      name: title,
      type: 'text',
      content: pastedText,
      charCount: pastedText.length,
      status: 'processing'
    }]);

    try {
      const addedSources = await notebookLM.addSources(nbId, [{ text: pastedText, title }]);
      setSources(prev => prev.map(s => 
        s.id === tempId 
          ? { ...s, id: addedSources[0]?.id || tempId, status: 'ready' as const }
          : s
      ));
      setPastedText('');
      setShowAddSourceModal(false);
    } catch (e) {
      setSources(prev => prev.map(s => 
        s.id === tempId ? { ...s, status: 'error' as const } : s
      ));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let nbId = notebookId;
    if (!nbId) {
      nbId = await initializeNotebook();
      if (!nbId) return;
    }

    toast({
      title: 'Processing files',
      description: `Extracting content from ${files.length} file(s)...`,
    });

    for (const file of Array.from(files)) {
      const tempId = crypto.randomUUID();
      
      setSources(prev => [...prev, {
        id: tempId,
        name: file.name,
        type: 'file',
        status: 'processing'
      }]);

      try {
        // Extract text from file
        const result = await processDocument(file);
        const content = result.success && result.content ? result.content : await file.text();
        
        // Add to notebook
        const addedSources = await notebookLM.addSources(nbId!, [{ 
          text: content, 
          title: file.name 
        }]);
        
        setSources(prev => prev.map(s => 
          s.id === tempId 
            ? { 
                ...s, 
                id: addedSources[0]?.id || tempId, 
                content,
                charCount: content.length,
                status: 'ready' as const 
              }
            : s
        ));
      } catch (err) {
        console.error('File processing error:', err);
        setSources(prev => prev.map(s => 
          s.id === tempId ? { ...s, status: 'error' as const } : s
        ));
      }
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowAddSourceModal(false);
  };

  const handleRemoveSource = async (sourceId: string) => {
    if (!notebookId) {
      setSources(prev => prev.filter(s => s.id !== sourceId));
      return;
    }
    
    try {
      await notebookLM.deleteSource(notebookId, sourceId);
      setSources(prev => prev.filter(s => s.id !== sourceId));
    } catch (e) {
      toast({ title: "Failed to remove source", variant: "destructive" });
    }
  };

  // ============================================
  // GROUNDED CHAT
  // ============================================

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !notebookId) return;
    
    const readySources = sources.filter(s => s.status === 'ready');
    if (readySources.length === 0) {
      toast({ title: "Add sources first", description: "Chat requires at least one source", variant: "destructive" });
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: chatInput
    };

    setChatMessages(prev => [...prev, userMessage]);
    const query = chatInput;
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await notebookLM.chat(notebookId, query, sessionId || undefined);
      
      if (response.session_id) {
        setSessionId(response.session_id);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        citations: response.grounding_metadata?.chunks.map(c => ({
          source_id: c.source_id,
          source_name: c.title,
          text: c.title
        }))
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (e: any) {
      toast({ title: "Chat failed", description: e.message, variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  };

  // ============================================
  // ARTIFACT GENERATION
  // ============================================

  const handleGenerate = async (outputType: OutputType) => {
    if (!notebookId) {
      const nbId = await initializeNotebook();
      if (!nbId) {
        toast({ title: "Create a notebook first", variant: "destructive" });
        return;
      }
    }

    const readySources = sources.filter(s => s.status === 'ready');
    if (readySources.length === 0) {
      toast({ title: "Add sources first", description: "Generation requires at least one source", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratingType(outputType);

    try {
      const nbId = notebookId!;
      let result: any;

      switch (outputType) {
        case 'podcast':
          result = await notebookLM.generatePodcast(nbId);
          break;
        case 'quiz':
          result = await notebookLM.generateQuiz(nbId);
          break;
        case 'flashcards':
          result = await notebookLM.generateFlashcards(nbId);
          break;
        case 'mindmap':
          result = await notebookLM.generateMindmap(nbId);
          break;
        case 'report':
          result = await notebookLM.generateReport(nbId);
          break;
        case 'slides':
          result = await notebookLM.generateSlides(nbId);
          break;
        case 'table':
          result = await notebookLM.generateTable(nbId);
          break;
        case 'faq':
          result = await notebookLM.generateFaq(nbId);
          break;
        case 'timeline':
          result = await notebookLM.generateTimeline(nbId);
          break;
        case 'study_guide':
          result = await notebookLM.generateStudyGuide(nbId);
          break;
      }

      const newOutput = { type: outputType, data: result };
      setGeneratedOutputs(prev => [newOutput, ...prev]);
      setActiveOutput(newOutput);

    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  const readySources = sources.filter(s => s.status === 'ready');
  const canGenerate = readySources.length > 0 && !isGenerating;

  return (
    <>
      <Helmet>
        <title>Studio | Swiss AI</title>
        <meta name="description" content="NotebookLM-style research and content generation workspace." />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3 flex-1">
            <button 
              onClick={() => navigate('/')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              <input
                type="text"
                value={notebookTitle}
                onChange={(e) => setNotebookTitle(e.target.value)}
                className="text-lg font-medium bg-transparent border-none focus:outline-none text-foreground"
                placeholder="Untitled notebook"
              />
            </div>
          </div>

          {notebookId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4" />
              <span>{readySources.length} source(s) ready</span>
            </div>
          )}
        </header>

        {/* Three Panel Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Sources */}
          <div className="w-[280px] border-r border-border flex flex-col bg-muted/30">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground mb-3">Sources</h2>
              <button
                onClick={() => setShowAddSourceModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add sources
              </button>
            </div>

            {/* Sources List */}
            <div className="flex-1 overflow-auto p-3">
              {sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <FileText className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Add PDFs, websites, YouTube videos, or text
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="group flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {source.status === 'processing' ? (
                          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                        ) : source.type === 'youtube' ? (
                          <Youtube className="w-4 h-4 text-red-500" />
                        ) : source.type === 'web' ? (
                          <Globe className="w-4 h-4 text-blue-500" />
                        ) : (
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{source.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {source.status === 'ready' && source.charCount 
                            ? `${Math.round(source.charCount / 1000)}k chars`
                            : source.status
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveSource(source.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CENTER: Chat */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground">Chat</h2>
              <p className="text-xs text-muted-foreground mt-1">Ask questions about your sources</p>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {readySources.length === 0 
                      ? "Add sources to start chatting"
                      : "Ask questions about your sources"
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3",
                          message.role === 'user'
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs opacity-70">
                              Sources: {message.citations.map(c => c.source_name).join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl px-4 py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder={readySources.length === 0 ? "Add sources first..." : "Ask about your sources..."}
                  disabled={readySources.length === 0 || isChatLoading}
                  className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-full text-sm focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || readySources.length === 0 || isChatLoading}
                  className="p-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Studio */}
          <div className="w-[320px] flex flex-col bg-muted/30">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground">Studio</h2>
              <p className="text-xs text-muted-foreground mt-1">Generate artifacts from your sources</p>
            </div>

            <div className="flex-1 overflow-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                {OUTPUTS.map((output) => {
                  const Icon = output.icon;
                  const isActive = isGenerating && generatingType === output.type;
                  
                  return (
                    <button
                      key={output.type}
                      onClick={() => handleGenerate(output.type)}
                      disabled={!canGenerate}
                      className={cn(
                        "flex flex-col items-start gap-2 p-3 rounded-xl border transition-all text-left",
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isActive ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium text-foreground">{output.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Generated Outputs */}
              {generatedOutputs.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Generated</h3>
                  <div className="space-y-2">
                    {generatedOutputs.map((output, i) => {
                      const Icon = OUTPUTS.find(o => o.type === output.type)?.icon || FileText;
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveOutput(output)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                            activeOutput === output
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:border-primary/30"
                          )}
                        >
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm capitalize">{output.type.replace('_', ' ')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      {showAddSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-2xl w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Add sources</h3>
              <button onClick={() => setShowAddSourceModal(false)} className="p-2 hover:bg-muted rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Upload Files</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Choose files or drag & drop</span>
                </button>
              </div>

              {/* Web URL */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Web URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                  <button 
                    onClick={handleAddWebSource}
                    disabled={!webUrl.trim()}
                    className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* YouTube */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">YouTube Video</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                  <button 
                    onClick={handleAddYoutubeSource}
                    disabled={!youtubeUrl.trim()}
                    className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Text */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Paste Text</label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste your text content..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-primary"
                />
                {pastedText.trim() && (
                  <button 
                    onClick={handleAddTextSource} 
                    className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                  >
                    Add Text
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Output Viewer Modal */}
      {activeOutput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-2xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground capitalize">
                {activeOutput.type.replace('_', ' ')}
              </h3>
              <button onClick={() => setActiveOutput(null)} className="p-2 hover:bg-muted rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <OutputViewer type={activeOutput.type} data={activeOutput.data} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Output viewer component
function OutputViewer({ type, data }: { type: OutputType; data: any }) {
  switch (type) {
    case 'podcast':
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <h3>Podcast Transcript</h3>
          <div className="whitespace-pre-wrap text-sm">{data.transcript}</div>
        </div>
      );

    case 'quiz':
      return (
        <div className="space-y-6">
          {data.questions?.map((q: any, i: number) => (
            <div key={i} className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-3">Q{i + 1}: {q.question}</p>
              <div className="space-y-2">
                {q.options?.map((opt: string, j: number) => (
                  <div 
                    key={j} 
                    className={cn(
                      "px-3 py-2 rounded-md text-sm",
                      j === q.correct_index || j === q.correctIndex
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-background"
                    )}
                  >
                    {opt}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="mt-3 text-sm text-muted-foreground">{q.explanation}</p>
              )}
            </div>
          ))}
        </div>
      );

    case 'flashcards':
      return (
        <div className="grid grid-cols-2 gap-4">
          {data.cards?.map((card: any, i: number) => (
            <div key={i} className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{card.front}</p>
              <p className="text-sm text-muted-foreground">{card.back}</p>
            </div>
          ))}
        </div>
      );

    case 'mindmap':
      return (
        <div className="space-y-4">
          <h3 className="font-medium">Concept Map</h3>
          <div className="space-y-2">
            {data.nodes?.map((node: any) => (
              <div 
                key={node.id} 
                className={cn(
                  "px-4 py-2 rounded-lg",
                  node.type === 'central' ? "bg-primary text-primary-foreground" :
                  node.type === 'topic' ? "bg-primary/20" :
                  "bg-muted"
                )}
              >
                {node.label}
              </div>
            ))}
          </div>
        </div>
      );

    case 'slides':
      return (
        <div className="space-y-6">
          {data.title && <h2 className="text-xl font-bold">{data.title}</h2>}
          {data.slides?.map((slide: any, i: number) => (
            <div key={i} className="p-6 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Slide {slide.number || i + 1}</p>
              <h3 className="font-semibold text-lg mb-2">{slide.title}</h3>
              {slide.subtitle && <p className="text-muted-foreground mb-4">{slide.subtitle}</p>}
              {slide.bullets && (
                <ul className="list-disc list-inside space-y-1">
                  {slide.bullets.map((bullet: string, j: number) => (
                    <li key={j} className="text-sm">{bullet}</li>
                  ))}
                </ul>
              )}
              {slide.notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">Speaker Notes:</p>
                  <p className="text-sm">{slide.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      );

    case 'report':
    case 'study_guide':
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {data.title && <h2>{data.title}</h2>}
          <div className="whitespace-pre-wrap">{data.content}</div>
          {data.sections?.map((section: any, i: number) => (
            <div key={i}>
              <h3>{section.heading}</h3>
              <p>{section.content}</p>
            </div>
          ))}
        </div>
      );

    case 'faq':
      return (
        <div className="space-y-4">
          {data.questions?.map((q: any, i: number) => (
            <div key={i} className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{q.question}</p>
              <p className="text-sm text-muted-foreground">{q.answer}</p>
            </div>
          ))}
        </div>
      );

    case 'timeline':
      return (
        <div className="space-y-4">
          {data.events?.map((event: any, i: number) => (
            <div key={i} className="flex gap-4">
              <div className="w-24 flex-shrink-0 text-sm font-medium text-primary">
                {event.date}
              </div>
              <div className="flex-1 pb-4 border-l-2 border-border pl-4">
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-muted-foreground">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      );

    case 'table':
      return (
        <div className="overflow-x-auto">
          {data.title && <h3 className="font-medium mb-4">{data.title}</h3>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {data.columns?.map((col: string, i: number) => (
                  <th key={i} className="px-4 py-2 text-left font-medium">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows?.map((row: string[], i: number) => (
                <tr key={i} className="border-b border-border">
                  {row.map((cell: string, j: number) => (
                    <td key={j} className="px-4 py-2">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return (
        <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}
