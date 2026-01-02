/**
 * Universal AI Conversation Importer
 * Extends existing ChatGPT/Claude import to support all major AI platforms
 * Auto-detects format and normalizes to standard structure
 */

export type ImportSource = 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'grok' | 'copilot' | 'unknown';

export interface StandardConversation {
  id: string;
  title: string;
  timestamp: Date;
  messages: Array<{ role: 'human' | 'assistant'; content: string; timestamp?: number }>;
  source: ImportSource;
  metadata?: Record<string, any>;
}

/**
 * Auto-detect source format from JSON structure
 */
export function detectSource(data: any): ImportSource {
  // Debug logging to help diagnose format detection
  console.log('[UniversalImporter] Detecting source:', {
    isArray: Array.isArray(data),
    topLevelKeys: Array.isArray(data) ? 'array' : Object.keys(data || {}),
    firstItemKeys: Array.isArray(data) && data[0] ? Object.keys(data[0]) : null
  });

  // Handle arrays
  if (Array.isArray(data)) {
    const first = data[0];
    if (!first) return 'unknown';
    
    // ChatGPT: has mapping property with message nodes
    if (first.mapping && typeof first.mapping === 'object') return 'chatgpt';
    
    // Claude patterns - multiple detection methods:
    // 1. Has chat_messages array (original format)
    if (first.chat_messages && Array.isArray(first.chat_messages)) return 'claude';
    // 2. Has uuid + name + created_at (Claude conversation pattern)
    if (first.uuid && 'name' in first && first.created_at) return 'claude';
    // 3. Has conversation_id + account (Claude Stories format)
    if (first.conversation_id && first.account) return 'claude';
    
    // Gemini: messages with parts array containing text
    if (first.messages?.[0]?.parts?.[0]?.text !== undefined) return 'gemini';
    
    // Perplexity: has sources in messages
    if (first.messages?.[0]?.sources) return 'perplexity';
    
    // Grok: has tweet_mode or xAI signature
    if (first.tweet_mode !== undefined || first.provider === 'xai') return 'grok';
    
    // Copilot: has copilot_conversations or microsoft signature  
    if (first.copilot_conversations || first.author === 'copilot') return 'copilot';
  }
  
  // Handle wrapper objects (e.g., { conversations: [...] })
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // Check for conversations wrapper
    if (data.conversations && Array.isArray(data.conversations)) {
      // Recurse with unwrapped array
      return detectSource(data.conversations);
    }
    
    // Check for chats wrapper (some exports use this)
    if (data.chats && Array.isArray(data.chats)) {
      return detectSource(data.chats);
    }
    
    // Check for data wrapper
    if (data.data && Array.isArray(data.data)) {
      return detectSource(data.data);
    }
  }
  
  // Handle objects with nested arrays
  if (data.threads && Array.isArray(data.threads)) return 'perplexity';
  
  // Single conversation object detection
  if (data.mapping) return 'chatgpt';
  if (data.chat_messages) return 'claude';
  if (data.uuid && 'name' in data && data.created_at) return 'claude';
  if (data.conversation_id && data.account) return 'claude';
  if (data.chunks) return 'gemini';
  
  console.log('[UniversalImporter] Could not detect source, returning unknown');
  return 'unknown';
}

/**
 * Parse Gemini export (Google Takeout format)
 */
function parseGemini(data: any): StandardConversation[] {
  const conversations = data.conversations || data;
  if (!Array.isArray(conversations)) return [];
  
  return conversations.map((conv: any) => ({
    id: `gemini-${conv.id || crypto.randomUUID()}`,
    title: conv.title || conv.name || 'Gemini Conversation',
    timestamp: new Date(conv.create_time || conv.created_at || Date.now()),
    messages: (conv.messages || [])
      .filter((m: any) => m.parts?.[0]?.text || m.content)
      .map((m: any) => ({
        role: (m.role === 'user' || m.author?.role === 'user') ? 'human' as const : 'assistant' as const,
        content: m.parts?.map((p: any) => p.text).join('') || m.content || '',
        timestamp: m.create_time ? new Date(m.create_time).getTime() : undefined
      }))
      .filter((m: any) => m.content.trim()),
    source: 'gemini' as ImportSource,
    metadata: { originalId: conv.id }
  })).filter((c: StandardConversation) => c.messages.length >= 2);
}

/**
 * Parse Perplexity export
 */
