import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { StudioLayout } from '@/components/agents/StudioLayout';
import { SourceUploadModal } from '@/components/agents/SourceUploadModal';
import { AgentsSidebar } from '@/components/agents/AgentsSidebar';
import { AgentsHeader } from '@/components/agents/AgentsHeader';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Source {
  id: string;
  type: 'file' | 'url' | 'text';
  name: string;
  content?: string;
  url?: string;
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

  const handleAddSource = () => {
    setIsSourceModalOpen(true);
  };

  const handleFileUpload = (files: File[]) => {
    files.forEach(file => {
      const newSource: Source = {
        id: crypto.randomUUID(),
        type: 'file',
        name: file.name,
        content: `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      };
      setSources(prev => [...prev, newSource]);
    });
    setIsSourceModalOpen(false);
    toast({
      title: 'Source added',
      description: `${files.length} file(s) added to your sources.`,
    });
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
      // Build context from sources
      const sourceContext = sources.map(s => 
        s.content || s.url || s.name
      ).join('\n\n---\n\n');

      // Create task via agent-execute
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          prompt: `Based on the following sources, create a ${outputType}:\n\n${sourceContext}`,
          task_type: outputType.toLowerCase().replace(/ /g, '_'),
          mode: outputType.toLowerCase().replace(/ /g, '_'),
          params: {
            sources: sources,
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
      // Build context from sources
      const sourceContext = sources.length > 0
        ? `Context from sources:\n${sources.map(s => s.content || s.url || s.name).join('\n\n')}\n\n`
        : '';

      // Call inference
      const { data, error } = await supabase.functions.invoke('ghost-inference', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant analyzing the user's sources and documents. ${sourceContext}`,
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
          model: 'gemini-2.5-flash',
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
