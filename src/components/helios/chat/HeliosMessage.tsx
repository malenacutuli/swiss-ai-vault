/**
 * HELIOS Message Component
 * Individual chat message display with emotion indicators
 */

import React from 'react';
import { User, Bot, AlertCircle } from 'lucide-react';
import type { Message, EmotionAnalysis } from '@/lib/helios/types';

interface HeliosMessageProps {
  message: Message;
}

export function HeliosMessage({ message }: HeliosMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${
        isSystem ? 'justify-center' : ''
      }`}
    >
      {/* Avatar */}
      {!isSystem && (
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser
              ? 'bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>
      )}

      {/* Message Content */}
      <div
        className={`max-w-[80%] ${isSystem ? 'max-w-full' : ''}`}
      >
        <div
          className={`px-4 py-2 rounded-lg ${
            isUser
              ? 'bg-teal-600 text-white rounded-br-none'
              : isSystem
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none'
          }`}
        >
          {isSystem && (
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">System</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Emotion Indicator */}
        {message.emotion && !isSystem && (
          <EmotionIndicator emotion={message.emotion} isUser={isUser} />
        )}

        {/* Timestamp */}
        <div
          className={`mt-1 text-xs text-gray-400 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

interface EmotionIndicatorProps {
  emotion: EmotionAnalysis;
  isUser: boolean;
}

function EmotionIndicator({ emotion, isUser }: EmotionIndicatorProps) {
  const { dominant_emotion, distress_level, pain_indicators } = emotion;

  // Only show if there's notable emotion
  if (distress_level < 0.3 && pain_indicators < 0.3) {
    return null;
  }

  const emotionColors: Record<string, string> = {
    fear: 'text-purple-500',
    anxiety: 'text-orange-500',
    pain: 'text-red-500',
    sadness: 'text-blue-500',
    frustration: 'text-amber-500',
    confusion: 'text-gray-500',
    neutral: 'text-gray-400',
  };

  const color = emotionColors[dominant_emotion] || 'text-gray-400';

  return (
    <div
      className={`flex items-center gap-1 mt-1 text-xs ${color} ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <span className="opacity-70">
        {distress_level >= 0.5 && '😰 '}
        {pain_indicators >= 0.5 && '😣 '}
        {dominant_emotion}
      </span>
      {distress_level >= 0.7 && (
        <span className="text-red-500 font-medium">• High distress</span>
      )}
    </div>
  );
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
