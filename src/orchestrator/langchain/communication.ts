/**
 * Inter-Agent Communication Bus
 * Enables agents to consult with each other
 */

import { EventEmitter } from 'events';
import { CHANNELS, redis } from './setup';
import { AGENT_REGISTRY } from './taxonomy';

export interface AgentMessage {
  id: string;
  type: 'consultation_request' | 'consultation_response' | 'broadcast' | 'escalation' | 'consensus_vote';
  fromAgent: string;
  toAgent: string;
  sessionId: string;
  payload: {
    question?: string;
    context?: Record<string, unknown>;
    response?: string;
    confidence?: number;
    vote?: 'agree' | 'disagree' | 'abstain';
    escalationReason?: string;
    priority?: 'normal' | 'high' | 'critical';
  };
  timestamp: number;
  expiresAt?: number;
}

export interface ConsultationResult {
  success: boolean;
  consultedAgent: string;
  response: string;
  confidence: number;
  reasoningChain: string[];
  processingTimeMs: number;
}

/**
 * Agent Communication Bus
 * Handles all inter-agent messaging
 */
export class AgentCommunicationBus extends EventEmitter {
  private redisClient: typeof redis;
  private subscriberRedis: typeof redis;
  private agentId: string;
  private sessionId: string;
  private pendingConsultations: Map<string, {
    resolve: (result: ConsultationResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;

  constructor(agentId: string, sessionId: string) {
    super();
    this.agentId = agentId;
    this.sessionId = sessionId;
    this.redisClient = redis;
    this.subscriberRedis = redis?.duplicate() ?? null;
    this.pendingConsultations = new Map();

    if (this.subscriberRedis) {
      this.setupSubscriptions();
    }
  }

  private async setupSubscriptions() {
    if (!this.subscriberRedis) return;

    const inbox = CHANNELS.AGENT_INBOX(this.agentId);
    const teamChannel = CHANNELS.TEAM_CHANNEL(AGENT_REGISTRY[this.agentId]?.team || 'orchestration');
    const broadcast = CHANNELS.BROADCAST;

    await this.subscriberRedis.subscribe(inbox, teamChannel, broadcast);

    this.subscriberRedis.on('message', (channel: string, message: string) => {
      try {
        const msg: AgentMessage = JSON.parse(message);
        this.handleIncomingMessage(msg);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });
  }

  private handleIncomingMessage(msg: AgentMessage) {
    // Check if this is a response to a pending consultation
    if (msg.type === 'consultation_response') {
      const pending = this.pendingConsultations.get(msg.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingConsultations.delete(msg.id);
        pending.resolve({
          success: true,
          consultedAgent: msg.fromAgent,
          response: msg.payload.response || '',
          confidence: msg.payload.confidence || 0.5,
          reasoningChain: [],
          processingTimeMs: Date.now() - msg.timestamp,
        });
      }
    }

    // Emit for agent to handle
    this.emit('message', msg);
  }

  /**
   * Consult another agent
   * This is how agents "talk" to each other
   */
  async consultAgent(
    targetAgentId: string,
    question: string,
    context: Record<string, unknown>,
    timeoutMs: number = 30000
  ): Promise<ConsultationResult> {
    // Verify this agent is allowed to consult the target
    const thisAgent = AGENT_REGISTRY[this.agentId];
    if (!thisAgent?.canConsult.includes(targetAgentId)) {
      throw new Error(`Agent ${this.agentId} is not allowed to consult ${targetAgentId}`);
    }

    if (!this.redisClient) {
      // Fallback for when Redis is not available - simulate consultation
      return {
        success: true,
        consultedAgent: targetAgentId,
        response: `[Simulated response from ${targetAgentId}]`,
        confidence: 0.5,
        reasoningChain: [],
        processingTimeMs: 0,
      };
    }

    const messageId = `${this.sessionId}:${this.agentId}:${targetAgentId}:${Date.now()}`;

    const message: AgentMessage = {
      id: messageId,
      type: 'consultation_request',
      fromAgent: this.agentId,
      toAgent: targetAgentId,
      sessionId: this.sessionId,
      payload: {
        question,
        context,
        priority: 'normal',
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + timeoutMs,
    };

    // Send to target agent's inbox
    await this.redisClient.publish(
      CHANNELS.AGENT_INBOX(targetAgentId),
      JSON.stringify(message)
    );

    // Also store in Redis stream for persistence
    await this.redisClient.xadd(
      `helios:consultations:${this.sessionId}`,
      '*',
      'message', JSON.stringify(message)
    );

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingConsultations.delete(messageId);
        reject(new Error(`Consultation with ${targetAgentId} timed out`));
      }, timeoutMs);

      this.pendingConsultations.set(messageId, { resolve, reject, timeout });
    });
  }

