// src/lib/memory/sync.ts
// Memory sync providers for cloud backup

export type SyncProviderType = 'none' | 'google-drive' | 's3' | 'swissvault-cloud';

export interface SyncStatus {
  connected: boolean;
  email?: string;
  lastSync: number | null;
  storageUsed?: number;
  storageLimit?: number;
}

export interface SyncProviderInfo {
  type: SyncProviderType;
  name: string;
  icon: string;
  available: boolean;
}

export interface SyncProvider {
  type: SyncProviderType;
  name: string;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getStatus(): Promise<SyncStatus>;
  
  upload(data: Blob, filename: string): Promise<void>;
  download(filename: string): Promise<Blob | null>;
  list(): Promise<string[]>;
  delete(filename: string): Promise<void>;
  
  getLastSyncTime(): Promise<number | null>;
  setLastSyncTime(timestamp: number): Promise<void>;
}

// ==========================================
// LOCAL STORAGE KEYS
// ==========================================

const PROVIDER_KEY = 'swissvault_sync_provider';
const LAST_SYNC_KEY = 'swissvault_last_sync';

// ==========================================
// AVAILABLE PROVIDERS
// ==========================================

export function getAvailableProviders(): SyncProviderInfo[] {
  return [
    {
      type: 'none',
      name: 'Local Only',
      icon: 'hard-drive',
      available: true
    },
    {
      type: 'google-drive',
      name: 'Google Drive',
      icon: 'cloud',
      available: false // Coming soon
    },
    {
      type: 's3',
      name: 'Amazon S3',
      icon: 'database',
      available: false // Enterprise only
    },
    {
      type: 'swissvault-cloud',
      name: 'SwissVault Cloud',
      icon: 'shield',
      available: false // Coming soon
    }
  ];
}

// ==========================================
// PROVIDER PERSISTENCE
// ==========================================

export function getSavedProviderType(): SyncProviderType {
  try {
    const saved = localStorage.getItem(PROVIDER_KEY);
    if (saved && ['none', 'google-drive', 's3', 'swissvault-cloud'].includes(saved)) {
      return saved as SyncProviderType;
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'none';
}

export function saveProviderType(type: SyncProviderType): void {
  try {
    localStorage.setItem(PROVIDER_KEY, type);
  } catch {
    // Ignore localStorage errors
  }
}

// ==========================================
// LOCAL-ONLY PROVIDER (DEFAULT)
// ==========================================

class LocalOnlyProvider implements SyncProvider {
  type: SyncProviderType = 'none';
  name = 'Local Only';
  
  async connect(): Promise<void> {
    // No-op for local
  }
  
  async disconnect(): Promise<void> {
    // No-op for local
  }
  
  isConnected(): boolean {
    return true; // Local is always "connected"
  }
  
  async getStatus(): Promise<SyncStatus> {
    return {
      connected: true,
      lastSync: await this.getLastSyncTime()
    };
  }
  
  async upload(): Promise<void> {
    // Local doesn't upload anywhere
  }
  
  async download(): Promise<Blob | null> {
    return null;
  }
  
  async list(): Promise<string[]> {
    return [];
  }
  
  async delete(): Promise<void> {
    // No-op
  }
  
  async getLastSyncTime(): Promise<number | null> {
    try {
      const saved = localStorage.getItem(LAST_SYNC_KEY);
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  }
  
  async setLastSyncTime(timestamp: number): Promise<void> {
    try {
      localStorage.setItem(LAST_SYNC_KEY, String(timestamp));
    } catch {
      // Ignore
    }
  }
}

// ==========================================
// GOOGLE DRIVE PROVIDER (PLACEHOLDER)
// ==========================================

class GoogleDriveProvider implements SyncProvider {
  type: SyncProviderType = 'google-drive';
  name = 'Google Drive';
  
  private connected = false;
  private email: string | null = null;
  
  async connect(): Promise<void> {
    // TODO: Implement Google Drive OAuth
    throw new Error('Google Drive sync coming soon');
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
    this.email = null;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async getStatus(): Promise<SyncStatus> {
    return {
      connected: this.connected,
      email: this.email ?? undefined,
      lastSync: await this.getLastSyncTime()
    };
  }
  
  async upload(): Promise<void> {
    throw new Error('Not implemented');
  }
  
  async download(): Promise<Blob | null> {
    return null;
  }
  
  async list(): Promise<string[]> {
    return [];
  }
  
  async delete(): Promise<void> {
    throw new Error('Not implemented');
  }
  
  async getLastSyncTime(): Promise<number | null> {
    try {
      const saved = localStorage.getItem(`${LAST_SYNC_KEY}_gdrive`);
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  }
  
  async setLastSyncTime(timestamp: number): Promise<void> {
    try {
      localStorage.setItem(`${LAST_SYNC_KEY}_gdrive`, String(timestamp));
    } catch {
      // Ignore
    }
  }
}

// ==========================================
// S3 PROVIDER (PLACEHOLDER)
// ==========================================

class S3Provider implements SyncProvider {
  type: SyncProviderType = 's3';
  name = 'Amazon S3';
  
  async connect(): Promise<void> {
    throw new Error('S3 sync available for Enterprise customers');
  }
  
  async disconnect(): Promise<void> {}
  
  isConnected(): boolean {
    return false;
  }
  
  async getStatus(): Promise<SyncStatus> {
    return { connected: false, lastSync: null };
  }
  
  async upload(): Promise<void> {
    throw new Error('Not implemented');
  }
  
  async download(): Promise<Blob | null> {
    return null;
  }
  
  async list(): Promise<string[]> {
    return [];
  }
  
  async delete(): Promise<void> {}
  
  async getLastSyncTime(): Promise<number | null> {
    return null;
  }
  
  async setLastSyncTime(): Promise<void> {}
}

// ==========================================
// SWISSVAULT CLOUD PROVIDER (PLACEHOLDER)
// ==========================================

class SwissVaultCloudProvider implements SyncProvider {
  type: SyncProviderType = 'swissvault-cloud';
  name = 'SwissVault Cloud';
  
  async connect(): Promise<void> {
    throw new Error('SwissVault Cloud sync coming soon');
  }
  
  async disconnect(): Promise<void> {}
  
  isConnected(): boolean {
    return false;
  }
  
  async getStatus(): Promise<SyncStatus> {
    return { connected: false, lastSync: null };
  }
  
  async upload(): Promise<void> {
    throw new Error('Not implemented');
  }
  
  async download(): Promise<Blob | null> {
    return null;
  }
  
  async list(): Promise<string[]> {
    return [];
  }
  
  async delete(): Promise<void> {}
  
  async getLastSyncTime(): Promise<number | null> {
    return null;
  }
  
  async setLastSyncTime(): Promise<void> {}
}

// ==========================================
// FACTORY
// ==========================================

export function createSyncProvider(type: SyncProviderType): SyncProvider {
  switch (type) {
    case 'google-drive':
      return new GoogleDriveProvider();
    case 's3':
      return new S3Provider();
    case 'swissvault-cloud':
      return new SwissVaultCloudProvider();
    case 'none':
    default:
      return new LocalOnlyProvider();
  }
}
