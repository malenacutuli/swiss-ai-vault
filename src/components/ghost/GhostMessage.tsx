import { useMemo, useState } from 'react';
import { CodeBlock } from './CodeBlock';
import { GhostMessageActions } from './GhostMessageActions';
import { cn } from '@/lib/utils';
import { ExternalLink, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GhostMessageProps {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp?: number;
  isStreaming?: boolean;
  showDate?: boolean;
  showExternalLinkWarning?: boolean;
  responseTimeMs?: number;
  tokenCount?: number;
  contextUsagePercent?: number;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onFork?: (messageId: string) => void;
  onShorten?: (messageId: string) => void;
  onElaborate?: (messageId: string) => void;
  onCreateImage?: (content: string) => void;
  onCreateVideo?: (content: string) => void;
  onFeedback?: (messageId: string, type: 'good' | 'bad') => void;
  onShare?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
  onStopGeneration?: () => void;
  ttsState?: {
    isPlaying: boolean;
    isPaused: boolean;
    isLoading: boolean;
    progress: number;
    currentMessageId: string | null;
  };
  onSpeak?: (messageId: string, content: string) => void;
  onStopSpeak?: () => void;
}

// Format timestamp for display
function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  return date.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// Parse content into segments of text and code blocks
interface ContentSegment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        segments.push({ type: 'text', content: text });
      }
    }

    // Add the code block
    segments.push({
      type: 'code',
      language: match[1] || '',
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      segments.push({ type: 'text', content: text });
    }
  }

  // If no segments were found, treat entire content as text
  if (segments.length === 0) {
    segments.push({ type: 'text', content });
  }

  return segments;
}

// Check if URL is external
function isExternalUrl(href: string): boolean {
  if (!href?.startsWith('http')) return false;
  const internalDomains = ['swissvault.ai', 'localhost', '127.0.0.1'];
  try {
    const url = new URL(href);
    return !internalDomains.some(domain => url.hostname.includes(domain));
  } catch {
    return false;
  }
}

