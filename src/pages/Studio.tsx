import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SourcePanel, OutputTypeGrid, GenerationModal } from '@/components/studio';
import { GhostSidebar } from '@/components/ghost/GhostSidebar';
import { useToast } from '@/hooks/use-toast';
import { useStudioNotebooks } from '@/hooks/useStudioNotebooks';
import { useNotebookLM } from '@/hooks/useNotebookLM';
import { supabase } from '@/integrations/supabase/client';
import { processDocument } from '@/lib/memory/document-processor';
import { FlaskConical } from 'lucide-react';

interface Source {
  id: string;
  type: 'file' | 'url' | 'youtube' | 'text';
  name: string;
  content?: string;
  url?: string;
  charCount?: number;
}

export default function Studio() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { notebooks, createNotebook } = useStudioNotebooks();
  const { loading: notebookLoading, generateArtifact } = useNotebookLM();
  
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Generation modal state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentOutputType, setCurrentOutputType] = useState<string>('');
  const [showGenerationModal, setShowGenerationModal] = useState(false);

  const handleCreateNotebook = async (title: string) => {
    try {
      const result = await createNotebook.mutateAsync(title);
      setSelectedNotebookId(result.id);
      toast({
        title: 'Notebook created',
        description: `"${title}" is ready to use.`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to create notebook',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleFilesUploaded = useCallback(async (files: File[]) => {
    setIsUploading(true);
    toast({
      title: 'Processing files',
      description: `Extracting content from ${files.length} file(s)...`,
    });

    try {
      const extractedSources: Source[] = [];
      
      for (const file of files) {
        const result = await processDocument(file);
        
        if (result.success && result.content) {
          extractedSources.push({
            id: crypto.randomUUID(),
            type: 'file',
            name: file.name,
            content: result.content,
            charCount: result.content.length,
          });
        } else {
          try {
            const textContent = await file.text();
            extractedSources.push({
              id: crypto.randomUUID(),
              type: 'file',
              name: file.name,
              content: textContent,
              charCount: textContent.length,
            });
          } catch {
            toast({
              title: 'Extraction failed',
              description: `Could not extract content from ${file.name}`,
              variant: 'destructive',
            });
          }
        }
      }
      
      if (extractedSources.length > 0) {
        setSources(prev => [...prev, ...extractedSources]);
        const totalChars = extractedSources.reduce((sum, s) => sum + (s.charCount || 0), 0);
        toast({
          title: 'Files processed',
          description: `Extracted ${Math.round(totalChars / 1000)}k characters from ${extractedSources.length} file(s)`,
        });
      }
    } catch (error) {
      toast({
        title: 'Processing error',
        description: 'Some files could not be processed',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const handleAddSource = (source: Omit<Source, 'id'>) => {
    const newSource: Source = {
      ...source,
      id: crypto.randomUUID(),
    };
    setSources(prev => [...prev, newSource]);
    toast({
      title: 'Source added',
      description: `${source.type === 'url' ? 'URL' : source.type === 'youtube' ? 'YouTube video' : 'Text'} has been added.`,
    });
  };

  const handleRemoveSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
    toast({
      title: 'Source removed',
    });
  };

  // Map output types to agent task types
  const OUTPUT_TO_TASK_TYPE: Record<string, string> = {
    podcast: 'audio_summary',
    quiz: 'quiz',
    flashcards: 'flashcards',
    mindmap: 'mind_map',
    slides: 'slides',
    report: 'document',
    study_guide: 'document',
    faq: 'document',
    timeline: 'document',
    table: 'spreadsheet',
  };

  const handleGenerate = async (outputType: string) => {
    if (sources.length === 0) {
      toast({
        title: 'No sources',
        description: 'Add at least one source to generate output.',
        variant: 'destructive',
      });
      return;
    }

    // Open modal and start generation
    setCurrentOutputType(outputType);
    setShowGenerationModal(true);
    setIsGenerating(true);

    try {
      // Build document context
      let documentContext = '\n\n--- UPLOADED DOCUMENTS ---\n\n';
      sources.forEach((source, index) => {
        documentContext += `=== Document ${index + 1}: ${source.name} ===\n`;
        documentContext += source.content || source.url || '[No content]';
        documentContext += '\n\n';
      });
      documentContext += '--- END OF DOCUMENTS ---\n\n';

      const fullPrompt = `${documentContext}\n\nUser Request: Based on the above documents, create a ${outputType}.`;
      const taskType = OUTPUT_TO_TASK_TYPE[outputType] || outputType;

      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          prompt: fullPrompt,
          task_type: taskType,
          mode: taskType,
          params: {
            sources: sources.map(s => ({ name: s.name, type: s.type, charCount: s.charCount })),
            has_documents: true,
            document_count: sources.length,
            output_type: outputType,
          },
        },
      });

      if (error) throw error;

      // If we got a job ID, set it for polling
      const jobId = data?.job_id || data?.taskId || data?.task?.id;
      if (jobId) {
        setCurrentJobId(jobId);
      }

      toast({
        title: 'Generation started',
        description: `Your ${outputType} is being created.`,
      });
    } catch (err: any) {
      toast({
        title: 'Generation failed',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
      setIsGenerating(false);
    }
  };

  const handleCloseModal = () => {
    setShowGenerationModal(false);
    setCurrentJobId(null);
    setCurrentOutputType('');
    setIsGenerating(false);
  };

  const handleRetryGeneration = () => {
    if (currentOutputType) {
      handleCloseModal();
      handleGenerate(currentOutputType);
    }
  };

  const notebookList = notebooks.data?.map(nb => ({
    id: nb.id,
    title: nb.title || 'Untitled',
  })) || [];

  return (
    <>
      <Helmet>
        <title>Studio | SwissVault</title>
        <meta name="description" content="NotebookLM-style research and content generation workspace." />
      </Helmet>

      <div className="min-h-screen bg-[#0f0f23] flex">
        {/* Sidebar placeholder - using simplified nav */}
        <GhostSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          conversations={[]}
          selectedConversation={null}
          onSelectConversation={() => {}}
          onNewChat={() => navigate('/ghost')}
          onDeleteConversation={() => {}}
          onRenameConversation={() => {}}
          onExportConversation={() => {}}
          onOpenSettings={() => navigate('/settings')}
        />

        {/* Main Content */}
        <div className={`flex-1 transition-all duration-200 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
          {/* Header */}
          <header className="h-14 border-b border-white/10 flex items-center px-6 bg-[#0f0f23]/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <FlaskConical className="w-5 h-5 text-[#e63946]" />
              <h1 className="text-lg font-semibold text-white">Studio</h1>
            </div>
          </header>

          {/* Two Column Layout */}
          <div className="flex h-[calc(100vh-56px)]">
            {/* Left Panel - Sources (40%) */}
            <div className="w-[40%] border-r border-white/10">
              <SourcePanel
                sources={sources}
                notebooks={notebookList}
                selectedNotebookId={selectedNotebookId}
                onSelectNotebook={setSelectedNotebookId}
                onCreateNotebook={handleCreateNotebook}
                onAddSource={handleAddSource}
                onRemoveSource={handleRemoveSource}
                onFilesUploaded={handleFilesUploaded}
                isUploading={isUploading}
              />
            </div>

            {/* Right Panel - Output Generation (60%) */}
            <div className="w-[60%] flex flex-col">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white mb-2">Generate Output</h2>
                <p className="text-sm text-white/50">
                  {sources.length === 0 
                    ? 'Add sources to unlock generation options.'
                    : `${sources.length} source(s) ready. Choose an output type to generate.`
                  }
                </p>
              </div>
              
              <div className="flex-1 overflow-auto p-6">
                <OutputTypeGrid 
                  disabled={sources.length === 0 || notebookLoading || isGenerating} 
                  onGenerate={handleGenerate} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generation Modal */}
      <GenerationModal
        open={showGenerationModal}
        onClose={handleCloseModal}
        jobId={currentJobId}
        outputType={currentOutputType}
        onRetry={handleRetryGeneration}
      />
    </>
  );
}