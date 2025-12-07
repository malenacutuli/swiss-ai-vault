/**
 * ZeroTrace Cryptographic Library
 * All encryption happens client-side. Keys never leave the browser.
 * Uses Web Crypto API exclusively - no external crypto libraries.
 */

// Constants
const AES_KEY_LENGTH = 256;
const AES_GCM_NONCE_LENGTH = 12; // 96 bits
const AES_GCM_TAG_LENGTH = 128; // bits
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16; // bytes

// Types
export interface EncryptedData {
  ciphertext: string;  // Base64
  nonce: string;       // Base64
}

export interface KeyMaterial {
  key: CryptoKey;
  salt: string;        // Base64, only for password-derived keys
}

// ==========================================
// KEY GENERATION
// ==========================================

/**
 * Generate a random AES-256 key for conversation encryption
 */
export async function generateConversationKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,  // extractable for wrapping
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate random bytes for nonce/salt
 */
export function generateNonce(): ArrayBuffer {
  const nonce = new Uint8Array(AES_GCM_NONCE_LENGTH);
  crypto.getRandomValues(nonce);
  return nonce.buffer as ArrayBuffer;
}

export function generateSalt(): ArrayBuffer {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt.buffer as ArrayBuffer;
}

// ==========================================
// PASSWORD-BASED KEY DERIVATION
// ==========================================

/**
 * Derive User Master Key from password using PBKDF2
 * In production, consider using Argon2id via WebAssembly
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: ArrayBuffer
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive AES key
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,  // extractable for key verification
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

// ==========================================
// ENCRYPTION / DECRYPTION
// ==========================================

/**
 * Encrypt plaintext with AES-256-GCM
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const nonce = generateNonce();
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: AES_GCM_TAG_LENGTH },
    key,
    encoder.encode(plaintext)
  );
  
  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    nonce: arrayBufferToBase64(nonce)
  };
}

/**
 * Decrypt ciphertext with AES-256-GCM
 */
export async function decrypt(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
  const nonce = base64ToArrayBuffer(encryptedData.nonce);
  
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: AES_GCM_TAG_LENGTH },
    key,
    ciphertext
  );
  
  return decoder.decode(plaintext);
}

// ==========================================
// KEY WRAPPING (for storing CEKs encrypted)
// ==========================================

/**
 * Wrap a key with another key (for storing CEK encrypted by UMK)
 */
export async function wrapKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey
): Promise<EncryptedData> {
  const nonce = generateNonce();
  
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    wrappingKey,
    { name: 'AES-GCM', iv: nonce, tagLength: AES_GCM_TAG_LENGTH }
  );
  
  return {
    ciphertext: arrayBufferToBase64(wrappedKey),
    nonce: arrayBufferToBase64(nonce)
  };
}

/**
 * Unwrap a key
 */
export async function unwrapKey(
  wrappedData: EncryptedData,
  unwrappingKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedKey = base64ToArrayBuffer(wrappedData.ciphertext);
  const nonce = base64ToArrayBuffer(wrappedData.nonce);
  
  return await crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    unwrappingKey,
    { name: 'AES-GCM', iv: nonce, tagLength: AES_GCM_TAG_LENGTH },
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// ==========================================
// KEY VERIFICATION
// ==========================================

/**
 * Generate hash of key for verification (never sends key itself)
 */
export async function hashKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  const hash = await crypto.subtle.digest('SHA-256', exported);
  return arrayBufferToBase64(hash);
}

/**
 * Verify key matches expected hash
 */
export async function verifyKeyHash(
  key: CryptoKey,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await hashKey(key);
  return actualHash === expectedHash;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}
