import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Quote, Loader2, Copy, Save, Check, FileText, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export interface Citation {
  index: number;
  source_id: string;
  source_title: string;
  text: string;
  page_number?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  suggestedQuestion?: string;
}

interface GroundedChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
  onCitationClick: (citation: Citation) => void;
  onSaveToNotes: (content: string, sourceQuery?: string) => void;
  sourceCount?: number;
}

// Generate a suggested follow-up question based on the response
function generateSuggestedQuestion(content: string): string | undefined {
  const keywords = content
    .split(/\s+/)
    .filter(word => word.length > 5)
    .slice(0, 10);
  
  if (keywords.length < 2) return undefined;
  
  const questionTemplates = [
    `Can you explain more about how ${keywords[0]} relates to ${keywords[1]}?`,
    `What are the implications of ${keywords[0]}?`,
    `How does ${keywords[0]} compare to alternative approaches?`,
    `What are the key challenges related to ${keywords[0]}?`,
    `Can you provide examples of ${keywords[0]} in practice?`,
  ];
  
  return questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
}

export function GroundedChat({
  messages,
  isLoading,
  onSendMessage,
  onCitationClick,
  onSaveToNotes,
  sourceCount = 0,
}: GroundedChatProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Generate suggested questions for messages
  const messagesWithSuggestions = useMemo(() => {
    return messages.map((msg, idx) => {
      if (msg.role === 'assistant' && idx === messages.length - 1 && !msg.suggestedQuestion) {
        return { ...msg, suggestedQuestion: generateSuggestedQuestion(msg.content) };
      }
      return msg;
    });
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle send
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');
    await onSendMessage(message);
  };

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  // Handle copy
  const handleCopy = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  // Handle save to notes
  const handleSave = (message: ChatMessage) => {
    // Find the preceding user message as the source query
    const messageIndex = messages.findIndex(m => m.id === message.id);
    const userMessage = messages
      .slice(0, messageIndex)
      .reverse()
      .find(m => m.role === 'user');
    
    onSaveToNotes(message.content, userMessage?.content);
    setSavedId(message.id);
    setTimeout(() => setSavedId(null), 2000);
    toast({ title: 'Saved to notes' });
  };

  // Render message content with citation markers
  const renderContent = (content: string, citations?: Citation[]) => {
    if (!citations || citations.length === 0) {
      return <p className="text-sm whitespace-pre-wrap">{content}</p>;
    }

    // Replace citation markers with interactive badges
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const citationPattern = /\[(\d+)\]/g;
    let match;

    while ((match = citationPattern.exec(content)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }

      // Add citation badge
      const citationNumber = parseInt(match[1], 10);
      const citation = citations.find(c => c.index === citationNumber);
      
      if (citation) {
        parts.push(
          <button
            key={`citation-${match.index}`}
            onClick={() => onCitationClick(citation)}
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5',
              'text-xs font-medium rounded',
              'bg-primary/10 text-primary hover:bg-primary/20',
              'transition-colors cursor-pointer'
            )}
          >
            <FileText className="w-3 h-3" />
            [{citation.index}]
          </button>
        );
      } else {
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return <p className="text-sm whitespace-pre-wrap">{parts}</p>;
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">
      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messagesWithSuggestions.length === 0 ? (
            <div className="text-center py-16">
              <Quote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Ask a question about your sources
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Responses will include citations to help you verify the information
              </p>
            </div>
          ) : (
            messagesWithSuggestions.map(message => (
              <div
                key={message.id}
                className={cn(
                  'flex flex-col',
                  message.role === 'user' ? 'items-end' : 'items-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg p-3',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {renderContent(message.content, message.citations)}

                  {/* Citation summary for assistant messages */}
                  {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">
                        Sources cited:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {message.citations.map(citation => (
                          <button
                            key={`summary-${citation.index}`}
                            onClick={() => onCitationClick(citation)}
                            className={cn(
                              'text-xs px-2 py-1 rounded-full',
                              'bg-background/50 text-muted-foreground',
                              'hover:bg-background hover:text-foreground',
                              'transition-colors'
                            )}
                          >
                            [{citation.index}] {citation.source_title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions for assistant messages */}
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleCopy(message.id, message.content)}
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleSave(message)}
                      >
                        {savedId === message.id ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Save className="w-3 h-3 mr-1" />
                            Save to Notes
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Suggested follow-up question */}
                {message.role === 'assistant' && message.suggestedQuestion && (
                  <div className="mt-2 max-w-[85%]">
                    <button
                      onClick={() => handleSuggestedQuestion(message.suggestedQuestion!)}
                      className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors text-left"
                    >
                      <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground hover:text-foreground">
                        {message.suggestedQuestion}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Searching sources...
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t border-border bg-muted/30">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={sourceCount === 0 ? "Add sources first..." : "Ask about your sources..."}
              className="min-h-[44px] max-h-[120px] text-sm resize-none pr-20"
              disabled={isLoading || sourceCount === 0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {/* Source count badge */}
            <div className="absolute right-2 bottom-2">
              <span className={cn(
                "text-xs px-2 py-1 rounded-full",
                sourceCount > 0 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted text-muted-foreground"
              )}>
                {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
              </span>
            </div>
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || sourceCount === 0}
            className="shrink-0 h-[44px] px-4"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
