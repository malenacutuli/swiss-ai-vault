import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { StudioLayout } from '@/components/agents/StudioLayout';
import { SourceUploadModal } from '@/components/agents/SourceUploadModal';
import { AgentsSidebar } from '@/components/agents/AgentsSidebar';
import { AgentsHeader } from '@/components/agents/AgentsHeader';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { processDocument } from '@/lib/memory/document-processor';

interface Source {
  id: string;
  type: 'file' | 'url' | 'text';
  name: string;
  content?: string;
  url?: string;
  charCount?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AgentsStudio() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sources, setSources] = useState<Source[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleAddSource = () => {
    setIsSourceModalOpen(true);
  };

  const handleFileUpload = async (files: File[]) => {
    setIsSourceModalOpen(false);
    setIsExtracting(true);
    
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
          // Try simple text extraction as fallback
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
      setIsExtracting(false);
    }
  };

  const handleUrlAdd = (url: string) => {
    const newSource: Source = {
      id: crypto.randomUUID(),
      type: 'url',
      name: url.length > 40 ? url.substring(0, 40) + '...' : url,
      url,
    };
    setSources(prev => [...prev, newSource]);
    setIsSourceModalOpen(false);
    toast({
      title: 'Source added',
      description: 'URL has been added to your sources.',
    });
  };

  const handleTextAdd = (text: string) => {
    const newSource: Source = {
      id: crypto.randomUUID(),
      type: 'text',
      name: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      content: text,
    };
    setSources(prev => [...prev, newSource]);
    setIsSourceModalOpen(false);
    toast({
      title: 'Source added',
      description: 'Text has been added to your sources.',
    });
  };

  const handleDeleteSource = (sourceId: string) => {
    setSources(prev => prev.filter(s => s.id !== sourceId));
    toast({
      title: 'Source removed',
      description: 'The source has been removed.',
    });
  };

  const handleDeepResearch = async () => {
    if (sources.length === 0) {
      toast({
        title: 'No sources',
        description: 'Add at least one source to start deep research.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Starting deep research',
      description: 'Analyzing your sources...',
    });

    // Navigate to agents with research task
    navigate('/ghost/agents', { 
      state: { 
        taskType: 'deep_research',
        sources: sources,
      } 
    });
  };

  const handleCreateOutput = async (outputType: string) => {
    if (sources.length === 0) {
      toast({
        title: 'No sources',
        description: 'Add at least one source to generate output.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Build structured context from sources with clear document markers
      let documentContext = '\n\n--- UPLOADED DOCUMENTS ---\n\n';
      sources.forEach((source, index) => {
        documentContext += `=== Document ${index + 1}: ${source.name} ===\n`;
        documentContext += source.content || source.url || '[No content]';
        documentContext += '\n\n';
      });
      documentContext += '--- END OF DOCUMENTS ---\n\n';

      const fullPrompt = `${documentContext}\n\nUser Request: Based on the above documents, create a ${outputType}.`;

      // Create task via agent-execute
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          prompt: fullPrompt,
          task_type: outputType.toLowerCase().replace(/ /g, '_'),
          mode: outputType.toLowerCase().replace(/ /g, '_'),
          params: {
            sources: sources.map(s => ({ name: s.name, type: s.type, charCount: s.charCount })),
            has_documents: true,
            document_count: sources.length,
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'Generation started',
        description: `Creating your ${outputType}...`,
      });

      // Navigate to agents to see progress
      navigate('/ghost/agents', {
        state: { taskId: data.task?.id || data.taskId },
      });

    } catch (err: any) {
      toast({
        title: 'Generation failed',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Build structured context from sources with clear markers
      let documentContext = '';
      if (sources.length > 0) {
        documentContext = '\n\n--- UPLOADED DOCUMENTS ---\n\n';
        sources.forEach((source, index) => {
          documentContext += `=== Document ${index + 1}: ${source.name} ===\n`;
          documentContext += source.content || source.url || '[No content]';
          documentContext += '\n\n';
        });
        documentContext += '--- END OF DOCUMENTS ---\n\n';
      }

      const systemPrompt = sources.length > 0
        ? `You are a helpful assistant analyzing the user's documents. You have FULL ACCESS to all document content provided below. Do NOT say you cannot access files - the content is provided in this context.${documentContext}`
        : 'You are a helpful AI assistant.';

      // Call inference
      const { data, error } = await supabase.functions.invoke('ghost-inference', {
        body: {
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
          model: 'google/gemini-2.5-flash',
          task_type: 'chat',
        },
      });

      if (error) throw error;

      const assistantContent = data.choices?.[0]?.message?.content || data.content || 'No response';

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err: any) {
      toast({
        title: 'Chat error',
        description: err.message || 'Failed to get response.',
        variant: 'destructive',
      });
    }
  };

  const handleNewTask = () => {
    navigate('/ghost/agents');
  };

  return (
    <>
      <Helmet>
        <title>Studio | Swiss Agents</title>
        <meta name="description" content="NotebookLM-style workspace for creating AI-powered content from your sources." />
      </Helmet>
      
      <div className="min-h-screen bg-white">
        {/* Sidebar */}
        <AgentsSidebar 
          onNewTask={handleNewTask}
          activeView="studio"
        />
        
        {/* Main content area */}
        <div className="ml-[280px] h-screen flex flex-col">
          <AgentsHeader />
          
          <div className="flex-1 overflow-hidden">
            <StudioLayout
              sources={sources}
              onAddSource={handleAddSource}
              onDeleteSource={handleDeleteSource}
              onDeepResearch={handleDeepResearch}
              onCreateOutput={handleCreateOutput}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>
        
        {/* Source Upload Modal */}
        <SourceUploadModal
          open={isSourceModalOpen}
          onOpenChange={setIsSourceModalOpen}
          onUploadFiles={handleFileUpload}
          onAddUrl={handleUrlAdd}
          onAddText={handleTextAdd}
        />
      </div>
    </>
  );
}
