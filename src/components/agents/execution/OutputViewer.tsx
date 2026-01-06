import React, { useState } from 'react';
import { generatePPTX, downloadPPTX, uploadPPTX, SlideContent, PPTXOptions } from '@/lib/document-generators/pptx-generator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';

interface OutputViewerProps {
  output: {
    id: string;
    output_type: string;
    file_name: string;
    download_url?: string;
    file_path?: string;
    preview_url?: string;
    mime_type?: string;
    file_size_bytes?: number;
  };
  metadata?: {
    target_type?: string;
    requires_client_generation?: boolean;
    title?: string;
    slide_count?: number;
    generated_by?: string;
  };
  taskId: string;
}

export const OutputViewer: React.FC<OutputViewerProps> = ({ output, metadata, taskId }) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const needsClientGeneration = metadata?.requires_client_generation;
  const targetType = metadata?.target_type;

  const handleGenerateDocument = async () => {
    if (!user || !output.download_url) return;

    setIsGenerating(true);
    toast.info('Generating document...');

    try {
      // Fetch the JSON data
      const response = await fetch(output.download_url);
      const data = await response.json();

      if (targetType === 'pptx' && data.slides) {
        // Generate PPTX client-side
        const slides: SlideContent[] = data.slides.map((slide: any) => ({
          title: slide.title || slide.step_name || 'Slide',
          content: Array.isArray(slide.content) 
            ? slide.content 
            : [slide.content || slide.step_description || ''],
          notes: slide.notes,
          layout: slide.layout || 'content',
        }));

        const options: PPTXOptions = {
          title: data.title || 'Presentation',
          theme: 'swiss',
          author: user.email || 'Ghost User',
          company: 'Ghost AI',
        };

        const blob = await generatePPTX(slides, options);
        const filename = `presentation-${Date.now()}.pptx`;

        // Upload to storage
        const url = await uploadPPTX(blob, user.id, filename, supabase);

        if (url) {
          setGeneratedUrl(url);
          toast.success('Presentation generated successfully!');

          // Update the output record
          await supabase
            .from('agent_outputs')
            .update({
              output_type: 'pptx',
              file_name: filename,
              download_url: url,
              mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            })
            .eq('id', output.id);
        } else {
          // Just download if upload fails
          downloadPPTX(blob, filename);
          toast.success('Presentation downloaded!');
        }
      }
      // Add similar handlers for docx, xlsx here

    } catch (err: any) {
      console.error('Generation error:', err);
      toast.error('Failed to generate document: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const displayUrl = generatedUrl || output.download_url;
  const displayType = generatedUrl ? targetType : output.output_type;
  const displayName = generatedUrl 
    ? `presentation-${Date.now()}.pptx`
    : output.file_name;

  const getTypeBadgeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'pptx':
        return 'bg-orange-500/20 text-orange-400';
      case 'docx':
        return 'bg-blue-500/20 text-blue-400';
      case 'xlsx':
        return 'bg-green-500/20 text-green-400';
      case 'pdf':
        return 'bg-red-500/20 text-red-400';
      case 'md':
        return 'bg-purple-500/20 text-purple-400';
      case 'json':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'image':
      case 'png':
      case 'jpg':
        return 'bg-pink-500/20 text-pink-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {/* File icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* File type badge - NO EMOJIS */}
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded uppercase",
                getTypeBadgeColor(displayType || 'file')
              )}>
                {(displayType || 'FILE').toUpperCase()}
              </span>
              
              <span className="text-sm font-medium text-foreground truncate">
                {displayName}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1">
              {metadata?.slide_count && (
                <span className="text-xs text-muted-foreground">
                  {metadata.slide_count} slides
                </span>
              )}
              {output.file_size_bytes && (
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(output.file_size_bytes)}
                </span>
              )}
              {metadata?.generated_by && (
                <span className="text-xs text-muted-foreground">
                  via {metadata.generated_by}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {needsClientGeneration && !generatedUrl ? (
            <Button
              size="sm"
              onClick={handleGenerateDocument}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                `Generate ${targetType?.toUpperCase()}`
              )}
            </Button>
          ) : displayUrl ? (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="gap-2"
            >
              <a href={displayUrl} download={displayName} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" />
                Download
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Preview for images */}
      {output.preview_url && output.output_type?.startsWith('image') && (
        <div className="border-t border-border">
          <img 
            src={output.preview_url} 
            alt={output.file_name}
            className="w-full max-h-64 object-contain bg-muted/50"
          />
        </div>
      )}

      {/* Success message */}
      {generatedUrl && (
        <div className="px-4 py-3 border-t border-border bg-primary/5">
          <p className="text-sm text-primary">
            Document generated successfully! Click Download to save.
          </p>
        </div>
      )}
    </div>
  );
};

export default OutputViewer;
