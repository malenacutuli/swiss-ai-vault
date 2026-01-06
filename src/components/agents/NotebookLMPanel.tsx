import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Notebook {
  id: string;
  notebook_id: string;
  title: string;
  description?: string | null;
  sources?: unknown;
  created_at: string;
  user_id?: string;
}

interface NotebookOutput {
  id: string;
  output_type: string;
  content?: string;
  audio_url?: string;
  created_at: string;
}

interface Props {
  taskId?: string;
  onNotebookCreated?: (notebook: Notebook) => void;
  className?: string;
}

export const NotebookLMPanel: React.FC<Props> = ({ taskId, onNotebookCreated, className }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [outputs, setOutputs] = useState<NotebookOutput[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [newNotebook, setNewNotebook] = useState({ title: '', description: '' });
  const [newSources, setNewSources] = useState<string[]>(['']);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (userId) {
      fetchNotebooks();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedNotebook) {
      fetchOutputs(selectedNotebook.id);
    }
  }, [selectedNotebook]);

  const fetchNotebooks = async () => {
    const { data } = await supabase
      .from('notebooklm_notebooks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (data) setNotebooks(data);
  };

  const fetchOutputs = async (notebookId: string) => {
    const { data } = await supabase
      .from('notebooklm_outputs')
      .select('*')
      .eq('notebook_id', notebookId)
      .order('created_at', { ascending: false });
    
    if (data) setOutputs(data);
  };

  const handleCreateNotebook = async () => {
    if (!newNotebook.title.trim()) {
      toast.error('Please enter a notebook title');
      return;
    }

    setIsCreating(true);
    try {
      const sourcesData = newSources
        .filter(s => s.trim())
        .map(s => ({
          type: s.startsWith('http') ? 'url' : 'text',
          uri: s.startsWith('http') ? s : undefined,
          content: !s.startsWith('http') ? s : undefined,
          title: s.substring(0, 50),
        }));

      const { data, error } = await supabase
        .from('notebooklm_notebooks')
        .insert({
          notebook_id: crypto.randomUUID(),
          user_id: userId!,
          title: newNotebook.title,
          description: newNotebook.description || null,
          sources: sourcesData,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Notebook created successfully');
      setNewNotebook({ title: '', description: '' });
      setNewSources(['']);
      fetchNotebooks();
      
      if (data && onNotebookCreated) {
        onNotebookCreated(data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create notebook');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!selectedNotebook) return;

    setIsGeneratingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke('notebooklm-audio', {
        body: {
          notebookId: selectedNotebook.id,
          style: 'briefing',
          duration: 'medium',
          taskId,
        },
      });

      if (error) throw error;

      toast.success('Audio overview generated');
      fetchOutputs(selectedNotebook.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const addSource = () => {
    setNewSources([...newSources, '']);
  };

  const updateSource = (index: number, value: string) => {
    const updated = [...newSources];
    updated[index] = value;
    setNewSources(updated);
  };

  const removeSource = (index: number) => {
    if (newSources.length > 1) {
      setNewSources(newSources.filter((_, i) => i !== index));
    }
  };

  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden", className)}>
      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">NotebookLM Enterprise</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Create grounded knowledge notebooks with audio summaries
        </p>
      </div>

      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {/* Create New Notebook */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Create Notebook</h4>
          
          <input
            type="text"
            placeholder="Notebook title"
            value={newNotebook.title}
            onChange={(e) => setNewNotebook(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          
          <textarea
            placeholder="Description (optional)"
            value={newNotebook.description}
            onChange={(e) => setNewNotebook(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={2}
          />

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Sources</label>
            {newSources.map((source, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  placeholder="URL or paste text content"
                  value={source}
                  onChange={(e) => updateSource(i, e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {newSources.length > 1 && (
                  <button
                    onClick={() => removeSource(i)}
                    className="px-3 py-2 border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  >
                    −
                  </button>
                )}
                {i === newSources.length - 1 && (
                  <button
                    onClick={addSource}
                    className="px-3 py-2 border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  >
                    +
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleCreateNotebook}
            disabled={isCreating || !newNotebook.title.trim()}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {isCreating ? 'Creating...' : 'Create Notebook'}
          </button>
        </div>

        {/* Existing Notebooks */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Your Notebooks</h4>
          
          {notebooks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notebooks yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {notebooks.map((notebook) => (
                <div
                  key={notebook.id}
                  onClick={() => setSelectedNotebook(notebook)}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-colors",
                    selectedNotebook?.id === notebook.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <p className="font-medium text-sm text-foreground">{notebook.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {Array.isArray(notebook.sources) ? notebook.sources.length : 0} sources • {new Date(notebook.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Notebook Actions */}
        {selectedNotebook && (
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-2">
              Actions for "{selectedNotebook.title}"
            </h4>
            
            <div className="flex gap-2">
              <button
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio}
                className="flex-1 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {isGeneratingAudio ? 'Generating...' : 'Generate Audio Overview'}
              </button>
            </div>

            {/* Outputs */}
            {outputs.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Generated Outputs:</p>
                {outputs.map((output) => (
                  <div key={output.id} className="p-2 bg-muted/50 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                        {output.output_type.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(output.created_at).toLocaleString()}
                      </span>
                    </div>
                    {output.content && (
                      <p className="mt-1 text-muted-foreground line-clamp-2">
                        {output.content.substring(0, 150)}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotebookLMPanel;
