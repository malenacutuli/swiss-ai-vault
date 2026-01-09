/**
 * Message Bus - Inter-agent communication using Supabase Realtime
 * Provides pub/sub messaging for agent coordination
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AgentRole } from './AgentRegistry';

export type MessageType =
  | 'task_assignment'
  | 'task_result'
  | 'state_update'
  | 'handoff'
  | 'interrupt'
  | 'heartbeat'
  | 'error'
  | 'progress';

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export interface AgentMessage {
  type: MessageType;
  id: string;
  sender: string;
  senderRole: AgentRole;
  recipient?: string;
  recipientRole?: AgentRole;
  taskId: string;
  timestamp: number;
  priority: MessagePriority;
  payload: Record<string, unknown>;
  correlationId?: string;
  replyTo?: string;
  ttl?: number; // Time to live in ms
  retryCount?: number;
}

export interface MessageHandler {
  (message: AgentMessage): Promise<void>;
}

interface PendingRequest {
  resolve: (message: AgentMessage) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * MessageBus class for agent communication
 * Uses Supabase Realtime for real-time pub/sub
 */
export class MessageBus {
  private agentId: string;
  private agentRole: AgentRole;
  private taskId: string;
  private channel: RealtimeChannel | null = null;
  private handlers: Map<MessageType, MessageHandler[]> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageQueue: AgentMessage[] = [];
  private isProcessing = false;
  private seenMessages: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(agentId: string, agentRole: AgentRole, taskId: string) {
    this.agentId = agentId;
    this.agentRole = agentRole;
    this.taskId = taskId;
  }

  /**
   * Initialize the message bus and subscribe to channels
   */
  async initialize(): Promise<void> {
    // Create a Realtime channel for this task
    this.channel = supabase
      .channel(`agents:${this.taskId}`)
      .on('broadcast', { event: 'message' }, async ({ payload }) => {
        await this.handleIncomingMessage(payload as AgentMessage);
      })
      .on('broadcast', { event: `agent:${this.agentId}` }, async ({ payload }) => {
        await this.handleIncomingMessage(payload as AgentMessage);
      })
      .on('broadcast', { event: `role:${this.agentRole}` }, async ({ payload }) => {
        await this.handleIncomingMessage(payload as AgentMessage);
      });

    await this.channel.subscribe();

    // Start heartbeat
    this.startHeartbeat();

    console.log(`[MessageBus] Initialized for agent ${this.agentId} (${this.agentRole})`);
  }

  /**
   * Handle incoming messages with deduplication and filtering
   */
  private async handleIncomingMessage(message: AgentMessage): Promise<void> {
    // Deduplication
    if (this.seenMessages.has(message.id)) {
      return;
    }
    this.seenMessages.add(message.id);

    // Cleanup old seen messages (keep last 1000)
    if (this.seenMessages.size > 1000) {
      const arr = Array.from(this.seenMessages);
      this.seenMessages = new Set(arr.slice(-500));
    }

    // Check TTL
    if (message.ttl && Date.now() - message.timestamp > message.ttl) {
      console.log(`[MessageBus] Dropping expired message: ${message.id}`);
      return;
    }

    // Check if this is a reply to a pending request
    if (message.correlationId && this.pendingRequests.has(message.correlationId)) {
      const pending = this.pendingRequests.get(message.correlationId)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.correlationId);
      pending.resolve(message);
      return;
    }

    // Filter: only process messages intended for this agent or broadcast
    if (
      message.recipient &&
      message.recipient !== this.agentId &&
      message.recipientRole !== this.agentRole
    ) {
      return;
    }

