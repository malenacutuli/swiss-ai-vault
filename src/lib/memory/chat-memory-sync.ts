/**
 * Chat-to-Memory Sync
 * Automatically saves SwissVault chat conversations to Personal AI Memory
 */

import { addMemory, type MemoryItem, type MemorySource } from './memory-store';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SaveToChatOptions {
  minMessages?: number;      // Minimum messages to save (default: 2)
  minContentLength?: number; // Minimum total content length (default: 100)
  extractTopics?: boolean;   // Extract topics for tagging (default: true)
  source?: 'ghost_chat' | 'vault_chat'; // Source identifier
}

// Stop words to filter out when extracting topics
const STOP_WORDS = new Set([
  'about', 'would', 'could', 'should', 'their', 'there', 'which', 'these', 
  'those', 'being', 'other', 'after', 'before', 'through', 'between', 'under',
  'above', 'below', 'please', 'thank', 'thanks', 'hello', 'right', 'going',
  'think', 'really', 'actually', 'something', 'anything', 'everything'
]);

/**
 * Extract simple topics from text based on word frequency
 */
function extractTopicsFromText(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4 && !STOP_WORDS.has(w));
  
  // Count word frequency
  const freq: Record<string, number> = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });
  
  // Get top 5 most frequent meaningful words
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Generate embedding for the conversation content
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { embed } = await import('./embedding-engine');
    return await embed(text);
  } catch (error) {
    console.error('[ChatMemorySync] Failed to generate embedding:', error);
    // Return zero vector as fallback
    return new Array(384).fill(0);
  }
}

/**
 * Save a complete conversation to memory
 * Returns the memory ID if saved, null if skipped
 */
export async function saveChatToMemory(
  conversation: ChatConversation,
  encryptionKey: CryptoKey,
  options?: SaveToChatOptions
): Promise<string | null> {
  const { 
    minMessages = 2, 
    minContentLength = 100,
    extractTopics = true,
    source = 'ghost_chat'
  } = options || {};
  
  // Skip if conversation too short
  if (conversation.messages.length < minMessages) {
    console.log('[ChatMemorySync] Skipping - too few messages:', conversation.messages.length);
    return null;
  }
  
  // Calculate total content
  const totalContent = conversation.messages
    .map(m => m.content)
    .join(' ');
  
  if (totalContent.length < minContentLength) {
    console.log('[ChatMemorySync] Skipping - content too short:', totalContent.length);
    return null;
  }
  
  // Format conversation for memory - create a readable summary
  const formattedContent = conversation.messages
    .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
    .join('\n\n---\n\n');
  
  // Truncate if too long (keep first 10000 chars for embedding quality)
  const contentForEmbedding = formattedContent.length > 10000 
    ? formattedContent.slice(0, 10000) + '...' 
    : formattedContent;
  
  // Extract topics from title and content
  const topics = extractTopics 
    ? extractTopicsFromText(conversation.title + ' ' + totalContent)
    : [];
  
  // Generate embedding
  const embedding = await generateEmbedding(contentForEmbedding);
  
  const memoryId = `swissvault-chat-${conversation.id}`;
  
  const memoryItem: MemoryItem = {
    id: memoryId,
    content: formattedContent,
    embedding,
    metadata: {
      source: 'chat' as MemorySource,
      title: conversation.title || 'SwissVault Conversation',
      conversationId: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      // Extended metadata stored as JSON in filename field for compatibility
      filename: JSON.stringify({
        messageCount: conversation.messages.length,
        model: conversation.model,
        savedToMemory: Date.now(),
        topics,
        chatSource: source
      })
    }
  };
  
  try {
    await addMemory(memoryItem, encryptionKey);
    console.log('[ChatMemorySync] Saved conversation to memory:', memoryId);
    return memoryId;
  } catch (err) {
    console.error('[ChatMemorySync] Failed to save chat to memory:', err);
    return null;
  }
}

/**
 * Check if a conversation is already saved to memory
 */
export async function isConversationSaved(conversationId: string, encryptionKey: CryptoKey): Promise<boolean> {
  try {
    const { getMemory } = await import('./memory-store');
    const memoryId = `swissvault-chat-${conversationId}`;
    const existing = await getMemory(memoryId, encryptionKey);
    return existing !== null;
  } catch {
    return false;
  }
}

/**
 * Get saved conversation IDs from memory
 */
export async function getSavedConversationIds(encryptionKey: CryptoKey): Promise<Set<string>> {
  try {
    const { getAllMemoryIds } = await import('./memory-store');
    const allIds = await getAllMemoryIds();
    const savedIds = new Set<string>();
    
    for (const id of allIds) {
      if (id.startsWith('swissvault-chat-')) {
        savedIds.add(id.replace('swissvault-chat-', ''));
      }
    }
    
    return savedIds;
  } catch {
    return new Set();
  }
}

/**
 * Storage key for auto-save preference
 */
const AUTO_SAVE_KEY = 'swissvault_auto_save_memory';

/**
 * Get auto-save preference from localStorage
 */
export function getAutoSavePreference(): boolean {
  try {
    const saved = localStorage.getItem(AUTO_SAVE_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
}

/**
 * Set auto-save preference in localStorage
 */
export function setAutoSavePreference(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_SAVE_KEY, String(enabled));
  } catch {
    console.error('[ChatMemorySync] Failed to save preference');
  }
}
