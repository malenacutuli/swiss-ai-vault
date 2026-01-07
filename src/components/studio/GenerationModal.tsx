import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useArtifactJob } from '@/hooks/useArtifactJob';
import { Loader2, AlertCircle, CheckCircle, X, RotateCw } from 'lucide-react';
import {
  AudioPlayer,
  QuizViewer,
  FlashcardViewer,
  MindMapViewer,
  SlidesViewer,
  MarkdownViewer,
  FAQViewer,
  TimelineViewer,
  DataTableViewer,
} from './viewers';

interface GenerationModalProps {
  open: boolean;
  onClose: () => void;
  jobId: string | null;
  outputType: string;
  onRetry?: () => void;
}

const OUTPUT_TYPE_TITLES: Record<string, string> = {
  podcast: 'Podcast',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map',
  slides: 'Slides',
  report: 'Report',
  study_guide: 'Study Guide',
  faq: 'FAQ',
  timeline: 'Timeline',
  table: 'Data Table',
};

export function GenerationModal({
  open,
  onClose,
  jobId,
  outputType,
  onRetry,
}: GenerationModalProps) {
  const { job, loading, error, isCompleted, isFailed, retry } = useArtifactJob(jobId);

  const title = OUTPUT_TYPE_TITLES[outputType] || 'Output';

  const renderContent = () => {
    // Loading state
    if (loading || (jobId && !job)) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-12 h-12 text-[#e63946] animate-spin" />
          <div className="text-center">
            <p className="text-white font-medium">Generating {title}...</p>
            <p className="text-sm text-white/50 mt-1">
              {job?.status === 'processing' ? 'Processing your sources' : 'Starting generation'}
            </p>
          </div>
        </div>
      );
    }

    // Error state
    if (error || isFailed) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <div className="text-center">
            <p className="text-white font-medium">Generation Failed</p>
            <p className="text-sm text-white/50 mt-1">
              {error || job?.error_message || 'An error occurred during generation.'}
            </p>
          </div>
          <Button
            onClick={onRetry || retry}
            className="mt-2 bg-[#e63946] hover:bg-[#e63946]/90"
          >
            <RotateCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      );
    }

    // Completed state - render appropriate viewer
    if (isCompleted && job) {
      return renderViewer();
    }

    // Initial state
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-white/40" />
        </div>
        <p className="text-white/50">Ready to generate</p>
      </div>
    );
  };

  const renderViewer = () => {
    const metadata = job?.result_metadata || {};
    
    switch (outputType) {
      case 'podcast':
        return (
          <AudioPlayer
            url={metadata.audio_url || ''}
            title={metadata.title}
            transcript={metadata.transcript}
          />
        );
      
      case 'quiz':
        return (
          <QuizViewer
            questions={metadata.questions || []}
            title={metadata.title}
          />
        );
      
      case 'flashcards':
        return (
          <FlashcardViewer
            cards={metadata.cards || []}
            title={metadata.title}
          />
        );
      
      case 'mindmap':
        return (
          <MindMapViewer
            nodes={metadata.nodes || []}
          />
        );
      
      case 'slides':
        return (
          <SlidesViewer
            slides={metadata.slides || []}
            title={metadata.title}
          />
        );
      
      case 'report':
      case 'study_guide':
        return (
          <MarkdownViewer
            content={metadata.content || ''}
            title={metadata.title}
          />
        );
      
      case 'faq':
        return (
          <FAQViewer
            items={metadata.items || []}
            title={metadata.title}
          />
        );
      
      case 'timeline':
        return (
          <TimelineViewer
            events={metadata.events || []}
            title={metadata.title}
          />
        );
      
      case 'table':
        return (
          <DataTableViewer
            data={metadata.data || []}
            columns={metadata.columns || []}
            title={metadata.title}
          />
        );
      
      default:
        return (
          <div className="p-4 bg-white/5 rounded-lg">
            <pre className="text-white/70 text-sm whitespace-pre-wrap">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-[#1a1a2e] border-white/10">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-white">{title}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>
        
        <div className="overflow-auto max-h-[calc(90vh-100px)]">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
