import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Search, ChevronDown, Copy, Check, Expand, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQViewerProps {
  items: FAQItem[];
  title?: string;
}

export function FAQViewer({ items, title }: FAQViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenItems(new Set(filteredItems.map((item) => item.id)));
  };

  const collapseAll = () => {
    setOpenItems(new Set());
  };

  const copyQA = (item: FAQItem) => {
    const text = `Q: ${item.question}\n\nA: ${item.answer}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (items.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-white/60">No FAQ items available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        {title && <h3 className="text-lg font-medium text-white mb-4">{title}</h3>}

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <Expand className="w-4 h-4 mr-1" />
            Expand All
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <Minimize2 className="w-4 h-4 mr-1" />
            Collapse All
          </Button>
        </div>
      </div>

      {/* FAQ List */}
      <ScrollArea className="h-[500px]">
        <div className="p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <p className="text-center text-white/40 py-8">
              No results found for "{searchQuery}"
            </p>
          ) : (
            filteredItems.map((item) => {
              const isOpen = openItems.has(item.id);

              return (
                <Collapsible key={item.id} open={isOpen} onOpenChange={() => toggleItem(item.id)}>
                  <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors">
                      <span className="font-medium text-white pr-4">{item.question}</span>
                      <ChevronDown
                        className={cn(
                          'w-5 h-5 text-white/40 transition-transform shrink-0',
                          isOpen && 'rotate-180'
                        )}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-0">
                        <div className="pt-3 border-t border-white/10">
                          <p className="text-white/70 leading-relaxed">{item.answer}</p>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyQA(item)}
                            className="mt-3 text-white/40 hover:text-white hover:bg-white/10"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-4 h-4 mr-1 text-green-400" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 mr-1" />
                                Copy Q&A
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 text-center">
        <span className="text-sm text-white/40">
          {filteredItems.length} of {items.length} questions
        </span>
      </div>
    </div>
  );
}
