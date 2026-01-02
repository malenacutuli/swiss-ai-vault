/**
 * Distill conversations, documents, and voice chats into structured insights
 * Extracts key points, topics, action items, decisions using AI
 */

export interface DistilledInsight {
  id: string;
  sourceId: string;
  sourceType: 'chat' | 'document' | 'voice';  // Added 'voice'
  title: string;
  aiPlatform?: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  actionItems: string[];
  decisions: string[];
  questions: string[];
  entities?: {
    people?: string[];
    companies?: string[];
    technologies?: string[];
  };
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  importance?: 'high' | 'medium' | 'low';
  category?: string;
  createdAt: string;
}

// Voice-specific prompt for better spoken conversation analysis
const VOICE_DISTILL_PROMPT = `You are an expert knowledge analyst. Analyze this voice conversation transcript and extract insights.

VOICE TRANSCRIPT:
{content}

TITLE: {title}

Since this is a spoken conversation:
- Focus on the natural flow and key exchanges
- Identify questions asked and answers given
- Note verbal commitments and action items
- Capture decisions made during discussion

Extract in JSON format:
{
  "summary": "2-3 sentence summary of what was discussed",
  "keyPoints": ["main points from the conversation"],
  "topics": ["topics covered - 1-3 words each"],
  "actionItems": ["specific tasks or commitments mentioned"],
  "decisions": ["decisions reached or conclusions drawn"],
  "questions": ["important questions raised"],
  "entities": {
    "people": ["names mentioned"],
    "companies": ["organizations discussed"],
    "technologies": ["tech/tools referenced"]
  },
  "sentiment": "positive|neutral|negative|mixed",
  "importance": "high|medium|low",
  "category": "meeting|brainstorm|planning|learning|personal"
}

Return ONLY valid JSON.`;

const DISTILL_PROMPT = `You are an expert knowledge analyst. Analyze the following content and extract structured insights.

CONTENT TO ANALYZE:
{content}

SOURCE TYPE: {sourceType}
TITLE: {title}

Extract the following in JSON format:
{
  "summary": "A compelling 2-3 sentence summary that captures the essence",
  "keyPoints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "topics": ["topic1", "topic2", "topic3"],
  "actionItems": ["Specific action that can be taken"],
  "decisions": ["Decision or conclusion that was made"],
  "questions": ["Important question that remains open"],
  "entities": {
    "people": ["Names mentioned"],
    "companies": ["Companies mentioned"],
    "technologies": ["Technologies discussed"]
  },
  "sentiment": "positive|neutral|negative|mixed",
  "importance": "high|medium|low",
  "category": "work|personal|learning|project|meeting|research"
}

RULES:
1. Be specific and concrete, not generic
2. Extract ACTUAL names, dates, numbers mentioned
3. Topics should be 1-3 words each
4. Return ONLY valid JSON, no markdown or explanation`;

/**
 * Distill a single conversation into insights using Lovable AI
 */
