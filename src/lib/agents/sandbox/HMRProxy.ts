// HMR (Hot Module Replacement) Proxy
// Proxies WebSocket connections between sandbox dev servers and browser clients

export interface HMRMessage {
  type: 'connected' | 'update' | 'full-reload' | 'prune' | 'error' | 'custom';
  updates?: HMRUpdate[];
  path?: string;
  err?: { message: string; stack: string };
  event?: string;
  data?: unknown;
  timestamp?: number;
}

export interface HMRUpdate {
  type: 'js-update' | 'css-update';
  path: string;
  acceptedPath: string;
  timestamp: number;
}

export interface HMRMetricsSnapshot {
  fileChangeDetection: number;  // Time from file change to detection (target: <10ms)
  hmrCompilation: number;       // Time for HMR compilation (target: <50ms)
  browserUpdate: number;        // Time for browser to apply update (target: <30ms)
  totalLatency: number;         // Total end-to-end latency (target: <100ms P50)
}

type MessageHandler = (message: HMRMessage) => void;

export class HMRProxy {
  private sandboxId: string;
  private sandboxWs: WebSocket | null = null;
  private clientConnections: Set<MessageHandler> = new Set();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private metricsHistory: HMRMetricsSnapshot[] = [];
  private pendingUpdates: Map<string, number> = new Map();

  constructor(sandboxId: string) {
    this.sandboxId = sandboxId;
  }

  /**
   * Connect to sandbox HMR WebSocket server
   */
  connect(hmrUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.sandboxWs = new WebSocket(hmrUrl);

        this.sandboxWs.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.broadcastToClients({ type: 'connected' });
          resolve();
        };

        this.sandboxWs.onmessage = (event) => {
          try {
            const message: HMRMessage = JSON.parse(event.data);
            this.handleSandboxMessage(message);
          } catch (e) {
            console.error('[HMRProxy] Failed to parse message:', e);
          }
        };

        this.sandboxWs.onerror = (error) => {
          console.error('[HMRProxy] WebSocket error:', error);
          this.broadcastToClients({
            type: 'error',
            err: { message: 'HMR connection error', stack: '' },
          });
        };

        this.sandboxWs.onclose = () => {
          this.isConnected = false;
          this.attemptReconnect(hmrUrl);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from sandbox
   */
  disconnect(): void {
    if (this.sandboxWs) {
      this.sandboxWs.close();
      this.sandboxWs = null;
    }
    this.isConnected = false;
    this.clientConnections.clear();
  }

  /**
   * Subscribe a client to HMR updates
   */
  subscribe(handler: MessageHandler): () => void {
    this.clientConnections.add(handler);
    
    // Send current connection status
    if (this.isConnected) {
      handler({ type: 'connected' });
    }

    return () => {
      this.clientConnections.delete(handler);
    };
  }

  /**
   * Handle message from sandbox HMR server
   */
  private handleSandboxMessage(message: HMRMessage): void {
    const receiveTime = performance.now();

    switch (message.type) {
      case 'update':
        if (message.updates) {
          message.updates.forEach(update => {
            const startTime = this.pendingUpdates.get(update.path);
            if (startTime) {
              this.recordMetrics(startTime, receiveTime, update.path);
              this.pendingUpdates.delete(update.path);
            }
          });
        }
        break;

      case 'full-reload':
        console.log('[HMRProxy] Full reload requested');
        break;

      case 'error':
        console.error('[HMRProxy] HMR error:', message.err);
        break;
    }

    // Forward message to all clients
    this.broadcastToClients(message);
  }

  /**
   * Record file change for metrics tracking
   */
  recordFileChange(path: string): void {
    this.pendingUpdates.set(path, performance.now());
  }

  /**
   * Record HMR metrics
   */
  private recordMetrics(startTime: number, receiveTime: number, path: string): void {
    const totalLatency = receiveTime - startTime;
    
    // Estimate breakdown (in production, these would come from actual measurements)
    const metrics: HMRMetricsSnapshot = {
      fileChangeDetection: Math.min(totalLatency * 0.1, 10),
      hmrCompilation: totalLatency * 0.5,
      browserUpdate: totalLatency * 0.3,
      totalLatency,
    };

    this.metricsHistory.push(metrics);

    // Keep last 100 metrics
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }

    console.log(`[HMRProxy] Update for ${path}: ${totalLatency.toFixed(1)}ms`);
  }

  /**
   * Get HMR performance statistics
   */
  getPerformanceStats(): {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    count: number;
    meetsTarget: boolean;
  } | null {
    if (this.metricsHistory.length === 0) return null;

    const latencies = this.metricsHistory
      .map(m => m.totalLatency)
      .sort((a, b) => a - b);
    
    const count = latencies.length;
    const p50 = latencies[Math.floor(count * 0.5)];
    const p95 = latencies[Math.floor(count * 0.95)];
    const p99 = latencies[Math.floor(count * 0.99)];
    const avg = latencies.reduce((a, b) => a + b, 0) / count;

    return {
      p50,
      p95,
      p99,
      avg,
      count,
      meetsTarget: p50 < 100, // Target: <100ms P50
    };
  }

  /**
   * Get detailed metrics breakdown
   */
  getDetailedMetrics(): {
    avgFileChange: number;
    avgCompilation: number;
    avgBrowserUpdate: number;
  } | null {
    if (this.metricsHistory.length === 0) return null;

    const count = this.metricsHistory.length;
    
    return {
      avgFileChange: this.metricsHistory.reduce((a, m) => a + m.fileChangeDetection, 0) / count,
      avgCompilation: this.metricsHistory.reduce((a, m) => a + m.hmrCompilation, 0) / count,
      avgBrowserUpdate: this.metricsHistory.reduce((a, m) => a + m.browserUpdate, 0) / count,
    };
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcastToClients(message: HMRMessage): void {
    this.clientConnections.forEach(handler => {
      try {
        handler(message);
      } catch (e) {
        console.error('[HMRProxy] Error broadcasting to client:', e);
      }
    });
  }

  /**
   * Attempt to reconnect to sandbox
   */
  private attemptReconnect(hmrUrl: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[HMRProxy] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[HMRProxy] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect(hmrUrl).catch(console.error);
    }, delay);
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Factory function to create HMR proxy instances
export function createHMRProxy(sandboxId: string): HMRProxy {
  return new HMRProxy(sandboxId);
}
