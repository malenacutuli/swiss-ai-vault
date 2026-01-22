/**
 * Manus-Parity API Client
 * 
 * Handles communication with the agent backend API, including:
 * - Task creation and management
 * - WebSocket streaming for real-time events
 * - File uploads and downloads
 * - Error handling with retry logic
 */

import {
  Task,
  CreateTaskRequest,
  CreateTaskResponse,
  AgentEvent,
  ApiError,
  ErrorCode,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
} from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  retryConfig?: RetryConfig;
  onEvent?: (event: AgentEvent) => void;
}

const DEFAULT_CONFIG: Partial<ApiClientConfig> = {
  baseUrl: '/api',
  retryConfig: DEFAULT_RETRY_CONFIG,
};

// =============================================================================
// API CLIENT
// =============================================================================

export class ManusApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly retryConfig: RetryConfig;
  private readonly onEvent?: (event: AgentEvent) => void;
  private eventSource: EventSource | null = null;
  private reconnectAttempts: number = 0;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl || DEFAULT_CONFIG.baseUrl!;
    this.apiKey = config.apiKey;
    this.retryConfig = config.retryConfig || DEFAULT_CONFIG.retryConfig!;
    this.onEvent = config.onEvent;
  }

  // ---------------------------------------------------------------------------
  // Request Helpers
  // ---------------------------------------------------------------------------

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retryCount: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        
        // Check if we should retry
        if (error.retryable && retryCount < this.retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(retryCount);
          await this.sleep(delay);
          return this.request<T>(method, path, body, retryCount + 1);
        }
        
        throw error;
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'TypeError') {
        // Network error - retry if possible
        if (retryCount < this.retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(retryCount);
          await this.sleep(delay);
          return this.request<T>(method, path, body, retryCount + 1);
        }
        
        throw this.createError('E005', 'Network error: Unable to connect to server');
      }
      throw error;
    }
  }

  private async parseError(response: Response): Promise<ApiError> {
    try {
      const data = await response.json();
      return {
        code: data.code || this.statusToErrorCode(response.status),
        message: data.message || response.statusText,
        details: data.details,
        retryable: this.isRetryable(response.status),
        retryAfter: response.headers.get('Retry-After') 
          ? parseInt(response.headers.get('Retry-After')!) 
          : undefined,
      };
    } catch {
      return {
        code: this.statusToErrorCode(response.status),
        message: response.statusText,
        retryable: this.isRetryable(response.status),
      };
    }
  }

  private statusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case 400: return 'E001';
      case 401:
      case 403: return 'E002';
      case 404: return 'E004';
      case 429: return 'E003';
      default: return 'E005';
    }
  }

  private isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private createError(code: ErrorCode, message: string): ApiError {
    return {
      code,
      message,
      retryable: code === 'E003' || code === 'E005' || code === 'E007',
    };
  }

  private calculateRetryDelay(retryCount: number): number {
    return Math.min(
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, retryCount),
      this.retryConfig.maxDelayMs
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Task Management
  // ---------------------------------------------------------------------------

  async createTask(request: CreateTaskRequest): Promise<CreateTaskResponse> {
    return this.request<CreateTaskResponse>('POST', '/agent/tasks', request);
  }

  async getTask(taskId: string): Promise<Task> {
    return this.request<Task>('GET', `/agent/tasks/${taskId}`);
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.request<void>('DELETE', `/agent/tasks/${taskId}`);
  }

  async listTasks(params?: { status?: string; limit?: number; offset?: number }): Promise<Task[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    
    const queryString = query.toString();
    const path = `/agent/tasks${queryString ? `?${queryString}` : ''}`;
    
    return this.request<Task[]>('GET', path);
  }

  // ---------------------------------------------------------------------------
  // Event Streaming
  // ---------------------------------------------------------------------------

  connectToStream(taskId: string): void {
    if (this.eventSource) {
      this.disconnectFromStream();
    }

    const url = `${this.baseUrl}/agent/run/${taskId}/stream`;
    this.eventSource = new EventSource(url);
    this.reconnectAttempts = 0;

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AgentEvent;
        this.onEvent?.(data);
      } catch (error) {
        console.error('[ApiClient] Failed to parse event:', error);
      }
    };

    this.eventSource.onerror = () => {
      console.error('[ApiClient] EventSource error, attempting reconnect...');
      this.handleStreamError(taskId);
    };

    this.eventSource.onopen = () => {
      console.log('[ApiClient] EventSource connected');
      this.reconnectAttempts = 0;
    };
  }

  private handleStreamError(taskId: string): void {
    if (this.reconnectAttempts >= this.retryConfig.maxRetries) {
      console.error('[ApiClient] Max reconnect attempts reached');
      this.disconnectFromStream();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateRetryDelay(this.reconnectAttempts - 1);
    
    console.log(`[ApiClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connectToStream(taskId);
    }, delay);
  }

  disconnectFromStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async uploadFile(file: File): Promise<{ fileId: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
      body: formData,
    });

    if (!response.ok) {
      throw await this.parseError(response);
    }

    return response.json();
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw await this.parseError(response);
    }

    return response.blob();
  }

  // ---------------------------------------------------------------------------
  // Health Check
  // ---------------------------------------------------------------------------

  async checkHealth(): Promise<{ status: string; version: string }> {
    return this.request<{ status: string; version: string }>('GET', '/health');
  }

  async getStatus(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/status');
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createApiClient(config: ApiClientConfig): ManusApiClient {
  return new ManusApiClient(config);
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let defaultClient: ManusApiClient | null = null;

export function getApiClient(): ManusApiClient {
  if (!defaultClient) {
    defaultClient = new ManusApiClient({
      baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
    });
  }
  return defaultClient;
}

export function setApiClient(client: ManusApiClient): void {
  defaultClient = client;
}