// Render text content with markdown parsing and link handling
function renderTextContent(
  text: string, 
  onExternalLinkClick?: (url: string) => void,
  showExternalLinkWarning?: boolean
): React.ReactNode {
  // First, handle links [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyCounter = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before this link
    if (match.index > lastIndex) {
      parts.push(
        <TextPart key={keyCounter++} text={text.slice(lastIndex, match.index)} />
      );
    }

    const linkText = match[1];
    const href = match[2];
    const isExternal = isExternalUrl(href);

    parts.push(
      <a
        key={keyCounter++}
        href={href}
        onClick={(e) => {
          if (isExternal && showExternalLinkWarning && onExternalLinkClick) {
            e.preventDefault();
            onExternalLinkClick(href);
          }
        }}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="text-swiss-sapphire hover:underline inline-flex items-center gap-1"
      >
        {linkText}
        {isExternal && <ExternalLink className="w-3 h-3" />}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last link
  if (lastIndex < text.length) {
    parts.push(
      <TextPart key={keyCounter++} text={text.slice(lastIndex)} />
    );
  }

  // If no links found, just render text
  if (parts.length === 0) {
    return <TextPart text={text} />;
  }

  return parts;
}

// Component to render text with inline code, bold, italic
function TextPart({ text }: { text: string }) {
  // Split by inline code first
  const parts = text.split(/(`[^`]+`)/g);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          // Inline code
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 bg-muted rounded text-swiss-sapphire text-sm font-mono"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        
        // Handle **bold** and *italic*
        let processed = part;
        
        // Bold
        processed = processed.replace(
          /\*\*([^*]+)\*\*/g,
          '<strong class="font-semibold">$1</strong>'
        );
        
        // Italic
        processed = processed.replace(
          /\*([^*]+)\*/g,
          '<em class="italic">$1</em>'
        );
        
        if (processed !== part) {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: processed }}
            />
          );
        }
        
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function GhostMessage({ 
  id,
  content, 
  role, 
  timestamp, 
  isStreaming,
  showDate = true,
  showExternalLinkWarning = false,
  responseTimeMs,
  tokenCount,
  contextUsagePercent,
  onRegenerate,
  onEdit,
  onDelete,
  onFork,
  onShorten,
  onElaborate,
  onCreateImage,
  onCreateVideo,
  onFeedback,
  onShare,
  onReport,
  onStopGeneration,
  ttsState,
  onSpeak,
  onStopSpeak,
}: GhostMessageProps) {
  const segments = useMemo(() => parseContent(content), [content]);
  const [externalLinkDialog, setExternalLinkDialog] = useState<{ open: boolean; url: string }>({
    open: false,
    url: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  const handleExternalLinkClick = (url: string) => {
    setExternalLinkDialog({ open: true, url });
  };

  const handleConfirmExternalLink = () => {
    window.open(externalLinkDialog.url, '_blank', 'noopener,noreferrer');
    setExternalLinkDialog({ open: false, url: '' });
  };

  const handleStartEdit = () => {
    setEditedContent(content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent !== content) {
      onEdit?.(id, editedContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  const isSpeaking = ttsState?.isPlaying && ttsState?.currentMessageId === id;

  return (
    <>
      <div className="space-y-3 group">
        {/* Edit button for user messages */}
        {role === 'user' && !isStreaming && onEdit && !isEditing && (
          <div className="flex justify-end mb-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleStartEdit}
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
        )}
        
        {/* Editing UI */}
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} className="gap-1">
                <Check className="w-3 h-3" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="gap-1">
                <X className="w-3 h-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {segments.map((segment, index) => {
              if (segment.type === 'code') {
                return (
                  <CodeBlock
                    key={index}
                    code={segment.content}
                    language={segment.language}
                  />
                );
              }

              // Text segment - render with markdown parsing and link handling
              return (
                <div key={index} className="text-sm whitespace-pre-wrap leading-relaxed">
                  {renderTextContent(
                    segment.content, 
                    handleExternalLinkClick,
                    showExternalLinkWarning
                  )}
                </div>
              );
            })}
          </>
        )}
        
        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-swiss-navy animate-pulse ml-0.5" />
        )}

        {/* Timestamp */}
        {showDate && timestamp && !isStreaming && !isEditing && (
          <div className="text-xs text-muted-foreground mt-2">
            {formatMessageTime(timestamp)}
          </div>
        )}
        
        {/* Action bar for assistant messages - ALWAYS visible, not just on hover */}
        {role === 'assistant' && !isEditing && !isStreaming && (
          <div className="mt-3 pt-2 border-t border-border/50">
            <GhostMessageActions
              content={content}
              messageId={id}
              responseTimeMs={responseTimeMs}
              tokenCount={tokenCount}
              contextUsagePercent={contextUsagePercent}
              isStreaming={isStreaming}
              onRegenerate={onRegenerate ? () => onRegenerate(id) : undefined}
              onEdit={onEdit ? () => handleStartEdit() : undefined}
              onDelete={onDelete ? () => onDelete(id) : undefined}
              onFork={onFork ? () => onFork(id) : undefined}
              onShorten={onShorten ? () => onShorten(id) : undefined}
              onElaborate={onElaborate ? () => onElaborate(id) : undefined}
              onCreateImage={onCreateImage ? () => onCreateImage(content) : undefined}
              onCreateVideo={onCreateVideo ? () => onCreateVideo(content) : undefined}
              onFeedback={onFeedback ? (type) => onFeedback(id, type) : undefined}
              onShare={onShare ? () => onShare(id) : undefined}
              onReport={onReport ? () => onReport(id) : undefined}
              onSpeak={onSpeak ? () => onSpeak(id, content) : undefined}
              onStopSpeak={onStopSpeak}
              isSpeaking={isSpeaking}
              onStopGeneration={onStopGeneration}
            />
          </div>
        )}
        
        {/* Stop button during streaming */}
        {role === 'assistant' && isStreaming && onStopGeneration && (
          <div className="mt-3">
            <GhostMessageActions
              content={content}
              messageId={id}
              isStreaming={true}
              onStopGeneration={onStopGeneration}
            />
          </div>
        )}
      </div>

      {/* External Link Confirmation Dialog */}
      <AlertDialog 
        open={externalLinkDialog.open} 
        onOpenChange={(open) => setExternalLinkDialog({ open, url: open ? externalLinkDialog.url : '' })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              External Link
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>You are about to visit an external website:</span>
              <code className="block text-sm bg-muted px-3 py-2 rounded break-all">
                {externalLinkDialog.url}
              </code>
              <span className="text-muted-foreground text-xs">
                Make sure you trust this website before proceeding.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExternalLink}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
