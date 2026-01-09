// Dev Server Manager with Hot Module Replacement
// Manages development servers for sandbox environments

export interface DevServerConfig {
  framework: 'vite' | 'nextjs' | 'express' | 'fastapi' | 'generic';
  port: number;
  command: string;
  env?: Record<string, string>;
  hmrPort?: number;
}

export interface DevServerStatus {
  id: string;
  sandboxId: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  port: number;
  hmrPort?: number;
  previewUrl: string;
  startedAt?: Date;
  lastActivity?: Date;
  error?: string;
}

export interface HMRMetrics {
  fileChangeDetection: number;  // Target: <10ms
  hmrCompilation: number;       // Target: <50ms
  browserUpdate: number;        // Target: <30ms
  totalLatency: number;         // Target: <100ms
  timestamp: Date;
}

// Framework-specific configurations
const FRAMEWORK_CONFIGS: Record<string, Partial<DevServerConfig>> = {
  'vite': {
    framework: 'vite',
    port: 5173,
    command: 'npx vite --host',
    hmrPort: 24678,
  },
  'nextjs': {
    framework: 'nextjs',
    port: 3000,
    command: 'npx next dev',
    hmrPort: 3001,
  },
  'express': {
    framework: 'express',
    port: 3000,
    command: 'npx tsx watch src/index.ts',
  },
  'fastapi': {
    framework: 'fastapi',
    port: 8000,
    command: 'uvicorn main:app --reload --host 0.0.0.0',
  },
  'generic': {
    framework: 'generic',
    port: 8080,
    command: 'npx serve -l 8080',
  },
};

export class DevServerManager {
  private servers: Map<string, DevServerStatus> = new Map();
  private metricsHistory: Map<string, HMRMetrics[]> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();

  /**
   * Start a development server for a sandbox
   */
  async startServer(
    sandboxId: string,
    framework: string,
    options?: Partial<DevServerConfig>
  ): Promise<DevServerStatus> {
    const baseConfig = FRAMEWORK_CONFIGS[framework] || FRAMEWORK_CONFIGS['generic'];
    const config: DevServerConfig = {
      ...baseConfig,
      ...options,
    } as DevServerConfig;

    const serverId = `dev-${sandboxId}-${Date.now()}`;
    const status: DevServerStatus = {
      id: serverId,
      sandboxId,
      status: 'starting',
      port: config.port,
      hmrPort: config.hmrPort,
      previewUrl: this.buildPreviewUrl(sandboxId, config.port),
    };

    this.servers.set(serverId, status);

    try {
      // In production, this would call the sandbox API to start the server
      await this.executeServerStart(sandboxId, config);

      status.status = 'running';
      status.startedAt = new Date();
      status.lastActivity = new Date();

      // Set up HMR WebSocket proxy if supported
      if (config.hmrPort) {
        await this.setupHMRProxy(serverId, sandboxId, config.hmrPort);
      }

      this.servers.set(serverId, status);
      return status;
    } catch (error) {
      status.status = 'error';
      status.error = error instanceof Error ? error.message : 'Failed to start server';
      this.servers.set(serverId, status);
      throw error;
    }
  }

  /**
   * Stop a development server
   */
  async stopServer(serverId: string): Promise<void> {
    const status = this.servers.get(serverId);
    if (!status) return;

    // Close HMR WebSocket connection
    const ws = this.wsConnections.get(serverId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(serverId);
    }

    // In production, call sandbox API to stop the server
    status.status = 'stopped';
    this.servers.set(serverId, status);
  }

  /**
   * Get server status
   */
  getServerStatus(serverId: string): DevServerStatus | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get all servers for a sandbox
   */
  getServersBySandbox(sandboxId: string): DevServerStatus[] {
    return Array.from(this.servers.values())
      .filter(s => s.sandboxId === sandboxId);
  }

  /**
   * Record HMR metrics
   */
  recordHMRMetrics(serverId: string, metrics: Omit<HMRMetrics, 'timestamp' | 'totalLatency'>): void {
    const fullMetrics: HMRMetrics = {
      ...metrics,
      totalLatency: metrics.fileChangeDetection + metrics.hmrCompilation + metrics.browserUpdate,
      timestamp: new Date(),
    };

    const history = this.metricsHistory.get(serverId) || [];
    history.push(fullMetrics);
    
    // Keep last 100 metrics
    if (history.length > 100) {
      history.shift();
    }
    
    this.metricsHistory.set(serverId, history);
  }

  /**
   * Get HMR performance stats
   */
  getHMRStats(serverId: string): {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    count: number;
  } | null {
    const history = this.metricsHistory.get(serverId);
    if (!history || history.length === 0) return null;

    const latencies = history.map(m => m.totalLatency).sort((a, b) => a - b);
    const count = latencies.length;

    return {
      p50: latencies[Math.floor(count * 0.5)],
      p95: latencies[Math.floor(count * 0.95)],
      p99: latencies[Math.floor(count * 0.99)],
      avg: latencies.reduce((a, b) => a + b, 0) / count,
      count,
    };
  }

  /**
   * Build preview URL for sandbox
   */
  private buildPreviewUrl(sandboxId: string, port: number): string {
    // In production, this would use the actual sandbox proxy URL
    return `https://${sandboxId}.sandbox.swissbrain.ai:${port}`;
  }

  /**
   * Execute server start command in sandbox
   */
  private async executeServerStart(
    sandboxId: string,
    config: DevServerConfig
  ): Promise<void> {
    // In production, this would call the sandbox execution API
    console.log(`[DevServer] Starting ${config.framework} server in sandbox ${sandboxId}`);
    console.log(`[DevServer] Command: ${config.command}`);
    console.log(`[DevServer] Port: ${config.port}`);
    
    // Simulate startup delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Set up HMR WebSocket proxy
   */
  private async setupHMRProxy(
    serverId: string,
    sandboxId: string,
    hmrPort: number
  ): Promise<void> {
    // In production, this would establish a WebSocket connection
    // to the sandbox's HMR server and proxy updates to the client
    console.log(`[DevServer] Setting up HMR proxy for ${serverId} on port ${hmrPort}`);
  }

  /**
   * Handle HMR update from sandbox
   */
  handleHMRUpdate(serverId: string, update: {
    type: 'update' | 'full-reload';
    modules?: string[];
    timestamp: number;
  }): void {
    const status = this.servers.get(serverId);
    if (status) {
      status.lastActivity = new Date();
      this.servers.set(serverId, status);
    }

    // Broadcast to connected clients
    console.log(`[HMR] Update for ${serverId}:`, update);
  }

  /**
   * Check if a framework supports HMR
   */
  static supportsHMR(framework: string): boolean {
    return ['vite', 'nextjs'].includes(framework);
  }

  /**
   * Get default config for framework
   */
  static getDefaultConfig(framework: string): Partial<DevServerConfig> {
    return FRAMEWORK_CONFIGS[framework] || FRAMEWORK_CONFIGS['generic'];
  }
}

// Singleton instance
export const devServerManager = new DevServerManager();