function parsePerplexity(data: any): StandardConversation[] {
  const threads = data.threads || data;
  if (!Array.isArray(threads)) return [];
  
  return threads.map((thread: any) => ({
    id: `perplexity-${thread.id || crypto.randomUUID()}`,
    title: thread.title || thread.query || 'Perplexity Search',
    timestamp: new Date(thread.created_at || thread.timestamp || Date.now()),
    messages: (thread.messages || thread.turns || [])
      .map((m: any) => ({
        role: (m.role === 'user' || m.type === 'query') ? 'human' as const : 'assistant' as const,
        content: m.content || m.text || m.answer || '',
      }))
      .filter((m: any) => m.content.trim()),
    source: 'perplexity' as ImportSource,
    metadata: {
      sources: thread.messages?.flatMap((m: any) => m.sources || m.citations || []) || []
    }
  })).filter((c: StandardConversation) => c.messages.length >= 2);
}

/**
 * Parse Grok export (X/Twitter AI)
 */
function parseGrok(data: any): StandardConversation[] {
  const conversations = data.conversations || data;
  if (!Array.isArray(conversations)) return [];
  
  return conversations.map((conv: any) => ({
    id: `grok-${conv.id || crypto.randomUUID()}`,
    title: conv.title || 'Grok Conversation',
    timestamp: new Date(conv.created_at || conv.timestamp || Date.now()),
    messages: (conv.messages || [])
      .map((m: any) => ({
        role: (m.sender === 'user' || m.role === 'user') ? 'human' as const : 'assistant' as const,
        content: m.text || m.content || '',
        timestamp: m.timestamp ? new Date(m.timestamp).getTime() : undefined
      }))
      .filter((m: any) => m.content.trim()),
    source: 'grok' as ImportSource
  })).filter((c: StandardConversation) => c.messages.length >= 2);
}

/**
 * Parse Copilot export (Microsoft)
 */
function parseCopilot(data: any): StandardConversation[] {
  const conversations = data.conversations || data.chats || data;
  if (!Array.isArray(conversations)) return [];
  
  return conversations.map((conv: any) => ({
    id: `copilot-${conv.id || crypto.randomUUID()}`,
    title: conv.title || conv.name || 'Copilot Conversation',
    timestamp: new Date(conv.created_at || conv.startTime || Date.now()),
    messages: (conv.messages || conv.turns || [])
      .map((m: any) => ({
        role: (m.author === 'user' || m.role === 'user' || m.sender === 'user') ? 'human' as const : 'assistant' as const,
        content: m.text || m.content || m.message || '',
      }))
      .filter((m: any) => m.content.trim()),
    source: 'copilot' as ImportSource
  })).filter((c: StandardConversation) => c.messages.length >= 2);
}

/**
 * Main parsing function - auto-detects and parses any supported format
 */
