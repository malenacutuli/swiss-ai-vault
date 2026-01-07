import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SourceUploader } from './SourceUploader';
import {
  FileText,
  Link2,
  Youtube,
  Trash2,
  Plus,
  FolderOpen,
  File,
  Globe,
} from 'lucide-react';

interface Source {
  id: string;
  type: 'file' | 'url' | 'youtube' | 'text';
  name: string;
  content?: string;
  url?: string;
  charCount?: number;
}

interface Notebook {
  id: string;
  title: string;
}

interface SourcePanelProps {
  sources: Source[];
  notebooks: Notebook[];
  selectedNotebookId: string | null;
  onSelectNotebook: (id: string) => void;
  onCreateNotebook: (title: string) => void;
  onAddSource: (source: Omit<Source, 'id'>) => void;
  onRemoveSource: (id: string) => void;
  onFilesUploaded: (files: File[]) => void;
  isUploading?: boolean;
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  file: File,
  url: Globe,
  youtube: Youtube,
  text: FileText,
};

export function SourcePanel({
  sources,
  notebooks,
  selectedNotebookId,
  onSelectNotebook,
  onCreateNotebook,
  onAddSource,
  onRemoveSource,
  onFilesUploaded,
  isUploading = false,
}: SourcePanelProps) {
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);

  const handleCreateNotebook = () => {
    if (newNotebookTitle.trim()) {
      onCreateNotebook(newNotebookTitle.trim());
      setNewNotebookTitle('');
    }
  };

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      onAddSource({
        type: 'url',
        name: urlInput.length > 40 ? urlInput.substring(0, 40) + '...' : urlInput,
        url: urlInput,
      });
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  const handleAddYoutube = () => {
    if (youtubeInput.trim()) {
      onAddSource({
        type: 'youtube',
        name: 'YouTube: ' + (youtubeInput.length > 30 ? youtubeInput.substring(0, 30) + '...' : youtubeInput),
        url: youtubeInput,
      });
      setYoutubeInput('');
      setShowYoutubeInput(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0f0f23] text-white">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold mb-4">Sources</h2>
        
        {/* Notebook Selection */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New notebook title..."
              value={newNotebookTitle}
              onChange={(e) => setNewNotebookTitle(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
            />
            <Button
              onClick={handleCreateNotebook}
              disabled={!newNotebookTitle.trim()}
              className="bg-[#e63946] hover:bg-[#e63946]/90 text-white shrink-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {notebooks.length > 0 && (
            <Select value={selectedNotebookId || ''} onValueChange={onSelectNotebook}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select a notebook" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                {notebooks.map((nb) => (
                  <SelectItem key={nb.id} value={nb.id} className="text-white hover:bg-white/10">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      {nb.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <div className="p-4 border-b border-white/10">
        <SourceUploader onFilesUploaded={onFilesUploaded} isUploading={isUploading} />
        
        {/* URL and YouTube inputs */}
        <div className="mt-4 space-y-2">
          {!showUrlInput && !showYoutubeInput && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUrlInput(true)}
                className="flex-1 text-white/60 hover:text-white hover:bg-white/10 border border-white/10"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Add URL
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowYoutubeInput(true)}
                className="flex-1 text-white/60 hover:text-white hover:bg-white/10 border border-white/10"
              >
                <Youtube className="w-4 h-4 mr-2" />
                YouTube
              </Button>
            </div>
          )}
          
          {showUrlInput && (
            <div className="flex gap-2">
              <Input
                placeholder="https://..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                autoFocus
              />
              <Button onClick={handleAddUrl} size="sm" className="bg-[#e63946] hover:bg-[#e63946]/90">
                Add
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setShowUrlInput(false); setUrlInput(''); }}
                className="text-white/60"
              >
                Cancel
              </Button>
            </div>
          )}
          
          {showYoutubeInput && (
            <div className="flex gap-2">
              <Input
                placeholder="YouTube URL..."
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                onKeyDown={(e) => e.key === 'Enter' && handleAddYoutube()}
                autoFocus
              />
              <Button onClick={handleAddYoutube} size="sm" className="bg-[#e63946] hover:bg-[#e63946]/90">
                Add
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setShowYoutubeInput(false); setYoutubeInput(''); }}
                className="text-white/60"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Sources List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {sources.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">
              No sources added yet. Upload files or add URLs to get started.
            </p>
          ) : (
            sources.map((source) => {
              const Icon = SOURCE_ICONS[source.type] || File;
              return (
                <div
                  key={source.id}
                  className="group flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors"
                >
                  <Icon className="w-5 h-5 text-white/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{source.name}</p>
                    {source.charCount && (
                      <p className="text-xs text-white/40">{Math.round(source.charCount / 1000)}k chars</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveSource(source.id)}
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-white/40 hover:text-[#e63946] hover:bg-transparent transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
