import React, { useState, useCallback } from 'react';
import { 
  Upload, Youtube, Image, Mic, Globe, Link, X, 
  FileText, Loader2, Check, AlertCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SourceInput {
  id: string;
  type: 'pdf' | 'youtube' | 'image' | 'audio' | 'web' | 'text';
  value: string;
  title?: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error?: string;
}

interface MultimodalSourceInputProps {
  notebookId: string;
  onSourcesAdded?: (sources: SourceInput[]) => void;
  className?: string;
}

type TabType = 'upload' | 'link' | 'text';

export function MultimodalSourceInput({ notebookId, onSourcesAdded, className }: MultimodalSourceInputProps) {
  const [sources, setSources] = useState<SourceInput[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [linkInput, setLinkInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const { toast } = useToast();

  const detectLinkType = (url: string): 'youtube' | 'web' => {
    const youtubePatterns = [
      /youtube\.com\/watch/,
      /youtu\.be\//,
      /youtube\.com\/embed/,
    ];
    return youtubePatterns.some(p => p.test(url)) ? 'youtube' : 'web';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
    });
  };

  const addToNotebook = async (id: string, type: string, content: string, title: string) => {
    const { error } = await supabase.functions.invoke('notebooklm-proxy', {
      body: {
        action: 'add_sources',
        notebook_id: notebookId,
        sources: [{
          text: content,
          title: title,
        }],
      },
    });
    
    if (error) throw error;
  };

  const processFile = async (id: string, file: File, type: SourceInput['type']) => {
    setSources(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'processing' } : s
    ));
    
    try {
      if (type === 'audio') {
        // Transcribe audio with Whisper
        const base64 = await fileToBase64(file);
        
        const { data, error } = await supabase.functions.invoke('ghost-voice', {
          body: {
            audio: base64,
            action: 'transcribe',
          },
        });
        
        if (error) throw new Error(error.message);
        
        // Add transcription as text source
        await addToNotebook(id, 'text', data.transcription || data.text, file.name);
        
      } else if (type === 'image') {
        // Process image with Gemini Vision
        const base64 = await fileToBase64(file);
        
        const { data, error } = await supabase.functions.invoke('ghost-inference', {
          body: {
            model: 'gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Describe this image in detail. If it contains text, extract and include all text content.' },
                  { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } },
                ],
              },
            ],
          },
        });
        
        if (error) throw new Error(error.message);
        
        // Add description as text source
        await addToNotebook(id, 'text', data.content, `Image: ${file.name}`);
        
      } else {
        // PDF - add via proxy with text extraction
        const base64 = await fileToBase64(file);
        
        const { error } = await supabase.functions.invoke('notebooklm-proxy', {
          body: {
            action: 'add_sources',
            notebook_id: notebookId,
            sources: [{
              pdf_url: `data:${file.type};base64,${base64}`,
              title: file.name,
            }],
          },
        });
        
        if (error) throw error;
      }
      
      setSources(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'ready' } : s
      ));
      
      onSourcesAdded?.(sources.filter(s => s.status === 'ready'));
      
    } catch (err: any) {
      setSources(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'error', error: err.message } : s
      ));
      toast({ title: "Processing Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    const newSources: SourceInput[] = [];
    
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      let type: SourceInput['type'] = 'pdf';
      
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type === 'application/pdf') type = 'pdf';
      
      newSources.push({
        id,
        type,
        value: file.name,
        title: file.name,
        status: 'pending',
      });
      
      // Process after adding to state
      setTimeout(() => processFile(id, file, type), 100);
    }
    
    setSources(prev => [...prev, ...newSources]);
  }, [notebookId]);

  const handleLinkSubmit = async () => {
    if (!linkInput.trim()) return;
    
    const type = detectLinkType(linkInput);
    const id = crypto.randomUUID();
    
    setSources(prev => [...prev, {
      id,
      type,
      value: linkInput,
      title: linkInput,
      status: 'processing',
    }]);
    
    try {
      const sourceData: any = {};
      
      if (type === 'youtube') {
        sourceData.youtube_url = linkInput;
      } else {
        sourceData.web_url = linkInput;
      }
      
      const { error } = await supabase.functions.invoke('notebooklm-proxy', {
        body: {
          action: 'add_sources',
          notebook_id: notebookId,
          sources: [sourceData],
        },
      });
      
      if (error) throw new Error(error.message);
      
      setSources(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'ready' } : s
      ));
      setLinkInput('');
      
    } catch (err: any) {
      setSources(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'error', error: err.message } : s
      ));
      toast({ title: "Failed to add source", description: err.message, variant: "destructive" });
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    
    const id = crypto.randomUUID();
    
    setSources(prev => [...prev, {
      id,
      type: 'text',
      value: textInput.slice(0, 50) + '...',
      title: 'Pasted Text',
      status: 'processing',
    }]);
    
    try {
      const { error } = await supabase.functions.invoke('notebooklm-proxy', {
        body: {
          action: 'add_sources',
          notebook_id: notebookId,
          sources: [{
            text: textInput,
            title: 'Pasted Text',
          }],
        },
      });
      
      if (error) throw error;
      
      setSources(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'ready' } : s
      ));
      setTextInput('');
      
    } catch (err: any) {
      setSources(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'error', error: err.message } : s
      ));
    }
  };

  const removeSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const getTypeIcon = (type: SourceInput['type']) => {
    switch (type) {
      case 'youtube': return Youtube;
      case 'image': return Image;
      case 'audio': return Mic;
      case 'web': return Globe;
      case 'text': return FileText;
      default: return FileText;
    }
  };

  const getTypeColor = (type: SourceInput['type']) => {
    switch (type) {
      case 'youtube': return 'text-red-500 bg-red-500/10';
      case 'image': return 'text-purple-500 bg-purple-500/10';
      case 'audio': return 'text-orange-500 bg-orange-500/10';
      case 'web': return 'text-blue-500 bg-blue-500/10';
      default: return 'text-primary bg-primary/10';
    }
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground text-sm">Add Sources</h3>
        <p className="text-xs text-muted-foreground">Upload files, paste links, or add text</p>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { id: 'upload' as TabType, label: 'Upload', icon: Upload },
          { id: 'link' as TabType, label: 'Link', icon: Link },
          { id: 'text' as TabType, label: 'Text', icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
              activeTab === id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'upload' && (
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) {
                handleFileUpload(e.dataTransfer.files);
              }
            }}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.m4a,.ogg';
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) handleFileUpload(files);
              };
              input.click();
            }}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">
              Drop files here or browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, Images, Audio (MP3, WAV)
            </p>
          </div>
        )}
        
        {activeTab === 'link' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Paste YouTube or web URL..."
                className="flex-1 px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLinkSubmit();
                }}
              />
              <button
                onClick={handleLinkSubmit}
                disabled={!linkInput.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-blue-500" /> Web pages
              </span>
            </div>
          </div>
        )}
        
        {activeTab === 'text' && (
          <div className="space-y-3">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste or type text content..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-border text-sm resize-none bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textInput.trim()}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Add Text Source
            </button>
          </div>
        )}
      </div>
      
      {/* Source List */}
      {sources.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs text-muted-foreground mb-2">
            Sources ({sources.length})
          </div>
          
          <div className="space-y-2">
            {sources.map((source) => {
              const Icon = getTypeIcon(source.type);
              const colorClass = getTypeColor(source.type);
              
              return (
                <div
                  key={source.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorClass)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {source.title || source.value}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{source.type}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {source.status === 'processing' && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                    {source.status === 'ready' && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                    {source.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                    
                    <button
                      onClick={() => removeSource(source.id)}
                      className="p-1 hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
