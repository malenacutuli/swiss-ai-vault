// src/lib/memory/migration.ts
// Password-protected memory export/import for cross-origin migration

import {
  encrypt,
  decrypt,
  deriveKeyFromPassword,
  generateSalt,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  type EncryptedData
} from '@/lib/crypto/zerotrace-crypto';
import type { MemoryItem, MemoryMetadata } from './memory-store';

const MIGRATION_VERSION = 2;

interface MigrationExport {
  version: number;
  exportedAt: number;
  count: number;
  salt: string; // For PBKDF2 key derivation
  encrypted: EncryptedData; // All memories encrypted with password-derived key
}

// ==========================================
// EXPORT WITH PASSWORD
// ==========================================

/**
 * Export all memories with password protection for cross-origin migration
 * 
 * Flow:
 * 1. Decrypt all memories with the current vault key
 * 2. Derive a temporary key from user's export password
 * 3. Re-encrypt all content with the password-derived key
 * 4. Return as downloadable JSON
 */
export async function exportMemoriesWithPassword(
  password: string,
  encryptionKey: CryptoKey,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  // Lazy import to avoid circular dependency
  const { getAllMemoriesDecrypted } = await import('./memory-store');
  
  // Step 1: Get all decrypted memories
  onProgress?.(0, 100);
  const memories = await getAllMemoriesDecrypted(encryptionKey);
  
  if (memories.length === 0) {
    throw new Error('No memories to export');
  }
  
  onProgress?.(30, 100);
  
  // Step 2: Derive key from password
  const salt = generateSalt();
  const passwordKey = await deriveKeyFromPassword(password, salt);
  
  onProgress?.(50, 100);
  
  // Step 3: Serialize and encrypt all memories with password key
  const payload = JSON.stringify(memories);
  const encrypted = await encrypt(payload, passwordKey);
  
  onProgress?.(80, 100);
  
  // Step 4: Create export package
  const exportData: MigrationExport = {
    version: MIGRATION_VERSION,
    exportedAt: Date.now(),
    count: memories.length,
    salt: arrayBufferToBase64(salt),
    encrypted
  };
  
  onProgress?.(100, 100);
  
  return new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  });
}

// ==========================================
// IMPORT WITH PASSWORD
// ==========================================

/**
 * Import password-protected memories into current vault
 * 
 * Flow:
 * 1. Parse export file and extract salt
 * 2. Derive key from import password
 * 3. Decrypt the content
 * 4. Re-encrypt each memory with destination vault key
 * 5. Store in IndexedDB
 */
export async function importMemoriesWithPassword(
  file: File,
  password: string,
  encryptionKey: CryptoKey,
  onProgress?: (current: number, total: number) => void
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { addMemory, getAllMemoryIds } = await import('./memory-store');
  
  onProgress?.(0, 100);
  
  // Step 1: Parse export file
  const text = await file.text();
  let exportData: MigrationExport;
  
  try {
    exportData = JSON.parse(text);
  } catch {
    throw new Error('Invalid migration file format');
  }
  
  // Validate version
  if (exportData.version !== MIGRATION_VERSION) {
    if (exportData.version === 1) {
      throw new Error('This is a legacy export file encrypted with a different vault. Please use "Migrate Memory" from the source environment to create a password-protected export.');
    }
    throw new Error(`Unsupported migration version: ${exportData.version}`);
  }
  
  if (!exportData.salt || !exportData.encrypted) {
    throw new Error('Invalid migration file: missing salt or encrypted data');
  }
  
  onProgress?.(10, 100);
  
  // Step 2: Derive key from password
  const salt = base64ToArrayBuffer(exportData.salt);
  const passwordKey = await deriveKeyFromPassword(password, salt);
  
  onProgress?.(20, 100);
  
  // Step 3: Decrypt content
  let memories: MemoryItem[];
  try {
    const decrypted = await decrypt(exportData.encrypted, passwordKey);
    memories = JSON.parse(decrypted);
  } catch (error) {
    throw new Error('Incorrect password or corrupted file');
  }
  
  if (!Array.isArray(memories)) {
    throw new Error('Invalid migration file: memories not an array');
  }
  
  onProgress?.(30, 100);
  
  // Step 4: Get existing memory IDs to skip duplicates
  const existingIds = new Set(await getAllMemoryIds());
  
  // Step 5: Re-encrypt and store each memory
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    
    // Skip if already exists
    if (existingIds.has(mem.id)) {
      skipped++;
      continue;
    }
    
    try {
      // Add memory with new encryption
      await addMemory(
        {
          id: mem.id,
          content: mem.content,
          embedding: mem.embedding,
          metadata: mem.metadata
        },
        encryptionKey
      );
      imported++;
    } catch (error) {
      errors.push(`Failed to import "${mem.metadata?.title || mem.id}": ${error}`);
    }
    
    // Update progress (30-100%)
    const progressPercent = 30 + Math.round((i / memories.length) * 70);
    onProgress?.(progressPercent, 100);
  }
  
  return { imported, skipped, errors };
}

// ==========================================
// PREVIEW MIGRATION FILE
// ==========================================

/**
 * Preview a migration file without importing (shows count, doesn't need password)
 */
export async function previewMigrationFile(file: File): Promise<{
  count: number;
  exportedAt: number;
  version: number;
  isPasswordProtected: boolean;
}> {
  const text = await file.text();
  const data = JSON.parse(text);
  
  return {
    count: data.count || 0,
    exportedAt: data.exportedAt || 0,
    version: data.version || 0,
    isPasswordProtected: data.version === MIGRATION_VERSION && !!data.salt
  };
}

// ==========================================
// ENVIRONMENT DETECTION
// ==========================================

/**
 * Check if current environment is a preview/development environment
 */
export function isPreviewEnvironment(): boolean {
  const hostname = window.location.hostname;
  return (
    hostname.includes('lovableproject.com') ||
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1') ||
    hostname.includes('preview') ||
    hostname.includes('.local')
  );
}

/**
 * Get environment label for display
 */
export function getEnvironmentLabel(): string {
  const hostname = window.location.hostname;
  
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'Local Development';
  }
  if (hostname.includes('lovableproject.com')) {
    return 'Preview';
  }
  if (hostname.includes('preview')) {
    return 'Preview';
  }
  return 'Production';
}