// Custom error for rate limits
export class RateLimitError extends Error {
  constructor(message: string, public retryAfterSeconds?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export async function distillConversation(
  memory: { id: string; title: string; content: string; source: string; aiPlatform?: string; metadata?: Record<string, unknown> },
  accessToken?: string  // User's JWT session token - if provided, bypasses anonymous limits
): Promise<DistilledInsight | null> {
  // Truncate very long content
  const content = memory.content.slice(0, 8000);
  
  // Check if this is a voice conversation
  const isVoice = memory.aiPlatform === 'swissvault' || 
                  memory.metadata?.isVoiceChat === true ||
                  memory.source === 'voice';
  
  // Use voice-specific prompt for voice content
  const prompt = isVoice
    ? VOICE_DISTILL_PROMPT
        .replace('{content}', content)
        .replace('{title}', memory.title)
    : DISTILL_PROMPT
        .replace('{content}', content)
        .replace('{sourceType}', memory.source)
        .replace('{title}', memory.title);
  
  try {
    // Use session token if provided, otherwise fall back to anon key (will hit rate limits)
    const authToken = accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // CRITICAL: Use gpt-4o-mini for distillation (500+ RPM vs 10 RPM for gemini-2.0-flash-exp)
    const DISTILL_MODEL = 'gpt-4o-mini';
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-inference`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: DISTILL_MODEL,
        temperature: 0.3,
        max_tokens: 1500,
        stream: false  // Non-streaming for batch processing
      })
    });
    
    // CRITICAL: Check for rate limit BEFORE parsing body
    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}));
      const retryAfter = errorData.resets_in_seconds || 60;
      throw new RateLimitError(
        errorData.error || 'Rate limit reached',
        retryAfter
      );
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Distillation API error:', response.status, errorText);
      
      // Check if error text indicates rate limit
      if (errorText.includes('limit') || errorText.includes('429')) {
        throw new RateLimitError(errorText);
      }
      return null;
    }
    
    // Handle streaming response
    const reader = response.body?.getReader();
    if (!reader) return null;
    
    const decoder = new TextDecoder();
    let fullContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Check for error in streamed response
            if (data.error) {
              if (data.error.includes('limit') || data.signup_required) {
                throw new RateLimitError(data.error, data.resets_in_seconds);
              }
            }
            
            const deltaContent = data.choices?.[0]?.delta?.content;
            if (deltaContent) fullContent += deltaContent;
          } catch (parseError) {
            // Re-throw rate limit errors
            if (parseError instanceof RateLimitError) throw parseError;
            // Skip other malformed chunks
          }
        }
      }
    }
    
    // Parse JSON from response
    const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in distill response');
      return null;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Determine source type - voice takes priority
    const sourceType: 'chat' | 'document' | 'voice' = isVoice 
      ? 'voice' 
      : (memory.source as 'chat' | 'document');
    
    return {
      id: `insight-${memory.id}-${Date.now()}`,
      sourceId: memory.id,
      sourceType,
      title: memory.title,
      aiPlatform: memory.aiPlatform,
      summary: parsed.summary || '',
      keyPoints: parsed.keyPoints || [],
      topics: parsed.topics || [],
      actionItems: parsed.actionItems || [],
      decisions: parsed.decisions || [],
      questions: parsed.questions || [],
      entities: parsed.entities || {},
      sentiment: parsed.sentiment || 'neutral',
      importance: parsed.importance || 'medium',
      category: parsed.category || 'general',
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    // Re-throw rate limit errors so caller can handle them
    if (error instanceof RateLimitError) {
      throw error;
    }
    console.error('Distillation error:', error);
    return null;
  }
}

/**
 * Batch distill multiple conversations
 */
export async function distillBatch(
  memories: Array<{ id: string; title: string; content: string; source: string }>,
  onProgress: (current: number, total: number, title: string) => void,
  accessToken?: string  // User's JWT session token
): Promise<DistilledInsight[]> {
  const insights: DistilledInsight[] = [];
  
  // Filter to only meaningful conversations (500+ chars)
  const toProcess = memories.filter(m => m.content.length >= 500);
  
  for (let i = 0; i < toProcess.length; i++) {
    const memory = toProcess[i];
    onProgress(i + 1, toProcess.length, memory.title.slice(0, 40));
    
    try {
      const insight = await distillConversation(memory, accessToken);
      if (insight) insights.push(insight);
    } catch (err) {
      // Re-throw rate limit errors
      if (err instanceof RateLimitError) throw err;
      console.error(`Failed to distill ${memory.title}:`, err);
    }
    
    // Rate limiting - 1s between calls
    await new Promise(r => setTimeout(r, 1000));
  }
  
  return insights;
}

/**
 * Store distilled insights in IndexedDB
 */
const INSIGHTS_STORE = 'insights';

async function getInsightsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SwissVaultInsights', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(INSIGHTS_STORE)) {
        const store = db.createObjectStore(INSIGHTS_STORE, { keyPath: 'id' });
        store.createIndex('sourceId', 'sourceId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveInsight(insight: DistilledInsight): Promise<void> {
  const db = await getInsightsDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(INSIGHTS_STORE, 'readwrite');
    tx.objectStore(INSIGHTS_STORE).put(insight);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getInsights(): Promise<DistilledInsight[]> {
  const db = await getInsightsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INSIGHTS_STORE, 'readonly');
    const request = tx.objectStore(INSIGHTS_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getDistilledSourceIds(): Promise<Set<string>> {
  const insights = await getInsights();
  return new Set(insights.map(i => i.sourceId));
}

export async function clearInsights(): Promise<void> {
  const db = await getInsightsDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(INSIGHTS_STORE, 'readwrite');
    tx.objectStore(INSIGHTS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteInsight(id: string): Promise<void> {
  const db = await getInsightsDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(INSIGHTS_STORE, 'readwrite');
    tx.objectStore(INSIGHTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