  /**
   * Respond to a consultation request
   */
  async respondToConsultation(
    originalMessage: AgentMessage,
    response: string,
    confidence: number
  ): Promise<void> {
    if (!this.redisClient) return;

    const responseMessage: AgentMessage = {
      id: originalMessage.id,
      type: 'consultation_response',
      fromAgent: this.agentId,
      toAgent: originalMessage.fromAgent,
      sessionId: this.sessionId,
      payload: {
        response,
        confidence,
      },
      timestamp: Date.now(),
    };

    await this.redisClient.publish(
      CHANNELS.AGENT_INBOX(originalMessage.fromAgent),
      JSON.stringify(responseMessage)
    );
  }

  /**
   * Broadcast to all agents in a team
   */
  async broadcastToTeam(
    team: string,
    message: string,
    context: Record<string, unknown>
  ): Promise<void> {
    if (!this.redisClient) return;

    const broadcastMessage: AgentMessage = {
      id: `${this.sessionId}:broadcast:${Date.now()}`,
      type: 'broadcast',
      fromAgent: this.agentId,
      toAgent: '*',
      sessionId: this.sessionId,
      payload: {
        question: message,
        context,
      },
      timestamp: Date.now(),
    };

    await this.redisClient.publish(
      CHANNELS.TEAM_CHANNEL(team),
      JSON.stringify(broadcastMessage)
    );
  }

  /**
   * Escalate to supervisor
   */
  async escalateToSupervisor(
    reason: string,
    context: Record<string, unknown>
  ): Promise<void> {
    const thisAgent = AGENT_REGISTRY[this.agentId];
    if (!thisAgent?.reportsTo) {
      throw new Error(`Agent ${this.agentId} has no supervisor to escalate to`);
    }

    if (!this.redisClient) return;

    const escalationMessage: AgentMessage = {
      id: `${this.sessionId}:escalation:${Date.now()}`,
      type: 'escalation',
      fromAgent: this.agentId,
      toAgent: thisAgent.reportsTo,
      sessionId: this.sessionId,
      payload: {
        escalationReason: reason,
        context,
        priority: 'high',
      },
      timestamp: Date.now(),
    };

    await this.redisClient.publish(
      CHANNELS.AGENT_INBOX(thisAgent.reportsTo),
      JSON.stringify(escalationMessage)
    );
  }

  /**
   * Submit consensus vote
   */
  async submitConsensusVote(
    topic: string,
    vote: 'agree' | 'disagree' | 'abstain',
    reasoning: string
  ): Promise<void> {
    if (!this.redisClient) return;

    const voteMessage: AgentMessage = {
      id: `${this.sessionId}:vote:${this.agentId}:${Date.now()}`,
      type: 'consensus_vote',
      fromAgent: this.agentId,
      toAgent: 'orch_consensus',
      sessionId: this.sessionId,
      payload: {
        question: topic,
        vote,
        response: reasoning,
        confidence: vote === 'abstain' ? 0.5 : 0.8,
      },
      timestamp: Date.now(),
    };

    await this.redisClient.publish(
      CHANNELS.CONSENSUS_CHANNEL(this.sessionId),
      JSON.stringify(voteMessage)
    );
  }

  async cleanup() {
    if (this.subscriberRedis) {
      await this.subscriberRedis.unsubscribe();
      await this.subscriberRedis.quit();
    }
    this.pendingConsultations.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingConsultations.clear();
  }
}

/**
 * In-memory communication bus for development/testing
 * when Redis is not available
 */
export class InMemoryAgentBus extends EventEmitter {
  private static instance: InMemoryAgentBus;
  private agentHandlers: Map<string, (msg: AgentMessage) => Promise<string>>;
  private consultationHistory: AgentMessage[];

  private constructor() {
    super();
    this.agentHandlers = new Map();
    this.consultationHistory = [];
  }

  static getInstance(): InMemoryAgentBus {
    if (!InMemoryAgentBus.instance) {
      InMemoryAgentBus.instance = new InMemoryAgentBus();
    }
    return InMemoryAgentBus.instance;
  }

  registerAgentHandler(agentId: string, handler: (msg: AgentMessage) => Promise<string>) {
    this.agentHandlers.set(agentId, handler);
  }

  async sendConsultation(
    fromAgent: string,
    toAgent: string,
    sessionId: string,
    question: string,
    context: Record<string, unknown>
  ): Promise<ConsultationResult> {
    const message: AgentMessage = {
      id: `${sessionId}:${fromAgent}:${toAgent}:${Date.now()}`,
      type: 'consultation_request',
      fromAgent,
      toAgent,
      sessionId,
      payload: { question, context },
      timestamp: Date.now(),
    };

    this.consultationHistory.push(message);

    const handler = this.agentHandlers.get(toAgent);
    if (handler) {
      const startTime = Date.now();
      const response = await handler(message);
      return {
        success: true,
        consultedAgent: toAgent,
        response,
        confidence: 0.8,
        reasoningChain: [],
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: false,
      consultedAgent: toAgent,
      response: `Agent ${toAgent} not available`,
      confidence: 0,
      reasoningChain: [],
      processingTimeMs: 0,
    };
  }

  getConsultationHistory(): AgentMessage[] {
    return [...this.consultationHistory];
  }

  clearHistory() {
    this.consultationHistory = [];
  }
}
