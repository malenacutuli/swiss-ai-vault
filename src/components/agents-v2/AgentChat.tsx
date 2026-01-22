/**
 * AgentChat Component
 * Main chat interface for Swiss Agents V2
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAgent, AgentMessage } from '../hooks/useAgent';

// ===========================================
// SUB-COMPONENTS
// ===========================================

interface MessageBubbleProps {
  message: AgentMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-emerald-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}
      >
        {message.type && message.type !== 'info' && (
          <div className="text-xs opacity-70 mb-1 uppercase">
            {message.type}
          </div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 pt-2 border-t border-current/20">
            <div className="text-xs opacity-70 mb-1">Attachments:</div>
            {message.attachments.map((path, i) => (
              <div key={i} className="text-sm truncate">
                📎 {path.split('/').pop()}
              </div>
            ))}
          </div>
        )}
        <div className="text-xs opacity-50 mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

interface PlanViewerProps {
  plan: {
    goal: string;
    phases: Array<{
      id: number;
      title: string;
      status: string;
    }>;
  };
  currentPhaseId: number;
}

const PlanViewer: React.FC<PlanViewerProps> = ({ plan, currentPhaseId }) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
        Execution Plan
      </div>
      <div className="text-base font-semibold text-gray-900 dark:text-white mb-3">
        {plan.goal}
      </div>
      <div className="space-y-2">
        {plan.phases.map((phase) => {
          const isCurrent = phase.id === currentPhaseId;
          const isCompleted = phase.status === 'completed';

          return (
            <div
              key={phase.id}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                isCurrent
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                  : ''
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                    ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}
              >
                {isCompleted ? '✓' : phase.id}
              </div>
              <span
                className={`text-sm ${
                  isCurrent
                    ? 'font-medium text-emerald-700 dark:text-emerald-300'
                    : isCompleted
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {phase.title}
              </span>
              {isCurrent && (
                <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400 animate-pulse">
                  In Progress
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ThinkingIndicatorProps {
  content: string | null;
}

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ content }) => {
  if (!content) return null;

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
        <span className="text-white text-sm">🤔</span>
      </div>
      <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Thinking...</div>
        <div className="text-sm text-gray-600 dark:text-gray-300">{content}</div>
      </div>
    </div>
  );
};

// ===========================================
// MAIN COMPONENT
// ===========================================

export interface AgentChatProps {
  className?: string;
}

export const AgentChat: React.FC<AgentChatProps> = ({ className = '' }) => {
  const {
    taskId,
    state,
    plan,
    currentPhaseId,
    messages,
    steps,
    isLoading,
    isStreaming,
    error,
    thinkingContent,
    createTask,
    cancelTask,
    reset,
  } = useAgent();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isStreaming) return;

    const prompt = input.trim();
    setInput('');
    await createTask(prompt);
  };

  const handleCancel = () => {
    cancelTask();
  };

  const handleReset = () => {
    reset();
    setInput('');
  };

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(state);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-white text-lg">🤖</span>
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">Swiss Agent</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {state === 'idle' && 'Ready'}
              {state === 'planning' && 'Planning...'}
              {state === 'executing' && 'Executing...'}
              {state === 'waiting_user' && 'Waiting for input'}
              {state === 'completed' && 'Completed'}
              {state === 'failed' && 'Failed'}
              {state === 'cancelled' && 'Cancelled'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Plan Viewer */}
        {plan && <PlanViewer plan={plan} currentPhaseId={currentPhaseId} />}

        {/* Messages */}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Thinking Indicator */}
        <ThinkingIndicator content={thinkingContent} />

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
            <div className="text-sm font-medium text-red-800 dark:text-red-200">Error</div>
            <div className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</div>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && state === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
              <span className="text-3xl">🚀</span>
            </div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Swiss Agents V2
            </div>
            <div className="text-gray-500 dark:text-gray-400 max-w-md">
              Powered by Manus API for full agentic capabilities. Describe your task below to get started.
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your task..."
            disabled={isLoading || isStreaming}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isStreaming}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Starting...
              </span>
            ) : (
              'Send'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AgentChat;
