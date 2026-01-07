import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, List, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  title?: string;
}

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export function MarkdownViewer({ content, title }: MarkdownViewerProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showTOC, setShowTOC] = useState(true);

  // Extract headings for TOC
  const toc = useMemo(() => {
    const headings: TOCItem[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const id = `heading-${index}`;
        headings.push({ id, text, level });
      }
    });

    return headings;
  }, [content]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!content) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground">No content available.</p>
      </div>
    );
  }

  let headingIndex = 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      {(title || toc.length > 0) && (
        <div className="flex items-center justify-between p-4 border-b border-border">
          {title && <h3 className="text-lg font-medium text-foreground">{title}</h3>}
          {toc.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTOC(!showTOC)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {showTOC ? <X className="w-4 h-4 mr-1" /> : <List className="w-4 h-4 mr-1" />}
              {showTOC ? 'Hide TOC' : 'Show TOC'}
            </Button>
          )}
        </div>
      )}

      <div className="flex">
        {/* TOC Sidebar */}
        {showTOC && toc.length > 0 && (
          <div className="w-64 border-r border-border p-4 shrink-0">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Contents</h4>
            <ScrollArea className="h-[400px]">
              <nav className="space-y-1">
                {toc.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToHeading(item.id)}
                    className={cn(
                      'block text-left text-sm text-muted-foreground hover:text-foreground transition-colors w-full truncate',
                      item.level === 1 && 'font-medium',
                      item.level === 2 && 'pl-3',
                      item.level === 3 && 'pl-6 text-xs',
                      item.level >= 4 && 'pl-9 text-xs'
                    )}
                  >
                    {item.text}
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1 h-[500px]">
          <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => {
                  const id = `heading-${headingIndex++}`;
                  return (
                    <h1 id={id} className="text-2xl font-semibold text-foreground mt-6 mb-4 scroll-mt-4">
                      {children}
                    </h1>
                  );
                },
                h2: ({ children }) => {
                  const id = `heading-${headingIndex++}`;
                  return (
                    <h2 id={id} className="text-xl font-medium text-foreground mt-5 mb-3 scroll-mt-4">
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const id = `heading-${headingIndex++}`;
                  return (
                    <h3 id={id} className="text-lg font-medium text-foreground mt-4 mb-2 scroll-mt-4">
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => <p className="text-foreground/80 mb-4 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside text-foreground/80 mb-4 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside text-foreground/80 mb-4 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-foreground/80">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary pl-4 my-4 text-muted-foreground italic">
                    {children}
                  </blockquote>
                ),
                code: ({ className, children }) => {
                  const isInline = !className;
                  const code = String(children).replace(/\n$/, '');

                  if (isInline) {
                    return (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-sm">
                        {children}
                      </code>
                    );
                  }

                  return (
                    <div className="relative group my-4">
                      <pre className="bg-muted border border-border rounded-lg p-4 overflow-x-auto">
                        <code className="text-sm text-foreground/80">{children}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyCode(code)}
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        {copiedCode === code ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  );
                },
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="border-border my-6" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border border-border rounded-lg">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="bg-muted border border-border px-4 py-2 text-left text-foreground font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-4 py-2 text-foreground/80">{children}</td>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