export async function parseUniversalExport(file: File): Promise<{
  source: ImportSource;
  conversations: StandardConversation[];
}> {
  const text = await file.text();
  let data: any;
  
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid JSON file. Please upload a valid export file.');
  }
  
  const source = detectSource(data);
  let conversations: StandardConversation[] = [];
  
  switch (source) {
    case 'chatgpt':
      // Use existing ChatGPT parser, convert to standard format
      const { parseChatGPTExport, extractMessages } = await import('./chatgpt-importer');
      const chatgptConvs = await parseChatGPTExport(file);
      conversations = chatgptConvs.map(conv => ({
        id: `chatgpt-${conv.id}`,
        title: conv.title || 'ChatGPT Conversation',
        timestamp: new Date(conv.create_time * 1000),
        messages: extractMessages(conv.mapping).map(m => ({
          role: m.role === 'user' ? 'human' as const : 'assistant' as const,
          content: m.text,
          timestamp: m.time ? m.time * 1000 : undefined
        })),
        source: 'chatgpt' as ImportSource
      })).filter(c => c.messages.length >= 2);
      break;
      
    case 'claude':
      // Handle multiple Claude export formats
      let claudeData: any[];
      
      if (Array.isArray(data)) {
        claudeData = data;
      } else if (data.conversations && Array.isArray(data.conversations)) {
        claudeData = data.conversations;
      } else if (data.chats && Array.isArray(data.chats)) {
        claudeData = data.chats;
      } else if (data.data && Array.isArray(data.data)) {
        claudeData = data.data;
      } else {
        claudeData = [data];
      }
      
      conversations = claudeData.map((conv: any) => {
        // Handle different Claude message formats
        let messages: Array<{ role: 'human' | 'assistant'; content: string; timestamp?: number }> = [];
        
        if (conv.chat_messages && Array.isArray(conv.chat_messages)) {
          // Original Claude format with chat_messages
          messages = conv.chat_messages
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((m: any) => ({
              role: m.sender === 'human' ? 'human' as const : 'assistant' as const,
              content: m.text || m.content || '',
              timestamp: m.created_at ? new Date(m.created_at).getTime() : undefined
            }))
            .filter((m: any) => m.content.trim());
        } else if (conv.messages && Array.isArray(conv.messages)) {
          // Alternative format with messages array
          messages = conv.messages
            .map((m: any) => ({
              role: (m.role === 'user' || m.sender === 'human') ? 'human' as const : 'assistant' as const,
              content: m.content || m.text || '',
              timestamp: m.timestamp ? new Date(m.timestamp).getTime() : undefined
            }))
            .filter((m: any) => m.content.trim());
        }
        
        return {
          id: `claude-${conv.uuid || conv.conversation_id || conv.id || crypto.randomUUID()}`,
          title: conv.name || conv.title || 'Claude Conversation',
          messages,
          timestamp: conv.created_at ? new Date(conv.created_at) : new Date(),
          source: 'claude' as ImportSource
        };
      }).filter((c: StandardConversation) => c.messages.length >= 2);
      break;
      
    case 'gemini':
      conversations = parseGemini(data);
      break;
      
    case 'perplexity':
      conversations = parsePerplexity(data);
      break;
      
    case 'grok':
      conversations = parseGrok(data);
      break;
      
    case 'copilot':
      conversations = parseCopilot(data);
      break;
      
    default:
      throw new Error('Unrecognized file format. Supported: ChatGPT, Claude, Gemini, Perplexity, Grok, Copilot');
  }
  
  if (conversations.length === 0) {
    throw new Error('No valid conversations found in the file.');
  }
  
  return { source, conversations };
}

/**
 * Get display name for import source
 */
export function getSourceDisplayName(source: ImportSource): string {
  const names: Record<ImportSource, string> = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
    grok: 'Grok',
    copilot: 'Copilot',
    unknown: 'Unknown'
  };
  return names[source];
}

/**
 * Import standard conversations into memory system
 */
export async function importStandardConversations(
  conversations: StandardConversation[],
  encryptionKey: CryptoKey,
  onProgress: (progress: { current: number; total: number; title: string }) => void
): Promise<{
  imported: number;
  skipped: number;
  failed: number;
  totalMessages: number;
  topTopics: Array<{ topic: string; count: number }>;
}> {
  const { addMemory } = await import('../memory-store');
  const { embed } = await import('../embedding-engine');
  
  const result = {
    imported: 0,
    skipped: 0,
    failed: 0,
    totalMessages: 0,
    topTopics: [] as Array<{ topic: string; count: number }>
  };
  
  const topicCounts: Record<string, number> = {};
  
  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    onProgress({ current: i + 1, total: conversations.length, title: conv.title.slice(0, 50) });
    
    try {
      // Format content
      const content = conv.messages
        .map(m => `${m.role === 'human' ? 'Human' : 'Assistant'}: ${m.content}`)
        .join('\n\n---\n\n');
      
      // Extract topics from title
      const words = conv.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);
      words.slice(0, 3).forEach(w => {
        topicCounts[w] = (topicCounts[w] || 0) + 1;
      });
      
      // Generate embedding for the content
      const embedding = await embed(conv.title + ' ' + content.slice(0, 1000));
      
      // Create memory item with correct MemoryMetadata structure
      // Store the actual AI platform (claude, chatgpt, etc.) in aiPlatform field
      const memoryItem = {
        id: conv.id,
        content: content,
        embedding: embedding,
        metadata: {
          source: 'chat' as const,
          aiPlatform: conv.source, // Store actual platform: 'claude', 'chatgpt', 'gemini', etc.
          title: conv.title,
          createdAt: conv.timestamp.getTime(),
          conversationId: conv.id
        }
      };
      
      // Add to memory using existing memory store
      await addMemory(memoryItem, encryptionKey);
      
      result.imported++;
      result.totalMessages += conv.messages.length;
      
    } catch (err) {
      result.failed++;
      console.error(`Failed to import ${conv.title}:`, err);
    }
    
    // Prevent UI freeze
    if (i % 10 === 0) {
      await new Promise(r => setTimeout(r, 10));
    }
  }
  
  result.topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));
  
  return result;
}
