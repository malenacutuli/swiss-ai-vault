import { useState, useRef } from 'react';
import { Upload, FileText, Link, X, Loader2 } from 'lucide-react';

export interface Source {
  id: string;
  type: 'file' | 'url' | 'text';
  name: string;
  url?: string;
  file?: File;
  mimeType?: string;
  content?: string; // For text sources
  title?: string; // Optional title for URLs
}

interface SourceUploadProps {
  sources: Source[];
  onSourcesChange: (sources: Source[]) => void;
  isUploading?: boolean;
  title?: string;
  description?: string;
}

export function SourceUpload({ 
  sources, 
  onSourcesChange, 
  isUploading = false,
  title = "Add sources",
  description = "Upload documents, paste URLs, or add YouTube links."
}: SourceUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const newSources: Source[] = files.map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'file',
      name: file.name,
      file,
      mimeType: file.type,
    }));
    
    onSourcesChange([...sources, ...newSources]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newSources: Source[] = files.map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'file',
      name: file.name,
      file,
      mimeType: file.type,
    }));
    
    onSourcesChange([...sources, ...newSources]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUrlAdd = (url: string) => {
    if (!url.trim()) return;
    
    const newSource: Source = {
      id: `url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'url',
      name: url,
      url,
    };
    
    onSourcesChange([...sources, newSource]);
  };

  const handleRemove = (index: number) => {
    onSourcesChange(sources.filter((_, i) => i !== index));
  };

  return (
    <section className="bg-white rounded-xl border border-[#E5E5E5] p-6">
      <h3 className="font-medium text-[#1A1A1A] mb-2">{title}</h3>
      <p className="text-sm text-[#666666] mb-4">{description}</p>
      
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging 
            ? 'border-[#722F37] bg-[#722F37]/5' 
            : 'border-[#E5E5E5] hover:border-[#722F37]'
        }`}
      >
        {isUploading ? (
          <Loader2 className="w-8 h-8 mx-auto text-[#722F37] animate-spin" />
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto text-[#999999] mb-2" />
            <p className="text-sm text-[#666666]">
              Drag files here or{' '}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-[#722F37] hover:underline font-medium"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-[#999999] mt-1">
              PDF, DOCX, XLSX, TXT, Images, Audio, Video
            </p>
          </>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.png,.jpg,.jpeg,.mp3,.wav,.mp4,.webm"
        className="hidden"
        onChange={handleFileSelect}
      />
      
      {/* URL input */}
      <div className="mt-4">
        <input
          type="url"
          placeholder="Or paste a URL (webpage, YouTube, etc.)"
          className="w-full border border-[#E5E5E5] rounded-lg p-2.5 text-sm placeholder-[#999999] focus:outline-none focus:ring-2 focus:ring-[#722F37]/20 focus:border-[#722F37]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleUrlAdd((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = '';
            }
          }}
        />
      </div>
      
      {/* Source list */}
      {sources.length > 0 && (
        <div className="mt-4 space-y-2">
          {sources.map((source, i) => (
            <div 
              key={source.id} 
              className="flex items-center gap-2 p-2.5 bg-[#FAFAF8] rounded-lg border border-[#E5E5E5]"
            >
              {source.type === 'url' ? (
                <Link className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-[#666666] flex-shrink-0" />
              )}
              <span className="text-sm flex-1 truncate text-[#4A4A4A]">{source.name}</span>
              <button
                onClick={() => handleRemove(i)}
                className="text-[#999999] hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
