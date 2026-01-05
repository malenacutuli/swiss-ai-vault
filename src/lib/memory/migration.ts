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
  console.log('[Migration] Starting password-protected export...');
  
  // Lazy import to avoid circular dependency
  const { getAllMemoriesDecrypted } = await import('./memory-store');
  
  // Step 1: Get all decrypted memories
  onProgress?.(0, 100);
  console.log('[Migration] Fetching all decrypted memories...');
  const memories = await getAllMemoriesDecrypted(encryptionKey);
  
  console.log('[Migration] Found', memories.length, 'memories to export');
  
  if (memories.length === 0) {
    throw new Error('No memories to export');
  }
  
  onProgress?.(30, 100);
  
  // Step 2: Derive key from password
  console.log('[Migration] Deriving key from password...');
  const salt = generateSalt();
  const passwordKey = await deriveKeyFromPassword(password, salt);
  console.log('[Migration] Password key derived successfully');
  
  onProgress?.(50, 100);
  
  // Step 3: Serialize and encrypt all memories with password key
  console.log('[Migration] Encrypting memories with password key...');
  const payload = JSON.stringify(memories);
  const encrypted = await encrypt(payload, passwordKey);
  console.log('[Migration] Encryption complete, payload size:', payload.length, 'bytes');
  
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
  console.log('[Migration] Export complete:', { version: MIGRATION_VERSION, count: memories.length });
  
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
  console.log('[Migration] Starting import from file:', file.name);
  
  const { addMemory, getAllMemoryIds } = await import('./memory-store');
  
  onProgress?.(0, 100);
  
  // Step 1: Parse export file
  console.log('[Migration] Reading file...');
  const text = await file.text();
  let exportData: MigrationExport;
  
  try {
    exportData = JSON.parse(text);
    console.log('[Migration] Parsed file:', { 
      version: exportData.version, 
      count: exportData.count,
      exportedAt: new Date(exportData.exportedAt).toISOString()
    });
  } catch (e) {
    console.error('[Migration] Failed to parse JSON:', e);
    throw new Error('Invalid migration file format');
  }
  
  // Validate version
  if (exportData.version !== MIGRATION_VERSION) {
    console.error('[Migration] Version mismatch:', exportData.version, '!==', MIGRATION_VERSION);
    if (exportData.version === 1) {
      throw new Error('This is a legacy export file encrypted with a different vault. Please use "Migrate Memory" from the source environment to create a password-protected export.');
    }
    throw new Error(`Unsupported migration version: ${exportData.version}`);
  }
  
  if (!exportData.salt || !exportData.encrypted) {
    console.error('[Migration] Missing required fields:', { hasSalt: !!exportData.salt, hasEncrypted: !!exportData.encrypted });
    throw new Error('Invalid migration file: missing salt or encrypted data');
  }
  
  onProgress?.(10, 100);
  
  // Step 2: Derive key from password
  console.log('[Migration] Deriving key from password...');
  const salt = base64ToArrayBuffer(exportData.salt);
  const passwordKey = await deriveKeyFromPassword(password, salt);
  console.log('[Migration] Password key derived successfully');
  
  onProgress?.(20, 100);
  
  // Step 3: Decrypt content
  console.log('[Migration] Decrypting content...');
  let memories: MemoryItem[];
  try {
    const decrypted = await decrypt(exportData.encrypted, passwordKey);
    memories = JSON.parse(decrypted);
    console.log('[Migration] Decrypted successfully, found', memories.length, 'memories');
  } catch (error) {
    console.error('[Migration] Decryption failed:', error);
    throw new Error('Incorrect password or corrupted file');
  }
  
  if (!Array.isArray(memories)) {
    console.error('[Migration] Decrypted content is not an array');
    throw new Error('Invalid migration file: memories not an array');
  }
  
  onProgress?.(30, 100);
  
  // Step 4: Get existing memory IDs to skip duplicates
  console.log('[Migration] Checking for existing memories...');
  const existingIds = new Set(await getAllMemoryIds());
  console.log('[Migration] Found', existingIds.size, 'existing memories in vault');
  
  // Step 5: Re-encrypt and store each memory
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  
  console.log('[Migration] Starting import of', memories.length, 'memories...');
  
  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    const title = mem.metadata?.title || mem.id;
    
    // Skip if already exists
    if (existingIds.has(mem.id)) {
      console.log('[Migration] Skipped (already exists):', mem.id, title);
      skipped++;
      continue;
    }
    
    try {
      console.log('[Migration] Importing:', mem.id, title);
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
      console.log('[Migration] Successfully imported:', mem.id);
    } catch (error) {
      const errorMsg = `Failed to import "${title}": ${error}`;
      console.error('[Migration]', errorMsg);
      errors.push(errorMsg);
    }
    
    // Update progress (30-100%)
    const progressPercent = 30 + Math.round((i / memories.length) * 70);
    onProgress?.(progressPercent, 100);
  }
  
  console.log('[Migration] Import complete:', { imported, skipped, errorCount: errors.length });
  
  // Post-import validation
  if (imported > 0) {
    console.log('[Migration] Validating imported memories...');
    try {
      const { getMemory } = await import('./memory-store');
      const firstImportedId = memories.find(m => !existingIds.has(m.id))?.id;
      if (firstImportedId) {
        const testMemory = await getMemory(firstImportedId, encryptionKey);
        if (testMemory) {
          console.log('[Migration] Validation successful - imported memories are readable');
        } else {
          console.warn('[Migration] Validation warning - could not read back imported memory');
        }
      }
    } catch (validationError) {
      console.error('[Migration] Validation failed:', validationError);
    }
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
