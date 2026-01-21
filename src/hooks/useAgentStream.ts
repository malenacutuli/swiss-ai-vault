/**
 * React hook for consuming agent execution stream via SSE
 * 
 * Provides real-time updates for:
 * - Status changes (queued → planning → executing → completed)
 * - Tool calls and results
 * - Agent messages
 * - Progress updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Event types from the SSE stream
export interface AgentStatusEvent {
  status: string;
  current_phase: number;
  total_phases?: number;
}

export interface AgentToolCallEvent {
  step_id: string;
  tool_name: string;
  tool_input: Record<string, any>;
  status: string;
}

export interface AgentToolResultEvent {
  step_id: string;
  tool_name: string;
  success: boolean;
  output?: any;
  error?: string;
  duration_ms?: number;
}

export interface AgentMessageEvent {
  message_id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentThinkingEvent {
  content: string;
}

export interface AgentCompleteEvent {
  status: string;
  message: string;
}

export interface AgentErrorEvent {
  message: string;
}

// Combined event type
export type AgentEvent =
  | { type: 'status'; data: AgentStatusEvent }
  | { type: 'tool_call'; data: AgentToolCallEvent }
  | { type: 'tool_result'; data: AgentToolResultEvent }
  | { type: 'message'; data: AgentMessageEvent }
  | { type: 'thinking'; data: AgentThinkingEvent }
  | { type: 'complete'; data: AgentCompleteEvent }
  | { type: 'error'; data: AgentErrorEvent }
  | { type: 'heartbeat'; data: { timestamp: string } };

// Hook state
export interface AgentStreamState {
  // Connection state
  isConnected: boolean;
  isComplete: boolean;
  error: string | null;
  
  // Agent state
  status: string;
  currentPhase: number;
  totalPhases: number;
  
  // Events
  events: AgentEvent[];
  toolCalls: AgentToolCallEvent[];
  toolResults: AgentToolResultEvent[];
  messages: AgentMessageEvent[];
  
  // Current thinking (ephemeral)
  thinking: string | null;
}

export interface UseAgentStreamOptions {
  // API base URL
  apiUrl?: string;
  
  // Auth token
  token?: string;
  
  // Auto-reconnect on disconnect
  autoReconnect?: boolean;
  
  // Max reconnect attempts
  maxReconnectAttempts?: number;
  
  // Callback when stream completes
  onComplete?: (status: string) => void;
  
  // Callback on error
  onError?: (error: string) => void;
  
  // Callback on each event
  onEvent?: (event: AgentEvent) => void;
}

const DEFAULT_OPTIONS: UseAgentStreamOptions = {
  apiUrl: '/api',
  autoReconnect: true,
  maxReconnectAttempts: 3,
};

export function useAgentStream(
  runId: string | null,
  options: UseAgentStreamOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<AgentStreamState>({
    isConnected: false,
    isComplete: false,
    error: null,
    status: 'unknown',
    currentPhase: 0,
    totalPhases: 0,
    events: [],
    toolCalls: [],
    toolResults: [],
    messages: [],
    thinking: null,
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  // Add event to state
  const addEvent = useCallback((event: AgentEvent) => {
    setState(prev => ({
      ...prev,
      events: [...prev.events, event],
    }));
    
    // Call event callback
    opts.onEvent?.(event);
  }, [opts.onEvent]);
  
  // Handle status event
  const handleStatus = useCallback((data: AgentStatusEvent) => {
    setState(prev => ({
      ...prev,
      status: data.status,
      currentPhase: data.current_phase,
      totalPhases: data.total_phases ?? prev.totalPhases,
    }));
    addEvent({ type: 'status', data });
  }, [addEvent]);
  
  // Handle tool call event
  const handleToolCall = useCallback((data: AgentToolCallEvent) => {
    setState(prev => ({
      ...prev,
      toolCalls: [...prev.toolCalls, data],
    }));
    addEvent({ type: 'tool_call', data });
  }, [addEvent]);
  
  // Handle tool result event
  const handleToolResult = useCallback((data: AgentToolResultEvent) => {
    setState(prev => ({
      ...prev,
      toolResults: [...prev.toolResults, data],
    }));
    addEvent({ type: 'tool_result', data });
  }, [addEvent]);
  
  // Handle message event
  const handleMessage = useCallback((data: AgentMessageEvent) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, data],
    }));
    addEvent({ type: 'message', data });
  }, [addEvent]);
  
  // Handle thinking event
  const handleThinking = useCallback((data: AgentThinkingEvent) => {
    setState(prev => ({
      ...prev,
      thinking: data.content,
    }));
    addEvent({ type: 'thinking', data });
  }, [addEvent]);
  
  // Handle complete event
  const handleComplete = useCallback((data: AgentCompleteEvent) => {
    setState(prev => ({
      ...prev,
      isComplete: true,
      status: data.status,
    }));
    addEvent({ type: 'complete', data });
    opts.onComplete?.(data.status);
  }, [addEvent, opts.onComplete]);
  
  // Handle error event
  const handleError = useCallback((data: AgentErrorEvent) => {
    setState(prev => ({
      ...prev,
      error: data.message,
    }));
    addEvent({ type: 'error', data });
    opts.onError?.(data.message);
  }, [addEvent, opts.onError]);
  
  // Connect to SSE stream
  const connect = useCallback(() => {
    if (!runId) return;
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    // Build URL with auth token if provided
    let url = `${opts.apiUrl}/agent/run/${runId}/stream`;
    if (opts.token) {
      url += `?token=${encodeURIComponent(opts.token)}`;
    }
    
    console.log(`[AgentStream] Connecting to ${url}`);
    
    const eventSource = new EventSource(url, {
      withCredentials: true,
    });
    
    eventSourceRef.current = eventSource;
    
    // Connection opened
    eventSource.onopen = () => {
      console.log('[AgentStream] Connected');
      setState(prev => ({ ...prev, isConnected: true, error: null }));
      reconnectAttemptsRef.current = 0;
    };
    
    // Connection error
    eventSource.onerror = (error) => {
      console.error('[AgentStream] Error:', error);
      setState(prev => ({ ...prev, isConnected: false }));
      
      // Attempt reconnect
      if (opts.autoReconnect && reconnectAttemptsRef.current < (opts.maxReconnectAttempts ?? 3)) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        console.log(`[AgentStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        setTimeout(connect, delay);
      } else {
        setState(prev => ({ ...prev, error: 'Connection failed' }));
        opts.onError?.('Connection failed');
      }
    };
    
    // Event handlers
    eventSource.addEventListener('status', (e) => {
      handleStatus(JSON.parse(e.data));
    });
    
    eventSource.addEventListener('tool_call', (e) => {
      handleToolCall(JSON.parse(e.data));
    });
    
    eventSource.addEventListener('tool_result', (e) => {
      handleToolResult(JSON.parse(e.data));
    });
    
    eventSource.addEventListener('message', (e) => {
      handleMessage(JSON.parse(e.data));
    });
    
    eventSource.addEventListener('thinking', (e) => {
      handleThinking(JSON.parse(e.data));
    });
    
    eventSource.addEventListener('complete', (e) => {
      handleComplete(JSON.parse(e.data));
      eventSource.close();
    });
    
    eventSource.addEventListener('error', (e) => {
      handleError(JSON.parse(e.data));
    });
    
    eventSource.addEventListener('heartbeat', () => {
      // Just keep-alive, no action needed
    });
    
  }, [runId, opts.apiUrl, opts.token, opts.autoReconnect, opts.maxReconnectAttempts,
      handleStatus, handleToolCall, handleToolResult, handleMessage, handleThinking,
      handleComplete, handleError]);
  
  // Disconnect from stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState(prev => ({ ...prev, isConnected: false }));
  }, []);
  
  // Reset state
  const reset = useCallback(() => {
    disconnect();
    setState({
      isConnected: false,
      isComplete: false,
      error: null,
      status: 'unknown',
      currentPhase: 0,
      totalPhases: 0,
      events: [],
      toolCalls: [],
      toolResults: [],
      messages: [],
      thinking: null,
    });
  }, [disconnect]);
  
  // Connect when runId changes
  useEffect(() => {
    if (runId) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [runId, connect, disconnect]);
  
  return {
    ...state,
    connect,
    disconnect,
    reset,
  };
}

export default useAgentStream;
