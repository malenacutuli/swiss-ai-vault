import { useMemo } from 'react';
import { parseAgentOutput, Flashcard, QuizQuestion } from '@/lib/parseAgentOutput';
import { FlashcardViewer } from '@/components/studio/viewers/FlashcardViewer';
import { QuizViewer } from '@/components/studio/viewers/QuizViewer';
import { MarkdownViewer } from '@/components/studio/viewers/MarkdownViewer';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AgentOutputRendererProps {
  content: string;
  outputType?: string;
  fileName?: string;
  onDownload?: () => void;
  className?: string;
}

export function AgentOutputRenderer({ 
  content, 
  outputType, 
  fileName, 
  onDownload,
  className 
}: AgentOutputRendererProps) {
  const parsed = useMemo(() => parseAgentOutput(content, outputType), [content, outputType]);

  // File download UI
  if (outputType === 'file' || fileName) {
    return (
      <div className={`flex items-center justify-between p-4 rounded-lg bg-card border border-border ${className || ''}`}>
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">{fileName || 'Generated File'}</p>
            <p className="text-xs text-muted-foreground">{outputType?.toUpperCase()}</p>
          </div>
        </div>
        {onDownload && (
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        )}
      </div>
    );
  }

  // Flashcards
  if (parsed.type === 'flashcards' && Array.isArray(parsed.data) && parsed.data.length > 0) {
    return (
      <div className={className}>
        <FlashcardViewer cards={parsed.data as Flashcard[]} />
      </div>
    );
  }

  // Quiz
  if (parsed.type === 'quiz' && Array.isArray(parsed.data) && parsed.data.length > 0) {
    return (
      <div className={className}>
        <QuizViewer questions={parsed.data as QuizQuestion[]} />
      </div>
    );
  }

  // Default: Markdown
  return (
    <div className={className}>
      <MarkdownViewer content={typeof parsed.data === 'string' ? parsed.data : String(parsed.data)} />
    </div>
  );
}
