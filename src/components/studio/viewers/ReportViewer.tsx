import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, Download, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ReportSection {
  heading: string;
  content: string;
}

interface ReportViewerProps {
  title?: string;
  content?: string;
  sections?: ReportSection[];
  citations?: Array<{
    source_id: string;
    source_name: string;
    text: string;
  }>;
}

export function ReportViewer({ title, content, sections, citations }: ReportViewerProps) {
  const [copied, setCopied] = useState(false);

  const fullContent = content || sections?.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n') || '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fullContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'report'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!content && (!sections || sections.length === 0)) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground">No report content available.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          {title && <h3 className="text-lg font-medium text-foreground">{title}</h3>}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-[500px]">
        <div className="p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {content ? (
              <ReactMarkdown>{content}</ReactMarkdown>
            ) : (
              sections?.map((section, i) => (
                <div key={i} className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-2">{section.heading}</h3>
                  <div className="text-muted-foreground whitespace-pre-wrap">{section.content}</div>
                </div>
              ))
            )}
          </div>

          {/* Citations */}
          {citations && citations.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Sources</h4>
              <div className="space-y-3">
                {citations.map((citation, i) => (
                  <div key={i} className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-foreground">{citation.source_name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{citation.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