    // Queue the message for processing
    this.messageQueue.push(message);
    this.processQueue();
  }

  /**
   * Process messages from the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      // Sort by priority
      this.messageQueue.sort((a, b) => {
        const priorityOrder: Record<MessagePriority, number> = {
          critical: 0,
          high: 1,
          normal: 2,
          low: 3,
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      const message = this.messageQueue.shift()!;
      const handlers = this.handlers.get(message.type) || [];

      for (const handler of handlers) {
        try {
          await handler(message);
        } catch (error) {
          console.error(`[MessageBus] Handler error for ${message.type}:`, error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Send a message to a specific agent
   */
  async sendToAgent(
    targetAgentId: string,
    targetRole: AgentRole,
    message: Omit<AgentMessage, 'id' | 'sender' | 'senderRole' | 'timestamp'>
  ): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      sender: this.agentId,
      senderRole: this.agentRole,
      recipient: targetAgentId,
      recipientRole: targetRole,
      timestamp: Date.now(),
    };

    await this.channel?.send({
      type: 'broadcast',
      event: `agent:${targetAgentId}`,
      payload: fullMessage,
    });

    // Log to database for persistence
    await this.logMessage(fullMessage);
  }

  /**
   * Broadcast a message to all agents with a specific role
   */
  async broadcastToRole(
    role: AgentRole,
    message: Omit<AgentMessage, 'id' | 'sender' | 'senderRole' | 'timestamp'>
  ): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      sender: this.agentId,
      senderRole: this.agentRole,
      recipientRole: role,
      timestamp: Date.now(),
    };

    await this.channel?.send({
      type: 'broadcast',
      event: `role:${role}`,
      payload: fullMessage,
    });

    await this.logMessage(fullMessage);
  }

  /**
   * Broadcast a message to all agents in the task
   */
  async broadcast(
    message: Omit<AgentMessage, 'id' | 'sender' | 'senderRole' | 'timestamp'>
  ): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      sender: this.agentId,
      senderRole: this.agentRole,
      timestamp: Date.now(),
    };

    await this.channel?.send({
      type: 'broadcast',
      event: 'message',
      payload: fullMessage,
    });

    await this.logMessage(fullMessage);
  }

  /**
   * Send a request and wait for a response
   */
  async request(
    targetAgentId: string,
    targetRole: AgentRole,
    message: Omit<AgentMessage, 'id' | 'sender' | 'senderRole' | 'timestamp' | 'correlationId'>,
    timeoutMs: number = 30000
  ): Promise<AgentMessage> {
    const correlationId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(correlationId, { resolve, reject, timeout });

      this.sendToAgent(targetAgentId, targetRole, {
        ...message,
        correlationId,
        replyTo: this.agentId,
      }).catch((error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(correlationId);
        reject(error);
      });
    });
  }

  /**
   * Reply to a message
   */
  async reply(
    originalMessage: AgentMessage,
    response: Omit<AgentMessage, 'id' | 'sender' | 'senderRole' | 'timestamp' | 'correlationId' | 'recipient'>
  ): Promise<void> {
    if (!originalMessage.replyTo) {
      console.warn('[MessageBus] Cannot reply: no replyTo in original message');
      return;
    }

    await this.sendToAgent(originalMessage.sender, originalMessage.senderRole, {
      ...response,
      correlationId: originalMessage.correlationId,
    });
  }

  /**
   * Register a message handler
   */
  onMessage(type: MessageType, handler: MessageHandler): () => void {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler);
    this.handlers.set(type, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.handlers.get(type) || [];
      this.handlers.set(
        type,
        currentHandlers.filter((h) => h !== handler)
      );
    };
  }

  /**
   * Start sending heartbeat messages
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      await this.broadcast({
        type: 'heartbeat',
        taskId: this.taskId,
        priority: 'low',
        payload: {
          agentId: this.agentId,
          role: this.agentRole,
          status: 'active',
          queueLength: this.messageQueue.length,
        },
        ttl: 5000, // 5 second TTL
      });
    }, 10000); // Every 10 seconds
  }

  /**
   * Log message to database for persistence and debugging
   */
  private async logMessage(message: AgentMessage): Promise<void> {
    try {
      await supabase.from('agent_communications').insert({
        from_agent: message.sender,
        to_agent: message.recipient || 'broadcast',
        message_type: message.type,
        message_content: JSON.stringify(message.payload),
        task_id: message.taskId,
        attachments: message.correlationId ? { correlationId: message.correlationId } : null,
      });
    } catch (error) {
      console.error('[MessageBus] Failed to log message:', error);
    }
  }

  /**
   * Shutdown the message bus
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Cancel pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('MessageBus shutdown'));
    }
    this.pendingRequests.clear();

    if (this.channel) {
      await supabase.removeChannel(this.channel);
    }

    console.log(`[MessageBus] Shutdown complete for agent ${this.agentId}`);
  }
}

/**
 * Factory function to create a message bus
 */
export function createMessageBus(
  agentId: string,
  agentRole: AgentRole,
  taskId: string
): MessageBus {
  return new MessageBus(agentId, agentRole, taskId);
}
