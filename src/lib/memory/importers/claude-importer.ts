// Claude conversation import functionality
import { initEmbeddings, embed } from '@/lib/memory/embedding-engine';
import { addMemory, type MemorySource } from '@/lib/memory/memory-store';

export interface ClaudeMessage {
  uuid: string;
  text: string;
  sender: 'human' | 'assistant';
  created_at: string;
}

export interface ClaudeConversation {
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  chat_messages: ClaudeMessage[];
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

export async function parseClaudeExport(file: File): Promise<ClaudeConversation[]> {
  const text = await file.text();
  const data = JSON.parse(text);
  
  // Claude exports conversations.json as an array
  return Array.isArray(data) ? data : [data];
}

export function extractClaudeMessages(conversation: ClaudeConversation): string[] {
  return conversation.chat_messages
    .filter(msg => msg.text && msg.text.trim())
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(msg => `${msg.sender === 'human' ? 'Human' : 'Assistant'}: ${msg.text}`);
}

// Chunk a conversation into smaller pieces for embedding
function chunkConversation(messages: string[], maxChunkSize: number = 2000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const message of messages) {
    if (currentChunk.length + message.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = message;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + message;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

export async function importClaudeHistory(
  conversations: ClaudeConversation[],
  encryptionKey: CryptoKey,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
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
  
  // Initialize embeddings engine
  onProgress({
    current: 0,
    total: conversations.length,
    currentTitle: 'Initializing...',
    phase: 'parsing'
  });
  
  await initEmbeddings((p) => {
    onProgress({
      current: 0,
      total: conversations.length,
      currentTitle: p.message || 'Loading AI...',
      phase: 'parsing'
    });
  });
  
  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    
    onProgress({
      current: i + 1,
      total: conversations.length,
      currentTitle: conv.name || 'Untitled',
      phase: 'processing'
    });
    
    try {
      const messages = extractClaudeMessages(conv);
      
      // Skip conversations with too few messages
      if (messages.length < 2) {
        result.skipped++;
        continue;
      }
      
      // Track date range
      const timestamp = new Date(conv.created_at);
      if (timestamp < result.dateRange.earliest) {
        result.dateRange.earliest = timestamp;
      }
      if (timestamp > result.dateRange.latest) {
        result.dateRange.latest = timestamp;
      }
      
      // Extract topic from title
      const topic = conv.name?.split(' ').slice(0, 3).join(' ') || 'General';
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      
      // Chunk the conversation for better retrieval
      const chunks = chunkConversation(messages);
      
      onProgress({
        current: i + 1,
        total: conversations.length,
        currentTitle: conv.name || 'Untitled',
        phase: 'embedding'
      });
      
      // Process each chunk
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const embedding = await embed(chunk);
        
        await addMemory({
          id: `claude-${conv.uuid}-${chunkIndex}`,
          content: chunk,
          embedding,
          metadata: {
            title: conv.name || 'Untitled Conversation',
            source: 'chat' as MemorySource,
            createdAt: timestamp.getTime(),
            conversationId: conv.uuid,
            chunkIndex,
            totalChunks: chunks.length,
          }
        }, encryptionKey);
      }
      
      result.imported++;
      result.totalMessages += messages.length;
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to import "${conv.name}": ${errorMsg}`);
    }
  }
  
  // Calculate top topics
  result.topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));
  
  onProgress({
    current: conversations.length,
    total: conversations.length,
    currentTitle: 'Complete',
    phase: 'complete'
  });
  
  return result;
}
