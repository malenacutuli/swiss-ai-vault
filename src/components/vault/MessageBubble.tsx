// src/components/vault/MessageBubble.tsx

import { Lock, User, Bot, Copy, Check } from '@/icons';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DecryptedMessage } from '@/types/encryption';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  message: DecryptedMessage;
  isEncrypted?: boolean;
}

export function MessageBubble({ message, isEncrypted = true }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className={cn(
      "flex gap-3",
      isUser && "flex-row-reverse"
    )}>
      {/* Avatar */}
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      
      {/* Bubble */}
      <div className={cn(
        "group relative max-w-[80%] rounded-2xl px-4 py-3",
        isUser 
          ? "bg-primary text-primary-foreground rounded-tr-sm" 
          : "bg-muted rounded-tl-sm"
      )}>
        {/* Content */}
        <div className={cn(
          "prose prose-sm max-w-none",
          isUser && "prose-invert"
        )}>
          {isUser ? (
            <p className="m-0 whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>
        
        {/* Footer */}
        <div className={cn(
          "flex items-center gap-2 mt-2 pt-2 border-t",
          isUser ? "border-primary-foreground/20" : "border-border"
        )}>
          {isEncrypted && (
            <span className={cn(
              "flex items-center gap-1 text-xs",
              isUser ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              <Lock className="h-3 w-3" />
              Encrypted
            </span>
          )}
          
          <span className={cn(
            "text-xs",
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {new Date(message.createdAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity",
              isUser && "hover:bg-primary-foreground/20"
            )}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
