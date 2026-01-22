/**
 * Realtime Events Hook for Agent Execution
 *
 * This hook provides real-time event streaming for agent execution via:
 * 1. Supabase Realtime channels for database updates
 * 2. SSE streaming for execution events
 * 3. Combined event emitter for unified updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Event types
export type AgentEventType =
  | 'task_created'
  | 'task_started'
  | 'status_changed'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'tool_call'
  | 'tool_result'
  | 'terminal_output'
  | 'thinking'
  | 'message'
  | 'artifact_created'
  | 'browser_action'
  | 'file_created'
  | 'progress_update'
  | 'task_completed'
  | 'task_failed'
  | 'error';

export interface AgentEvent {
  type: AgentEventType;
  taskId: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface BrowserAction {
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'screenshot' | 'wait';
  target?: string;
  url?: string;
  text?: string;
  screenshotUrl?: string;
}

export interface ProgressUpdate {
  percentage: number;
  currentPhase: number;
  totalPhases: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

interface UseAgentRealtimeEventsOptions {
  taskId: string | null;
  onEvent?: (event: AgentEvent) => void;
  onBrowserAction?: (action: BrowserAction) => void;
  onProgress?: (progress: ProgressUpdate) => void;
  autoConnect?: boolean;
}

export function useAgentRealtimeEvents(options: UseAgentRealtimeEventsOptions) {
  const { taskId, onEvent, onBrowserAction, onProgress, autoConnect = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<AgentEvent | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [browserState, setBrowserState] = useState<{
    currentUrl: string;
    screenshotUrl?: string;
    status: 'idle' | 'navigating' | 'clicking' | 'typing' | 'scrolling' | 'waiting';
  }>({
    currentUrl: '',
    status: 'idle',
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Emit event
  const emitEvent = useCallback((event: AgentEvent) => {
    setEvents(prev => [...prev.slice(-99), event]); // Keep last 100 events
    setLastEvent(event);
    optionsRef.current.onEvent?.(event);

    // Handle specific event types
    if (event.type === 'browser_action') {
      const browserAction: BrowserAction = event.data as BrowserAction;
      setBrowserState(prev => ({
        ...prev,
        currentUrl: browserAction.url || prev.currentUrl,
        screenshotUrl: browserAction.screenshotUrl || prev.screenshotUrl,
        status: browserAction.action === 'navigate' ? 'navigating'
          : browserAction.action === 'click' ? 'clicking'
          : browserAction.action === 'type' ? 'typing'
          : browserAction.action === 'scroll' ? 'scrolling'
          : browserAction.action === 'wait' ? 'waiting'
          : 'idle',
      }));
      optionsRef.current.onBrowserAction?.(browserAction);
    }

    if (event.type === 'progress_update') {
      const progressUpdate: ProgressUpdate = event.data as ProgressUpdate;
      setProgress(progressUpdate);
      optionsRef.current.onProgress?.(progressUpdate);
    }
  }, []);

  // Subscribe to Supabase realtime changes
  const subscribe = useCallback(async (runId: string) => {
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`agent-run-${runId}`)
      // Subscribe to run status changes
      .on<{ status: string; current_phase: number; error_message?: string }>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_runs',
          filter: `id=eq.${runId}`,
        },
        (payload: RealtimePostgresChangesPayload<{ status: string; current_phase: number; error_message?: string }>) => {
          const newData = payload.new as { status: string; current_phase: number; error_message?: string };
          emitEvent({
            type: 'status_changed',
            taskId: runId,
            timestamp: new Date().toISOString(),
            data: { status: newData.status, currentPhase: newData.current_phase },
          });

          if (newData.status === 'completed') {
            emitEvent({
              type: 'task_completed',
              taskId: runId,
              timestamp: new Date().toISOString(),
              data: {},
            });
          } else if (newData.status === 'failed') {
            emitEvent({
              type: 'task_failed',
              taskId: runId,
              timestamp: new Date().toISOString(),
              data: { error: newData.error_message },
            });
          }
        }
      )
      // Subscribe to step insertions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_steps',
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const step = payload.new as Record<string, any>;
          emitEvent({
            type: 'step_started',
            taskId: runId,
            timestamp: new Date().toISOString(),
            data: step,
          });
        }
      )
      // Subscribe to step updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_steps',
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const step = payload.new as Record<string, any>;
          if (step.status === 'completed') {
            emitEvent({
              type: 'step_completed',
              taskId: runId,
              timestamp: new Date().toISOString(),
              data: step,
            });
          } else if (step.status === 'failed') {
            emitEvent({
              type: 'step_failed',
              taskId: runId,
              timestamp: new Date().toISOString(),
              data: step,
            });
          }
        }
      )
      // Subscribe to message insertions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_messages',
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const message = payload.new as Record<string, any>;
          emitEvent({
            type: 'message',
            taskId: runId,
            timestamp: new Date().toISOString(),
            data: message,
          });
        }
      )
      // Subscribe to artifact insertions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_artifacts',
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const artifact = payload.new as Record<string, any>;
          emitEvent({
            type: 'artifact_created',
            taskId: runId,
            timestamp: new Date().toISOString(),
            data: artifact,
          });
        }
      )
      // Subscribe to log insertions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_task_logs',
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const log = payload.new as Record<string, any>;
          // Check if it's a browser action
          if (log.log_type === 'browser_action' && log.metadata) {
            emitEvent({
              type: 'browser_action',
              taskId: runId,
              timestamp: new Date().toISOString(),
              data: log.metadata,
            });
          } else {
            emitEvent({
              type: 'terminal_output',
              taskId: runId,
              timestamp: new Date().toISOString(),
              data: { content: log.message, type: log.log_level },
            });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        console.log(`[AgentRealtime] Subscription status: ${status}`);
      });

    channelRef.current = channel;
  }, [emitEvent]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Auto-connect when taskId changes
  useEffect(() => {
    if (taskId && autoConnect) {
      subscribe(taskId);
    }

    return () => {
      unsubscribe();
    };
  }, [taskId, autoConnect, subscribe, unsubscribe]);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
    setProgress(null);
    setBrowserState({
      currentUrl: '',
      status: 'idle',
    });
  }, []);

  return {
    // Connection state
    isConnected,

    // Events
    events,
    lastEvent,

    // Progress
    progress,

    // Browser state
    browserState,

    // Actions
    subscribe,
    unsubscribe,
    clearEvents,
    emitEvent,
  };
}

export default useAgentRealtimeEvents;
