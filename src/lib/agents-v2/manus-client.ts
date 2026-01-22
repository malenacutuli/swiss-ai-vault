/**
 * Manus API Client
 * 
 * Official Manus API integration using https://api.manus.im/v1
 * Documentation: https://open.manus.im/docs
 * 
 * This client uses the official Manus REST API with webhook-based updates.
 */

// ===========================================
// REQUEST/RESPONSE TYPES
// ===========================================

export interface ManusTaskRequest {
  prompt: string;
  agentProfile?: 'manus-1.6' | 'manus-1.6-lite' | 'manus-1.6-max';
  taskMode?: 'chat' | 'adaptive' | 'agent';
  attachments?: ManusAttachment[];
  connectors?: string[];
  hideInTaskList?: boolean;
  createShareableLink?: boolean;
  taskId?: string; // For continuing existing tasks (multi-turn)
  locale?: string;
  projectId?: string;
  interactiveMode?: boolean;
}

export interface ManusAttachment {
  type: 'file_id' | 'url' | 'base64';
  file_id?: string;
  url?: string;
  data?: string;
  mime_type?: string;
  file_name?: string;
}

export interface ManusTaskResponse {
  task_id: string;
  task_title: string;
  task_url: string;
  share_url?: string;
}

export interface ManusTaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_input';
  title?: string;
  message?: string;
  attachments?: ManusFileAttachment[];
  created_at?: string;
  updated_at?: string;
}

export interface ManusFileAttachment {
  file_name: string;
  url: string;
  size_bytes: number;
}

// ===========================================
// WEBHOOK EVENT TYPES
// ===========================================

export interface ManusWebhookEvent {
  event_id: string;
  event_type: 'task_created' | 'task_progress' | 'task_stopped';
  task_detail?: ManusTaskDetail;
  progress_detail?: ManusProgressDetail;
}

export interface ManusTaskDetail {
  task_id: string;
  task_title: string;
  task_url: string;
  message?: string;
  attachments?: ManusFileAttachment[];
  stop_reason?: 'finish' | 'ask';
}

export interface ManusProgressDetail {
  task_id: string;
  progress_type: 'plan_update';
  message: string;
}

// ===========================================
// ERROR CLASS
// ===========================================

export class ManusAPIError extends Error {
  constructor(
    public statusCode: number,
    public details: string
  ) {
    super(`Manus API Error (${statusCode}): ${details}`);
    this.name = 'ManusAPIError';
  }
}

// ===========================================
// MAIN CLIENT CLASS
// ===========================================

export class ManusClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: { apiKey: string; baseUrl?: string; timeout?: number }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.manus.ai/v1';
    this.timeout = config.timeout || 120000;
  }

  /**
   * Create a new task
   * POST /v1/tasks
   */
  async createTask(request: ManusTaskRequest): Promise<ManusTaskResponse> {
    const response = await fetch(`${this.baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API_KEY': this.apiKey,
      },
      body: JSON.stringify({
        prompt: request.prompt,
        agentProfile: request.agentProfile || 'manus-1.6',
        taskMode: request.taskMode || 'agent',
        attachments: request.attachments,
        connectors: request.connectors,
        hideInTaskList: request.hideInTaskList,
        createShareableLink: request.createShareableLink,
        taskId: request.taskId,
        locale: request.locale,
        projectId: request.projectId,
        interactiveMode: request.interactiveMode ?? false,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ManusAPIError(response.status, errorText);
    }

    return response.json();
  }

  /**
   * Get task status
   * GET /v1/tasks/{task_id}
   */
  async getTask(taskId: string): Promise<ManusTaskStatus> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'API_KEY': this.apiKey,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ManusAPIError(response.status, errorText);
    }

    return response.json();
  }

  /**
   * Get all tasks
   * GET /v1/tasks
   */
  async getTasks(params?: { limit?: number; offset?: number }): Promise<ManusTaskStatus[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const url = `${this.baseUrl}/tasks${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'API_KEY': this.apiKey,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ManusAPIError(response.status, errorText);
    }

    return response.json();
  }

  /**
   * Continue a task (multi-turn conversation)
   * Uses taskId parameter to continue existing conversation
   */
  async continueTask(taskId: string, message: string): Promise<ManusTaskResponse> {
    return this.createTask({
      prompt: message,
      taskId: taskId,
    });
  }

  /**
   * Delete a task
   * DELETE /v1/tasks/{task_id}
   */
  async deleteTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'API_KEY': this.apiKey,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ManusAPIError(response.status, errorText);
    }
  }

  /**
   * Poll task status until completion
   * Since Manus uses webhooks, this is a fallback polling mechanism
   */
  async pollTaskUntilComplete(
    taskId: string,
    onProgress?: (status: ManusTaskStatus) => void,
    pollInterval: number = 2000,
    maxAttempts: number = 300 // 10 minutes max
  ): Promise<ManusTaskStatus> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const status = await this.getTask(taskId);
      
      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'completed' || status.status === 'failed' || status.status === 'waiting_input') {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new ManusAPIError(408, 'Task polling timeout');
  }

  /**
   * Health check - verify API key is valid
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/tasks?limit=1`, {
        method: 'GET',
        headers: {
          'API_KEY': this.apiKey,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ===========================================
// FACTORY FUNCTION
// ===========================================

/**
 * Create a Manus client from environment variables or config
 */
