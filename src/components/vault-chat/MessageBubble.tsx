import { cn } from '@/lib/utils';
import { Lock, AlertCircle, User, Bot } from 'lucide-react';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isDecrypting?: boolean;
  decryptionError?: boolean;
  timestamp: string;
  model?: string;
}

export function MessageBubble({
  role,
  content,
  isDecrypting,
  decryptionError,
  timestamp,
  model
}: MessageBubbleProps) {
  const isUser = role === 'user';

  const renderContent = () => {
    if (decryptionError) {
      return (
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Unable to decrypt message</span>
        </div>
      );
    }

    if (isDecrypting) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Decrypting...</span>
        </div>
      );
    }

    // Simple markdown-like code block detection
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index)
        });
      }

      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2].trim()
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }

    if (parts.length === 0) {
      return <p className="whitespace-pre-wrap break-words">{content}</p>;
    }

    return (
      <>
        {parts.map((part, idx) => {
          if (part.type === 'code') {
            return (
              <div key={idx} className="my-2">
                <div className="text-xs text-muted-foreground mb-1">{part.language}</div>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-sm">
                  <code>{part.content}</code>
                </pre>
              </div>
            );
          }
          return <p key={idx} className="whitespace-pre-wrap break-words">{part.content}</p>;
        })}
      </>
    );
  };

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="text-sm">
          {renderContent()}
        </div>
        <div className={cn(
          "text-xs mt-2 flex items-center gap-2",
          isUser ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          <span>{new Date(timestamp).toLocaleTimeString()}</span>
          {model && !isUser && (
            <>
              <span>•</span>
              <span>{model}</span>
            </>
          )}
          {!decryptionError && !isDecrypting && (
            <>
              <span>•</span>
              <Lock className="h-3 w-3" />
            </>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
