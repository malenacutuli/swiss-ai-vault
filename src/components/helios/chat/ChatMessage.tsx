/**
 * Chat Message Component
 * Renders user and AI messages with proper styling
 */

import React from 'react';
import { Share2, FileText, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/helios/types';

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
}

export function ChatMessage({ message, isLast }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-3",
      isUser ? "justify-end" : "justify-start"
    )}>
      {/* AI Avatar */}
      {!isUser && (
        <div className="w-8 h-8 bg-[#1D4E5F] rounded-full flex-shrink-0 flex items-center justify-center">
          <span className="text-white text-sm">✦</span>
        </div>
      )}

      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3",
        isUser
          ? "bg-[#2196F3] text-white rounded-br-md"
          : "bg-white border border-gray-200 rounded-bl-md"
      )}>
        {/* Message content */}
        <div className={cn(
          "prose prose-sm max-w-none",
          isUser && "prose-invert"
        )}>
          {message.content}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.attachments.map((attachment, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                  isUser ? "bg-white/10" : "bg-gray-100"
                )}
              >
                {attachment.type === 'image' ? (
                  <ImageIcon className="w-4 h-4" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span className="truncate">{attachment.filename}</span>
              </div>
            ))}
          </div>
        )}

        {/* Red flags indicator */}
        {message.redFlags && message.redFlags.length > 0 && (
          <div className={cn(
            "mt-3 flex items-center gap-2 text-sm",
            isUser ? "text-white/80" : "text-amber-600"
          )}>
            <AlertTriangle className="w-4 h-4" />
            <span>{message.redFlags.length} concern(s) noted</span>
          </div>
        )}
      </div>

      {/* Share button for AI messages */}
      {!isUser && (
        <button className="self-end p-2 text-gray-400 hover:text-gray-600">
          <Share2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
