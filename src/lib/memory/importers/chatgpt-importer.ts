// ChatGPT Conversation Importer
// Imports conversations.json from ChatGPT data export

import { embed, isReady as isEmbeddingsReady, initEmbeddings } from '../embedding-engine';
import { addMemory, type MemoryItem } from '../memory-store';

// ==========================================
// TYPES
// ==========================================

export interface ChatGPTConversation {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, {
    id: string;
    message?: {
      id: string;
      author: { role: 'user' | 'assistant' | 'system' | 'tool' };
      content: { 
        content_type: string;
        parts?: string[];
        text?: string;
      };
      create_time?: number;
    };
    parent?: string;
    children?: string[];
  }>;
}

export interface ImportProgress {
  current: number;
  total: number;
  currentTitle: string;
  phase: 'parsing' | 'processing' | 'embedding' | 'complete';
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  topTopics: { topic: string; count: number }[];
  totalMessages: number;
  dateRange: { earliest: Date; latest: Date };
}

// ==========================================
// PARSING
// ==========================================

/**
 * Parse a ChatGPT export file (conversations.json)
 */
export async function parseChatGPTExport(file: File): Promise<ChatGPTConversation[]> {
  const text = await file.text();
  const data = JSON.parse(text);
  
  // Handle both array format and single conversation
  if (Array.isArray(data)) {
    return data.filter(item => item.mapping && item.id);
  }
  
  // Single conversation object
  if (data.mapping && data.id) {
    return [data];
  }
  
  throw new Error('Invalid ChatGPT export format. Expected conversations.json with mapping field.');
}

/**
 * Extract messages from a conversation's mapping structure
 */
export function extractMessages(mapping: ChatGPTConversation['mapping']): { text: string; time: number; role: string }[] {
  const messages: { text: string; time: number; role: string }[] = [];
  
  for (const node of Object.values(mapping)) {
    if (!node.message) continue;
    
    const role = node.message.author.role;
    if (role !== 'user' && role !== 'assistant') continue;
    
    // Get text content
    let text = '';
    const content = node.message.content;
    
    if (content.parts && content.parts.length > 0) {
      text = content.parts.filter(p => typeof p === 'string').join('');
    } else if (content.text) {
      text = content.text;
    }
    
    if (text.trim()) {
      messages.push({
        text: `${role === 'user' ? 'Human' : 'Assistant'}: ${text.trim()}`,
        time: node.message.create_time || 0,
        role
      });
    }
  }
  
  // Sort by time
  messages.sort((a, b) => a.time - b.time);
  return messages;
}

/**
 * Chunk a conversation into smaller pieces for embedding
 */
function chunkConversation(messages: string[], maxTokens: number = 500): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;
  
  for (const msg of messages) {
    const msgTokens = Math.ceil(msg.length / 4);
    
    if (currentTokens + msgTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [];
      currentTokens = 0;
    }
    
    currentChunk.push(msg);
    currentTokens += msgTokens;
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }
  
  return chunks;
}

// ==========================================
// IMPORT
// ==========================================

/**
 * Import ChatGPT conversation history into the memory system
 */
export async function importChatGPTHistory(
  conversations: ChatGPTConversation[],
  encryptionKey: CryptoKey,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
  // Initialize embeddings if needed
  if (!isEmbeddingsReady()) {
    onProgress({
      current: 0,
      total: conversations.length,
      currentTitle: 'Loading embedding model...',
      phase: 'parsing'
    });
    await initEmbeddings();
  }
  
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    topTopics: [],
    totalMessages: 0,
    dateRange: { 
      earliest: new Date(), 
      latest: new Date(0) 
    }
  };
  
  const topicCounts: Record<string, number> = {};
  
  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    
    onProgress({
      current: i + 1,
      total: conversations.length,
      currentTitle: conv.title || 'Untitled',
      phase: 'processing'
    });
    
    try {
      const messages = extractMessages(conv.mapping);
      
      // Skip conversations with less than 2 meaningful messages
      if (messages.length < 2) {
        result.skipped++;
        continue;
      }
      
      const timestamp = new Date((conv.create_time || 0) * 1000);
      
      // Track date range
      if (timestamp.getTime() > 0) {
        if (timestamp < result.dateRange.earliest) result.dateRange.earliest = timestamp;
        if (timestamp > result.dateRange.latest) result.dateRange.latest = timestamp;
      }
      
      // Extract topic from title
      const topic = conv.title?.split(' ').slice(0, 3).join(' ') || 'General';
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      
      // Chunk the conversation for better retrieval
      const messageTexts = messages.map(m => m.text);
      const chunks = chunkConversation(messageTexts);
      
      // Create memory items for each chunk
      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunkContent = chunks[chunkIdx];
        
        onProgress({
          current: i + 1,
          total: conversations.length,
          currentTitle: `${conv.title || 'Untitled'} (chunk ${chunkIdx + 1}/${chunks.length})`,
          phase: 'embedding'
        });
        
        // Generate embedding
        const embedding = await embed(chunkContent);
        
        const memoryItem: MemoryItem = {
          id: `chatgpt-${conv.id}-${chunkIdx}`,
          content: chunkContent,
          embedding,
          metadata: {
            source: 'chat',
            title: conv.title || 'Untitled ChatGPT Conversation',
            conversationId: `chatgpt-${conv.id}`,
            chunkIndex: chunkIdx,
            totalChunks: chunks.length,
            createdAt: timestamp.getTime() || Date.now()
          }
        };
        
        await addMemory(memoryItem, encryptionKey);
      }
      
      result.imported++;
      result.totalMessages += messages.length;
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to import "${conv.title || 'Untitled'}": ${errorMsg}`);
      console.error(`[ChatGPT Import] Error importing conversation:`, err);
    }
  }
  
  // Calculate top topics
  result.topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));
  
  // Ensure valid date range
  if (result.dateRange.earliest > result.dateRange.latest) {
    result.dateRange.earliest = new Date();
    result.dateRange.latest = new Date();
  }
  
  onProgress({
    current: conversations.length,
    total: conversations.length,
    currentTitle: 'Complete',
    phase: 'complete'
  });
  
  console.log(`[ChatGPT Import] Completed: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`);
  
  return result;
}
