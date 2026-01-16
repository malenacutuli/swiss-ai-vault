/**
 * StudioComplete.tsx
 * Full 3-panel NotebookLM-style research workspace with integrated components
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useNotebookLM } from '@/hooks/useNotebookLM';

// UI Components
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

// Studio Components
import { SourceSidebar, SourceSnippet } from '@/components/studio/SourceSidebar';
import { NotesPanel, Note } from '@/components/studio/NotesPanel';
import { GroundedChat, ChatMessage, Citation } from '@/components/studio/GroundedChat';
import { PDFViewerWithHighlight, PDFHighlight } from '@/components/studio/PDFViewerWithHighlight';
import { ExpandableMindMap } from '@/components/studio/ExpandableMindMap';
import { StyleSelector } from '@/components/studio/StyleSelector';
import { StylePreset } from '@/lib/stylePresets';

// Icons
import {
  ChevronLeft, FileText, StickyNote, Settings, Upload,
  Plus, Loader2, Sparkles, Network, Presentation,
  BookOpen, HelpCircle, Mic, MessageSquare, X,
  FlaskConical, PanelLeftClose, PanelRightClose,
} from 'lucide-react';

// Types
interface LocalSource {
  id: string;
  name: string;
  type: 'pdf' | 'youtube' | 'web' | 'text' | 'file';
  url?: string;
  content?: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
}

interface GeneratedArtifact {
  type: 'mindmap' | 'slides' | 'quiz' | 'flashcards' | 'podcast' | 'report';
  data: any;
  createdAt: Date;
}

export default function StudioComplete() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const notebookLM = useNotebookLM();

  // Notebook state
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [notebookTitle, setNotebookTitle] = useState('Swiss BrAIn Studio');
  const [sources, setSources] = useState<LocalSource[]>([]);

  // Panel state
  const [leftPanel, setLeftPanel] = useState<'sources' | 'notes'>('sources');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Center view state
  const [centerView, setCenterView] = useState<'chat' | 'pdf' | 'artifact'>('chat');
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<GeneratedArtifact | null>(null);

  // Style state
  const [style, setStyle] = useState<StylePreset>('corporate');

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCitations, setActiveCitations] = useState<SourceSnippet[]>([]);
  const [activeNodeTitle, setActiveNodeTitle] = useState<string | undefined>();
  const [activeHighlight, setActiveHighlight] = useState<PDFHighlight | undefined>();

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<string | null>(null);

  // ============================================
  // NOTEBOOK INITIALIZATION
  // ============================================

  const initializeNotebook = useCallback(async () => {
    if (notebookId) return notebookId;
    
    try {
      const notebook = await notebookLM.createNotebook(notebookTitle);
      setNotebookId(notebook.id);
      return notebook.id;
    } catch (e: any) {
      toast({ title: "Failed to create notebook", variant: "destructive" });
      return null;
    }
  }, [notebookId, notebookTitle, notebookLM, toast]);

  // ============================================
  // CHAT HANDLERS
  // ============================================

  const handleSendMessage = useCallback(async (content: string) => {
    if (!notebookId) {
      const nbId = await initializeNotebook();
      if (!nbId) return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const response = await notebookLM.chat(notebookId!, content, sessionId || undefined);
      
      if (response.session_id) {
        setSessionId(response.session_id);
      }

      const citations: Citation[] = response.grounding_metadata?.chunks?.map((c: any, i: number) => ({
        index: i + 1,
        source_id: c.source_id,
        source_title: c.title || 'Source',
        text: c.text || '',
        page_number: c.page_number,
      })) || [];

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        citations,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (e: any) {
      toast({ title: "Chat failed", description: e.message, variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  }, [notebookId, sessionId, notebookLM, initializeNotebook, toast]);

  // ============================================
  // CITATION HANDLERS
  // ============================================

  const handleCitationClick = useCallback((citation: Citation) => {
    const snippets: SourceSnippet[] = [{
      source_id: citation.source_id,
      source_title: citation.source_title,
      text: citation.text,
      page_number: citation.page_number,
      confidence: 0.95,
    }];
    
    setActiveCitations(snippets);
    setActiveNodeTitle(citation.source_title);
    setSidebarOpen(true);
  }, []);

  const handleSnippetClick = useCallback((snippet: SourceSnippet) => {
    if (snippet.page_number) {
      setActiveHighlight({
        page: snippet.page_number,
        bbox: snippet.bbox,
      });
      
      // If we have a PDF URL, switch to PDF view
      const source = sources.find(s => s.id === snippet.source_id);
      if (source?.url) {
        setActivePdfUrl(source.url);
        setCenterView('pdf');
      }
    }
    setSidebarOpen(false);
  }, [sources]);

  // ============================================
  // NOTES HANDLERS
  // ============================================

  const handleAddNote = useCallback((content: string, source: 'ai' | 'user', sourceQuery?: string) => {
    const note: Note = {
      id: crypto.randomUUID(),
      content,
      source,
      sourceQuery,
      timestamp: new Date(),
      starred: false,
    };
    setNotes(prev => [note, ...prev]);
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleUpdateNote = useCallback((id: string, content: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
  }, []);

  const handleToggleStar = useCallback((id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, starred: !n.starred } : n));
  }, []);

  const handleSaveToNotes = useCallback((content: string, sourceQuery?: string) => {
    handleAddNote(content, 'ai', sourceQuery);
    toast({ title: 'Saved to notes' });
  }, [handleAddNote, toast]);

  // ============================================
  // GENERATION HANDLERS
  // ============================================

  const handleGenerate = useCallback(async (type: 'mindmap' | 'slides' | 'quiz' | 'flashcards' | 'podcast' | 'report') => {
    if (!notebookId) {
      const nbId = await initializeNotebook();
      if (!nbId) {
        toast({ title: "Create a notebook first", variant: "destructive" });
        return;
      }
    }

    const readySources = sources.filter(s => s.status === 'ready');
    if (readySources.length === 0) {
      toast({ title: "Add sources first", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratingType(type);

    try {
      const nbId = notebookId!;
      let result: any;

      switch (type) {
        case 'mindmap':
          result = await notebookLM.generateMindmap(nbId);
          break;
        case 'slides':
          result = await notebookLM.generateSlides(nbId);
          break;
        case 'quiz':
          result = await notebookLM.generateQuiz(nbId);
          break;
        case 'flashcards':
          result = await notebookLM.generateFlashcards(nbId);
          break;
        case 'podcast':
          result = await notebookLM.generatePodcast(nbId);
          break;
        case 'report':
          result = await notebookLM.generateReport(nbId);
          break;
      }

      const artifact: GeneratedArtifact = {
        type,
        data: result,
        createdAt: new Date(),
      };

      setActiveArtifact(artifact);
      setCenterView('artifact');
      toast({ title: `${type} generated!` });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  }, [notebookId, sources, notebookLM, initializeNotebook, toast]);

  // ============================================
  // MINDMAP NODE CLICK
  // ============================================

  const handleMindmapNodeClick = useCallback((node: any) => {
    if (node.citations && node.citations.length > 0) {
      const snippets: SourceSnippet[] = node.citations.map((c: any) => ({
        source_id: c.source_id,
        source_title: c.title || 'Source',
        text: c.text,
        confidence: 0.9,
      }));
      
      setActiveCitations(snippets);
      setActiveNodeTitle(node.label);
      setSidebarOpen(true);
    }
  }, []);

  // ============================================
  // RENDER
  // ============================================

  const readySources = sources.filter(s => s.status === 'ready');

  return (
    <>
      <Helmet>
        <title>Studio | SwissBrAIn</title>
        <meta name="description" content="NotebookLM-style research and content generation workspace." />
      </Helmet>

      <div className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center px-4 bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
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

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
              className="h-8 w-8"
            >
              <PanelLeftClose className={cn("w-4 h-4", leftPanelCollapsed && "rotate-180")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
              className="h-8 w-8"
            >
              <PanelRightClose className={cn("w-4 h-4", rightPanelCollapsed && "rotate-180")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT PANEL: Sources / Notes */}
          <div className={cn(
            "border-r border-border flex flex-col bg-muted/30 transition-all duration-300",
            leftPanelCollapsed ? "w-0 overflow-hidden" : "w-80"
          )}>
            <Tabs value={leftPanel} onValueChange={(v) => setLeftPanel(v as 'sources' | 'notes')} className="flex flex-col h-full">
              <TabsList className="mx-3 mt-3 grid grid-cols-2">
                <TabsTrigger value="sources" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Sources
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4" />
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sources" className="flex-1 flex flex-col overflow-hidden m-0">
                <div className="p-3 border-b border-border">
                  <Button
                    variant="outline"
                    className="w-full flex items-center gap-2"
                    onClick={() => {/* Add source modal */}}
                  >
                    <Plus className="w-4 h-4" />
                    Add sources
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-3">
                  {sources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Add PDFs, websites, or text
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sources.map((source) => (
                        <div
                          key={source.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border"
                        >
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate flex-1">{source.name}</span>
                          {source.status === 'processing' && (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          )}
                          {source.status === 'ready' && (
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="notes" className="flex-1 m-0 overflow-hidden">
                <NotesPanel
                  notes={notes}
                  onAddNote={handleAddNote}
                  onDeleteNote={handleDeleteNote}
                  onUpdateNote={handleUpdateNote}
                  onToggleStar={handleToggleStar}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* CENTER PANEL: Chat / PDF / Artifact */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {centerView === 'chat' && (
              <GroundedChat
                messages={messages}
                isLoading={isChatLoading}
                onSendMessage={handleSendMessage}
                onCitationClick={handleCitationClick}
                onSaveToNotes={handleSaveToNotes}
              />
            )}

            {centerView === 'pdf' && activePdfUrl && (
              <div className="flex-1 p-4">
                <PDFViewerWithHighlight
                  url={activePdfUrl}
                  activeHighlight={activeHighlight}
                  title="Document Viewer"
                />
              </div>
            )}

            {centerView === 'artifact' && activeArtifact && (
              <div className="flex-1 p-4 overflow-auto">
                {activeArtifact.type === 'mindmap' && activeArtifact.data?.nodes && (
                  <ExpandableMindMap
                    nodes={activeArtifact.data.nodes}
                    title={activeArtifact.data.title || 'Mind Map'}
                    style={style}
                    onNodeClick={handleMindmapNodeClick}
                  />
                )}
                {/* Add other artifact renderers here */}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Style & Generate */}
          <div className={cn(
            "border-l border-border flex flex-col bg-muted/30 transition-all duration-300",
            rightPanelCollapsed ? "w-0 overflow-hidden" : "w-96"
          )}>
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Style & Generate
              </h3>
              <StyleSelector selected={style} onChange={setStyle} />
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Generate Artifacts
                </h4>

                <GenerateButton
                  icon={Network}
                  label="Mind Map"
                  description="Visual concept connections"
                  onClick={() => handleGenerate('mindmap')}
                  disabled={readySources.length === 0 || isGenerating}
                  loading={generatingType === 'mindmap'}
                />

                <GenerateButton
                  icon={Presentation}
                  label="Slides"
                  description="Presentation deck with notes"
                  onClick={() => handleGenerate('slides')}
                  disabled={readySources.length === 0 || isGenerating}
                  loading={generatingType === 'slides'}
                />

                <GenerateButton
                  icon={HelpCircle}
                  label="Quiz"
                  description="Test your knowledge"
                  onClick={() => handleGenerate('quiz')}
                  disabled={readySources.length === 0 || isGenerating}
                  loading={generatingType === 'quiz'}
                />

                <GenerateButton
                  icon={BookOpen}
                  label="Flashcards"
                  description="Study cards for review"
                  onClick={() => handleGenerate('flashcards')}
                  disabled={readySources.length === 0 || isGenerating}
                  loading={generatingType === 'flashcards'}
                />

                <GenerateButton
                  icon={Mic}
                  label="Podcast"
                  description="Audio discussion"
                  onClick={() => handleGenerate('podcast')}
                  disabled={readySources.length === 0 || isGenerating}
                  loading={generatingType === 'podcast'}
                />

                <GenerateButton
                  icon={MessageSquare}
                  label="Report"
                  description="Comprehensive analysis"
                  onClick={() => handleGenerate('report')}
                  disabled={readySources.length === 0 || isGenerating}
                  loading={generatingType === 'report'}
                />
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Source Sidebar */}
        <SourceSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          snippets={activeCitations}
          activeNodeTitle={activeNodeTitle}
          onSnippetClick={handleSnippetClick}
        />
      </div>
    </>
  );
}

// Generate Button Component
function GenerateButton({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
        disabled
          ? "bg-muted/50 border-border/50 cursor-not-allowed opacity-50"
          : "bg-background border-border hover:border-primary hover:shadow-sm"
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {loading ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        ) : (
          <Icon className="w-5 h-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </button>
  );
}
