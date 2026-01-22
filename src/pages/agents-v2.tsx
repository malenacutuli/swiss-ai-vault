/**
 * Swiss Agents V2 Page Route
 * /agents-v2 - Test environment for new Manus-parity implementation
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ===========================================
// TYPES
// ===========================================

type TaskState = 'idle' | 'planning' | 'executing' | 'waiting_user' | 'completed' | 'failed' | 'cancelled';

interface ExecutionPlan {
  goal: string;
  phases: Array<{
    id: number;
    title: string;
    status: string;
  }>;
}

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  type?: 'info' | 'ask' | 'result';
  attachments?: string[];
}

interface AgentStep {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ===========================================
// HOOK: useAgentV2
// ===========================================

function useAgentV2() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [state, setState] = useState<TaskState>('idle');
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [currentPhaseId, setCurrentPhaseId] = useState(0);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingContent, setThinkingContent] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const handleSSEEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const eventType = event.type || data.type;

      switch (eventType) {
        case 'task_started':
          setState('planning');
          break;
        case 'plan_created':
          setPlan(data.plan);
          setState('executing');
          if (data.plan.phases?.length > 0) {
            setCurrentPhaseId(data.plan.phases[0].id);
          }
          break;
        case 'phase_started':
          setCurrentPhaseId(data.phaseId);
          break;
        case 'phase_completed':
          setPlan(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              phases: prev.phases.map(p =>
                p.id === data.phaseId ? { ...p, status: 'completed' } : p
              ),
            };
          });
          break;
        case 'tool_started':
          setSteps(prev => [
            ...prev,
            {
              id: `step-${Date.now()}`,
              toolName: data.toolName,
              toolInput: data.toolInput,
              status: 'running',
              startedAt: new Date().toISOString(),
            },
          ]);
          setThinkingContent(null);
          break;
        case 'tool_output':
          setSteps(prev => {
            const updated = [...prev];
            const lastStep = updated[updated.length - 1];
            if (lastStep) {
              lastStep.output = (lastStep.output || '') + data.output;
            }
            return updated;
          });
          break;
        case 'tool_completed':
          setSteps(prev => {
            const updated = [...prev];
            const lastStep = updated[updated.length - 1];
            if (lastStep) {
              lastStep.status = data.success ? 'completed' : 'failed';
              lastStep.completedAt = new Date().toISOString();
              if (!data.success) lastStep.error = data.error;
            }
            return updated;
          });
          break;
        case 'message':
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: data.role,
              content: data.content,
              timestamp: new Date().toISOString(),
              type: data.messageType,
              attachments: data.attachments,
            },
          ]);
          break;
        case 'thinking':
          setThinkingContent(data.content);
          break;
        case 'task_completed':
          setState('completed');
          setIsStreaming(false);
          break;
        case 'task_failed':
          setState('failed');
          setError(data.error);
          setIsStreaming(false);
          break;
        case 'stream_end':
          setIsStreaming(false);
          break;
      }
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  }, []);

  const createTask = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agent-v2/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create task');
      }

      const data = await response.json();
      setTaskId(data.taskId);

      setMessages([{
        id: `msg-${Date.now()}`,
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      }]);

      setIsStreaming(true);
      const eventSource = new EventSource(`/api/agent-v2/${data.taskId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = handleSSEEvent;

      const eventTypes = [
        'task_started', 'plan_created', 'phase_started', 'phase_completed',
        'tool_started', 'tool_output', 'tool_completed', 'message',
        'thinking', 'task_completed', 'task_failed', 'stream_end',
      ];

      eventTypes.forEach(type => {
        eventSource.addEventListener(type, handleSSEEvent);
      });

      eventSource.onerror = () => {
        setIsStreaming(false);
        eventSource.close();
      };

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setState('failed');
    } finally {
      setIsLoading(false);
    }
  }, [handleSSEEvent]);

  const cancelTask = useCallback(() => {
    eventSourceRef.current?.close();
    setState('cancelled');
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    eventSourceRef.current?.close();
    setTaskId(null);
    setState('idle');
    setPlan(null);
    setCurrentPhaseId(0);
    setMessages([]);
    setSteps([]);
    setIsLoading(false);
    setIsStreaming(false);
    setError(null);
    setThinkingContent(null);
  }, []);

  return {
    taskId, state, plan, currentPhaseId, messages, steps,
    isLoading, isStreaming, error, thinkingContent,
    createTask, cancelTask, reset,
  };
}

// ===========================================
// COMPONENTS
// ===========================================

const MessageBubble: React.FC<{ message: AgentMessage }> = ({ message }) => {
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
          <div className="text-xs opacity-70 mb-1 uppercase">{message.type}</div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 pt-2 border-t border-current/20">
            <div className="text-xs opacity-70 mb-1">Attachments:</div>
            {message.attachments.map((path, i) => (
              <div key={i} className="text-sm truncate">📎 {path.split('/').pop()}</div>
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

const PlanViewer: React.FC<{ plan: ExecutionPlan; currentPhaseId: number }> = ({ plan, currentPhaseId }) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Execution Plan</div>
      <div className="text-base font-semibold text-gray-900 dark:text-white mb-3">{plan.goal}</div>
      <div className="space-y-2">
        {plan.phases.map((phase) => {
          const isCurrent = phase.id === currentPhaseId;
          const isCompleted = phase.status === 'completed';

          return (
            <div
              key={phase.id}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                isCurrent ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : ''
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
              <span className={`text-sm ${
                isCurrent ? 'font-medium text-emerald-700 dark:text-emerald-300'
                  : isCompleted ? 'text-gray-500 dark:text-gray-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
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

const AgentTerminal: React.FC<{ steps: AgentStep[]; isRunning: boolean }> = ({ steps, isRunning }) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [steps]);

  const getToolIcon = (toolName: string): string => {
    switch (toolName) {
      case 'shell': return '💻';
      case 'file': return '📄';
      case 'search': return '🔍';
      case 'browser_navigate':
      case 'browser_click':
      case 'browser_input': return '🌐';
      case 'plan': return '📋';
      case 'message': return '💬';
      default: return '⚡';
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 text-center text-sm text-gray-400 font-mono">SwissVault Terminal</div>
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Running
          </div>
        )}
      </div>

      <div ref={terminalRef} className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {steps.length === 0 ? (
          <div className="text-gray-500">
            <span className="text-green-400">$</span> Waiting for task...
            <span className="animate-pulse">_</span>
          </div>
        ) : (
          steps.map((step) => (
            <div key={step.id} className="mb-4">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <span>{getToolIcon(step.toolName)}</span>
                <span className="text-purple-400">{step.toolName}</span>
                <span className={step.status === 'running' ? 'text-yellow-400' : step.status === 'completed' ? 'text-green-400' : 'text-red-400'}>
                  [{step.status}]
                </span>
              </div>
              {step.output && <div className="pl-6 text-gray-300 whitespace-pre-wrap break-all">{step.output}</div>}
              {step.error && <div className="pl-6 text-red-400">Error: {step.error}</div>}
              {step.status === 'running' && <div className="pl-6 text-yellow-400 animate-pulse">Processing...</div>}
            </div>
          ))
        )}
        {isRunning && (
          <div className="text-green-400">
            <span>$</span>
            <span className="animate-pulse">_</span>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>{steps.length} operations</span>
        <span>Sandbox: Active</span>
      </div>
    </div>
  );
};

// ===========================================
// MAIN PAGE COMPONENT
// ===========================================

const AgentsV2Page: React.FC = () => {
  const agent = useAgentV2();
  const [input, setInput] = useState('');
  const [activePanel, setActivePanel] = useState<'terminal' | 'preview'>('terminal');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agent.messages, agent.thinkingContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || agent.isLoading || agent.isStreaming) return;
    const prompt = input.trim();
    setInput('');
    await agent.createTask(prompt);
  };

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(agent.state);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">Swiss Agents V2</span>
          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
            Manus API
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${
            agent.state === 'executing' || agent.state === 'planning'
              ? 'bg-green-500 animate-pulse'
              : agent.state === 'failed' ? 'bg-red-500' : 'bg-gray-400'
          }`} />
          <span className="text-gray-600 dark:text-gray-400 capitalize">{agent.state}</span>
        </div>
        {agent.taskId && (
          <div className="text-xs text-gray-500 font-mono">Task: {agent.taskId.slice(0, 8)}...</div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat */}
        <div className="w-[400px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <span className="text-white text-lg">🤖</span>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Swiss Agent</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {agent.state === 'idle' && 'Ready'}
                  {agent.state === 'planning' && 'Planning...'}
                  {agent.state === 'executing' && 'Executing...'}
                  {agent.state === 'completed' && 'Completed'}
                  {agent.state === 'failed' && 'Failed'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {agent.isStreaming && (
                <button onClick={agent.cancelTask} className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
                  Cancel
                </button>
              )}
              {isTerminal && (
                <button onClick={agent.reset} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
                  New Task
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {agent.plan && <PlanViewer plan={agent.plan} currentPhaseId={agent.currentPhaseId} />}
            {agent.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {agent.thinkingContent && (
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <span className="text-white text-sm">🤔</span>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 mb-1">Thinking...</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">{agent.thinkingContent}</div>
                </div>
              </div>
            )}
            {agent.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
                <div className="text-sm font-medium text-red-800 dark:text-red-200">Error</div>
                <div className="text-sm text-red-600 dark:text-red-300 mt-1">{agent.error}</div>
              </div>
            )}
            {agent.messages.length === 0 && agent.state === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
                  <span className="text-3xl">🚀</span>
                </div>
                <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Swiss Agents V2</div>
                <div className="text-gray-500 dark:text-gray-400 max-w-md">
                  Powered by Manus API. Describe your task below to get started.
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your task..."
                disabled={agent.isLoading || agent.isStreaming}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || agent.isLoading || agent.isStreaming}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
              >
                {agent.isLoading ? 'Starting...' : 'Send'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col">
          {/* Tabs */}
          <div className="h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-1">
            <button
              onClick={() => setActivePanel('terminal')}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                activePanel === 'terminal'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              💻 Terminal
            </button>
            <button
              onClick={() => setActivePanel('preview')}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                activePanel === 'preview'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              👁️ Preview
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 p-4 overflow-hidden">
            {activePanel === 'terminal' && (
              <AgentTerminal steps={agent.steps} isRunning={agent.isStreaming} />
            )}
            {activePanel === 'preview' && (
              <div className="h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-3">👁️</div>
                  <div className="font-medium">No Preview Available</div>
                  <div className="text-sm">Preview will appear when the agent creates visual content</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="h-8 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center px-4 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>Manus API: {agent.error ? 'Error' : 'Connected'}</span>
          <span>•</span>
          <span>Phase: {agent.currentPhaseId}/{agent.plan?.phases.length || 0}</span>
        </div>
        <div className="flex-1" />
        <div>Swiss Agents V2 - Test Environment</div>
      </footer>
    </div>
  );
};

export default AgentsV2Page;
