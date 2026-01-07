import { useState, useRef } from 'react';
import { 
  Download, 
  Share2, 
  Edit, 
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  FileText,
  Table2,
  Presentation,
  Image as ImageIcon,
  Search,
  Music,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

type PreviewType = 'slides' | 'document' | 'spreadsheet' | 'design' | 'research' | 'audio' | 'video' | 'unknown';

interface SlideData {
  index: number;
  title?: string;
  content?: string;
  thumbnail_url?: string;
  image_url?: string;
}

interface SpreadsheetData {
  headers: string[];
  rows: (string | number)[][];
}

interface Citation {
  number: number;
  title: string;
  url?: string;
  source?: string;
}

interface PreviewPanelProps {
  taskType: string;
  content?: any;
  outputs?: Array<{
    id: string;
    file_name: string;
    output_type: string;
    download_url?: string;
    preview_url?: string;
    file_size_bytes?: number;
  }>;
  isLoading?: boolean;
  onDownload?: (outputId: string) => void;
  onShare?: () => void;
  onEdit?: () => void;
  onFullscreen?: () => void;
}

// Slides Preview Component
function SlidesPreview({ slides, currentSlide, onSlideChange }: {
  slides: SlideData[];
  currentSlide: number;
  onSlideChange: (index: number) => void;
}) {
  if (slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Presentation className="w-12 h-12 mb-3" />
        <p className="text-sm">No slides generated yet</p>
      </div>
    );
  }

  const slide = slides[currentSlide] || slides[0];

  return (
    <div className="space-y-4">
      {/* Main slide view */}
      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
        {slide.image_url || slide.thumbnail_url ? (
          <img 
            src={slide.image_url || slide.thumbnail_url} 
            alt={`Slide ${currentSlide + 1}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
            {slide.title && (
              <h3 className="text-xl font-semibold text-gray-900 mb-4">{slide.title}</h3>
            )}
            {slide.content && (
              <p className="text-gray-600">{slide.content}</p>
            )}
          </div>
        )}
        
        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() => onSlideChange(Math.max(0, currentSlide - 1))}
              disabled={currentSlide === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={() => onSlideChange(Math.min(slides.length - 1, currentSlide + 1))}
              disabled={currentSlide === slides.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </>
        )}
        
        {/* Slide counter */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          {currentSlide + 1} / {slides.length}
        </div>
      </div>
      
      {/* Thumbnail carousel */}
      {slides.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {slides.map((s, idx) => (
            <button
              key={idx}
              onClick={() => onSlideChange(idx)}
              className={cn(
                "flex-shrink-0 w-20 h-12 rounded border-2 overflow-hidden transition-all",
                currentSlide === idx 
                  ? "border-teal-500 ring-2 ring-teal-200" 
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              {s.thumbnail_url ? (
                <img src={s.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                  {idx + 1}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Document Preview Component
function DocumentPreview({ content, markdownContent }: { content?: string; markdownContent?: string }) {
  const displayContent = markdownContent || content;
  
  if (!displayContent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <FileText className="w-12 h-12 mb-3" />
        <p className="text-sm">No document content yet</p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown>{displayContent}</ReactMarkdown>
    </div>
  );
}

// Spreadsheet Preview Component
function SpreadsheetPreview({ data }: { data?: SpreadsheetData }) {
  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Table2 className="w-12 h-12 mb-3" />
        <p className="text-sm">No spreadsheet data yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[400px] border border-gray-200 rounded-lg">
      <table className="w-full text-sm">
        {data.headers && data.headers.length > 0 && (
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {data.headers.map((header, idx) => (
                <th 
                  key={idx}
                  className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100">
          {data.rows.slice(0, 50).map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50">
              {row.map((cell, cellIdx) => (
                <td 
                  key={cellIdx}
                  className="px-3 py-2 text-gray-600 whitespace-nowrap"
                >
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.rows.length > 50 && (
        <div className="p-3 bg-gray-50 text-center text-xs text-gray-500 border-t">
          Showing 50 of {data.rows.length} rows
        </div>
      )}
    </div>
  );
}

// Image Preview Component
function ImagePreview({ imageUrl, alt }: { imageUrl?: string; alt?: string }) {
  const [zoom, setZoom] = useState(1);

  if (!imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <ImageIcon className="w-12 h-12 mb-3" />
        <p className="text-sm">No image generated yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-auto max-h-[500px] bg-gray-100 rounded-lg">
        <img 
          src={imageUrl} 
          alt={alt || 'Generated image'}
          className="mx-auto transition-transform"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
      
      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 rounded-lg shadow p-1">
        <button
          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          className="p-1.5 hover:bg-gray-100 rounded"
          disabled={zoom <= 0.5}
        >
          <ZoomOut className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-xs text-gray-600 px-2">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          className="p-1.5 hover:bg-gray-100 rounded"
          disabled={zoom >= 3}
        >
          <ZoomIn className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}

// Research Preview Component
function ResearchPreview({ content, citations }: { content?: string; citations?: Citation[] }) {
  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Search className="w-12 h-12 mb-3" />
        <p className="text-sm">No research report yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report content */}
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      
      {/* Citations */}
      {citations && citations.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Sources</h4>
          <div className="space-y-2">
            {citations.map((citation) => (
              <div 
                key={citation.number}
                className="flex items-start gap-2 text-sm"
              >
                <span className="text-teal-600 font-medium">[{citation.number}]</span>
                <div className="flex-1">
                  <span className="text-gray-900">{citation.title}</span>
                  {citation.source && (
                    <span className="text-gray-500 ml-1">- {citation.source}</span>
                  )}
                  {citation.url && (
                    <a 
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-teal-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Audio Preview Component
function AudioPreview({ audioUrl, duration }: { audioUrl?: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  if (!audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Music className="w-12 h-12 mb-3" />
        <p className="text-sm">No audio generated yet</p>
      </div>
    );
  }

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const audioDuration = duration || audioRef.current?.duration || 0;

  return (
    <div className="bg-gray-100 rounded-lg p-6">
      <audio 
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={() => {}}
      />
      
      {/* Waveform placeholder */}
      <div className="h-16 bg-gray-200 rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
        <div className="flex items-end gap-0.5 h-12">
          {Array.from({ length: 50 }).map((_, i) => (
            <div 
              key={i}
              className={cn(
                "w-1 rounded-full transition-all",
                i / 50 < currentTime / audioDuration 
                  ? "bg-teal-500" 
                  : "bg-gray-400"
              )}
              style={{ 
                height: `${20 + Math.random() * 60}%`,
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-teal-600 hover:bg-teal-700 flex items-center justify-center text-white transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>
        
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max={audioDuration || 100}
            value={currentTime}
            onChange={(e) => {
              const time = parseFloat(e.target.value);
              if (audioRef.current) {
                audioRef.current.currentTime = time;
              }
              setCurrentTime(time);
            }}
            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-teal-600"
          />
        </div>
        
        <span className="text-sm text-gray-600 min-w-[70px] text-right">
          {formatTime(currentTime)} / {formatTime(audioDuration)}
        </span>
        
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-gray-600" />
          ) : (
            <Volume2 className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>
    </div>
  );
}

// Loading skeleton
function PreviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-64 bg-gray-100 rounded-lg" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

export function PreviewPanel({
  taskType,
  content,
  outputs = [],
  isLoading,
  onDownload,
  onShare,
  onEdit,
  onFullscreen,
}: PreviewPanelProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const getPreviewType = (): PreviewType => {
    const type = taskType?.toLowerCase();
    if (type?.includes('slide') || type?.includes('presentation')) return 'slides';
    if (type?.includes('doc') || type?.includes('report') || type?.includes('playbook')) return 'document';
    if (type?.includes('spread') || type?.includes('sheet') || type?.includes('csv') || type?.includes('excel')) return 'spreadsheet';
    if (type?.includes('design') || type?.includes('image') || type?.includes('visual')) return 'design';
    if (type?.includes('research')) return 'research';
    if (type?.includes('audio') || type?.includes('podcast') || type?.includes('speech')) return 'audio';
    if (type?.includes('video')) return 'video';
    return 'unknown';
  };

  const previewType = getPreviewType();
  const primaryOutput = outputs[0];

  const getPreviewIcon = () => {
    switch (previewType) {
      case 'slides': return Presentation;
      case 'document': return FileText;
      case 'spreadsheet': return Table2;
      case 'design': return ImageIcon;
      case 'research': return Search;
      case 'audio': return Music;
      default: return FileText;
    }
  };

  const PreviewIcon = getPreviewIcon();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Actions bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <PreviewIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 capitalize">{previewType} Preview</span>
        </div>
        
        <div className="flex items-center gap-1">
          {primaryOutput?.download_url && onDownload && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onDownload(primaryOutput.id)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
          {onShare && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onShare}
              className="text-gray-600 hover:text-gray-900"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
          {onEdit && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onEdit}
              className="text-gray-600 hover:text-gray-900"
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}
          {onFullscreen && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onFullscreen}
              className="text-gray-600 hover:text-gray-900"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <PreviewSkeleton />
        ) : (
          <>
            {previewType === 'slides' && (
              <SlidesPreview 
                slides={content?.slides || []}
                currentSlide={currentSlide}
                onSlideChange={setCurrentSlide}
              />
            )}
            
            {previewType === 'document' && (
              <DocumentPreview 
                content={content?.text}
                markdownContent={content?.markdown}
              />
            )}
            
            {previewType === 'spreadsheet' && (
              <SpreadsheetPreview data={content?.data} />
            )}
            
            {previewType === 'design' && (
              <ImagePreview 
                imageUrl={primaryOutput?.preview_url || content?.image_url}
                alt={content?.alt || primaryOutput?.file_name}
              />
            )}
            
            {previewType === 'research' && (
              <ResearchPreview 
                content={content?.report || content?.text}
                citations={content?.citations}
              />
            )}
            
            {previewType === 'audio' && (
              <AudioPreview 
                audioUrl={primaryOutput?.download_url || content?.audio_url}
                duration={content?.duration}
              />
            )}
            
            {previewType === 'unknown' && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <FileText className="w-12 h-12 mb-3" />
                <p className="text-sm">Preview not available for this content type</p>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Output files list */}
      {outputs.length > 0 && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Generated Files
          </div>
          <div className="flex flex-wrap gap-2">
            {outputs.map((output) => (
              <a
                key={output.id}
                href={output.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-gray-400" />
                <span className="truncate max-w-[120px]">{output.file_name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