export function createManusClient(apiKey?: string): ManusClient {
  const key = apiKey || 
    (typeof window !== 'undefined' ? (window as any).__MANUS_API_KEY__ : null) ||
    (typeof process !== 'undefined' ? process.env.MANUS_API_KEY : null);
    
  if (!key) {
    throw new Error('MANUS_API_KEY is not configured');
  }

  const baseUrl = (typeof process !== 'undefined' ? process.env.MANUS_API_URL : null) || 
    'https://api.manus.ai/v1';

  return new ManusClient({ apiKey: key, baseUrl });
}

// ===========================================
// TOOL DEFINITIONS (for local agent execution)
// ===========================================

export interface ManusToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MANUS_TOOLS: ManusToolDefinition[] = [
  {
    name: 'message',
    description: 'Send a message to the user',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['info', 'ask', 'result'],
          description: 'Message type',
        },
        text: {
          type: 'string',
          description: 'Message content',
        },
        attachments: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to attach',
        },
      },
      required: ['type', 'text'],
    },
  },
  {
    name: 'plan',
    description: 'Create or update the task execution plan',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['update', 'advance'],
          description: 'Plan action',
        },
        goal: {
          type: 'string',
          description: 'Task goal',
        },
        phases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              title: { type: 'string' },
              capabilities: { type: 'object' },
            },
          },
          description: 'Execution phases',
        },
        current_phase_id: { type: 'number' },
        next_phase_id: { type: 'number' },
      },
      required: ['action', 'current_phase_id'],
    },
  },
  {
    name: 'shell',
    description: 'Execute shell commands in the sandbox',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['exec', 'view', 'wait', 'send', 'kill'],
        },
        session: { type: 'string' },
        command: { type: 'string' },
        timeout: { type: 'number' },
        input: { type: 'string' },
        brief: { type: 'string' },
      },
      required: ['action', 'session', 'brief'],
    },
  },
  {
    name: 'file',
    description: 'Read, write, or edit files',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['view', 'read', 'write', 'append', 'edit'],
        },
        path: { type: 'string' },
        text: { type: 'string' },
        range: {
          type: 'array',
          items: { type: 'number' },
        },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              find: { type: 'string' },
              replace: { type: 'string' },
              all: { type: 'boolean' },
            },
          },
        },
        brief: { type: 'string' },
      },
      required: ['action', 'path', 'brief'],
    },
  },
  {
    name: 'search',
    description: 'Search for information',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['info', 'image', 'api', 'news', 'tool', 'data', 'research'],
        },
        queries: {
          type: 'array',
          items: { type: 'string' },
        },
        time: {
          type: 'string',
          enum: ['all', 'past_day', 'past_week', 'past_month', 'past_year'],
        },
        brief: { type: 'string' },
      },
      required: ['type', 'queries', 'brief'],
    },
  },
  {
    name: 'browser_navigate',
    description: 'Navigate browser to a URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        intent: {
          type: 'string',
          enum: ['navigational', 'informational', 'transactional'],
        },
        focus: { type: 'string' },
        brief: { type: 'string' },
      },
      required: ['url', 'intent', 'brief'],
    },
  },
  {
    name: 'browser_click',
    description: 'Click an element on the page',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number' },
        coordinate_x: { type: 'number' },
        coordinate_y: { type: 'number' },
        brief: { type: 'string' },
      },
      required: ['brief'],
    },
  },
  {
    name: 'browser_input',
    description: 'Input text into a field',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number' },
        text: { type: 'string' },
        press_enter: { type: 'boolean' },
        brief: { type: 'string' },
      },
      required: ['text', 'press_enter', 'brief'],
    },
  },
];

// Default export
export default ManusClient;
