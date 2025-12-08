/**
 * Encryption Types
 * Type definitions for ZeroTrace E2E encryption system.
 */

export type RetentionMode = 'zerotrace' | '1day' | '1week' | '90days' | 'forever';

export interface EncryptedConversation {
  id: string;
  userId: string;
  organizationId: string | null;
  encryptedTitle: string | null;
  titleNonce: string;
  keyVersion: number;
  keyHash: string;
  modelId: string;
  isEncrypted: boolean;
  zeroRetention: boolean;
  retentionMode: RetentionMode;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
}

export interface EncryptedMessage {
  id: string;
  conversationId: string;
  ciphertext: string;
  nonce: string;
  role: 'user' | 'assistant' | 'system';
  sequenceNumber: number;
  tokenCount: number | null;
  hasAttachments: boolean;
  createdAt: string;
}

export interface ConversationKey {
  conversationId: string;
  wrappedKey: string;
  nonce: string;
  keyVersion: number;
  createdAt: string;
}

export interface DecryptedMessage {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  sequenceNumber: number;
  tokenCount: number | null;
  hasAttachments: boolean;
  createdAt: string;
}

export interface DecryptedConversation {
  id: string;
  userId: string;
  organizationId: string | null;
  title: string;
  modelId: string;
  isEncrypted: boolean;
  zeroRetention: boolean;
  retentionMode: RetentionMode;
  keyVersion: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
}

export interface EncryptedDocument {
  id: string;
  userId: string;
  conversationId: string | null;
  encryptedFilename: string;
  filenameNonce: string;
  fileType: string;
  fileSize: number | null;
  chunkCount: number;
  keyVersion: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface UserEncryptionSettings {
  userId: string;
  kdfSalt: string;
  kdfIterations: number;
  kdfMemory: number;
  keyVerificationHash: string | null;
  zeroRetentionDefault: boolean;
  autoLockMinutes: number;
  recoveryKeyHash: string | null;
  createdAt: string;
  updatedAt: string;
}
