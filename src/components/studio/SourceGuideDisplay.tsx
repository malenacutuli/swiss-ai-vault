import React, { useState } from 'react';
import { Sparkles, Copy, ThumbsUp, ThumbsDown, Bookmark, Loader2, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SourceGuideProps {
  guide: {
    title: string;
    summary: string;
    key_topics?: string[];
    suggested_questions?: { text: string; rank: number }[];
    word_count?: number;
  } | null;
  loading: boolean;
  sourceCount: number;
  onQuestionClick: (question: string) => void;
  onSaveToNotes: () => void;
}

export function SourceGuideDisplay({
  guide,
  loading,
  sourceCount,
  onQuestionClick,
  onSaveToNotes
}: SourceGuideProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!guide) return;
    await navigator.clipboard.writeText(guide.summary.replace(/\*\*/g, ''));
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSaveToNotes();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(type);
    toast({ title: type === 'up' ? 'Thanks for the feedback!' : 'We\'ll improve this' });
  };

  // Render summary with **bold** markdown
  const renderSummary = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <span key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-lg font-medium text-foreground">
            Generating Source Guide...
          </p>
          <p className="text-sm text-muted-foreground">
            Analyzing document content
          </p>
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-lg font-medium text-foreground mb-2">
          Add sources to start chatting
        </p>
        <p className="text-sm text-muted-foreground">
          Upload PDFs, websites, or text
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* Header with sparkle icon and title */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            {guide.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
          </p>
        </div>
      </div>

      {/* Summary with bold key terms */}
      <div className="bg-muted/30 rounded-xl p-4 mb-4 border border-border">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {renderSummary(guide.summary)}
        </p>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          className="flex items-center gap-2"
        >
          {saved ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
          {saved ? 'Saved!' : 'Save to notes'}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-8 w-8"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleFeedback('up')}
          className={cn("h-8 w-8", feedback === 'up' && "text-green-500")}
        >
          <ThumbsUp className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleFeedback('down')}
          className={cn("h-8 w-8", feedback === 'down' && "text-red-500")}
        >
          <ThumbsDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Suggested Questions */}
      {guide.suggested_questions && guide.suggested_questions.length > 0 && (
        <div className="space-y-3 mb-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Suggested Questions
          </p>
          {guide.suggested_questions
            .sort((a, b) => a.rank - b.rank)
            .map((q, index) => (
              <button
                key={index}
                onClick={() => onQuestionClick(q.text)}
                className="w-full p-4 text-left border border-border rounded-xl text-sm text-foreground hover:bg-muted/50 hover:border-primary/30 transition-all duration-200"
              >
                {q.text}
              </button>
            ))}
        </div>
      )}

      {/* Key Topics Chips */}
      {guide.key_topics && guide.key_topics.length > 0 && (
        <div className="mt-auto">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Key Topics
          </p>
          <div className="flex flex-wrap gap-2">
            {guide.key_topics.map((topic, index) => (
              <span
                key={index}
                className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
