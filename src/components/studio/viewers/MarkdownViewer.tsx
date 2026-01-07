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
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-white/60">No content available.</p>
      </div>
    );
  }

  let headingIndex = 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      {(title || toc.length > 0) && (
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {title && <h3 className="text-lg font-medium text-white">{title}</h3>}
          {toc.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTOC(!showTOC)}
              className="text-white/60 hover:text-white hover:bg-white/10"
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
          <div className="w-64 border-r border-white/10 p-4 shrink-0">
            <h4 className="text-sm font-medium text-white/60 mb-3">Contents</h4>
            <ScrollArea className="h-[400px]">
              <nav className="space-y-1">
                {toc.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToHeading(item.id)}
                    className={cn(
                      'block text-left text-sm text-white/60 hover:text-white transition-colors w-full truncate',
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
          <div className="p-6 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => {
                  const id = `heading-${headingIndex++}`;
                  return (
                    <h1 id={id} className="text-2xl font-semibold text-white mt-6 mb-4 scroll-mt-4">
                      {children}
                    </h1>
                  );
                },
                h2: ({ children }) => {
                  const id = `heading-${headingIndex++}`;
                  return (
                    <h2 id={id} className="text-xl font-medium text-white mt-5 mb-3 scroll-mt-4">
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const id = `heading-${headingIndex++}`;
                  return (
                    <h3 id={id} className="text-lg font-medium text-white mt-4 mb-2 scroll-mt-4">
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => <p className="text-white/80 mb-4 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside text-white/80 mb-4 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside text-white/80 mb-4 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-white/80">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-[#e63946] pl-4 my-4 text-white/60 italic">
                    {children}
                  </blockquote>
                ),
                code: ({ className, children }) => {
                  const isInline = !className;
                  const code = String(children).replace(/\n$/, '');

                  if (isInline) {
                    return (
                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#e63946] text-sm">
                        {children}
                      </code>
                    );
                  }

                  return (
                    <div className="relative group my-4">
                      <pre className="bg-white/5 border border-white/10 rounded-lg p-4 overflow-x-auto">
                        <code className="text-sm text-white/80">{children}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyCode(code)}
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white hover:bg-white/10"
                      >
                        {copiedCode === code ? (
                          <Check className="w-4 h-4 text-green-400" />
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
                    className="text-[#e63946] hover:underline"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="border-white/10 my-6" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border border-white/10 rounded-lg">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="bg-white/5 border border-white/10 px-4 py-2 text-left text-white font-medium">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-white/10 px-4 py-2 text-white/80">{children}</td>
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
