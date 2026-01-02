/**
 * Distill conversations into structured insights
 * Extracts key points, topics, action items, decisions from imported conversations
 */

export interface DistilledInsight {
  id: string;
  sourceId: string;
  sourceType: string;
  title: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  actionItems: string[];
  decisions: string[];
  questions: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  createdAt: string;
}

const DISTILL_PROMPT = `Analyze this conversation and extract structured insights.

CONVERSATION:
{content}

Extract and return JSON with these fields:
- summary: 2-3 sentence overview of what was discussed
- keyPoints: Array of main points discussed (3-7 items)
- topics: Array of topic keywords/themes (3-5 items)
- actionItems: Array of action items or next steps mentioned (if any)
- decisions: Array of decisions made (if any)
- questions: Array of open questions or unresolved issues (if any)
- sentiment: Overall sentiment - "positive", "neutral", or "negative"

Return ONLY valid JSON, no markdown or explanation.`;

/**
 * Distill a single conversation into insights using Lovable AI
 */
export async function distillConversation(
  memory: { id: string; title: string; content: string; source: string }
): Promise<DistilledInsight> {
  // Truncate very long conversations
  const content = memory.content.slice(0, 6000);
  
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-inference`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
    },
    body: JSON.stringify({
      messages: [{
        role: 'user',
        content: DISTILL_PROMPT.replace('{content}', content)
      }],
      model: 'gemini-2.0-flash', // Fast and cheap
      temperature: 0.3,
      max_tokens: 1000
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to distill conversation');
  }
  
  // Handle streaming response
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  
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
          const content = data.choices?.[0]?.delta?.content;
          if (content) fullContent += content;
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
  
  let parsed: any;
  
  try {
    // Handle both direct JSON and markdown-wrapped JSON
    let jsonStr = fullContent;
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse distill response:', fullContent);
    // Return minimal insight on parse failure
    parsed = {
      summary: 'Unable to extract summary',
      keyPoints: [],
      topics: [],
      actionItems: [],
      decisions: [],
      questions: [],
      sentiment: 'neutral'
    };
  }
  
  return {
    id: `insight-${memory.id}-${Date.now()}`,
    sourceId: memory.id,
    sourceType: memory.source,
    title: memory.title,
    summary: parsed.summary || '',
    keyPoints: parsed.keyPoints || [],
    topics: parsed.topics || [],
    actionItems: parsed.actionItems || [],
    decisions: parsed.decisions || [],
    questions: parsed.questions || [],
    sentiment: parsed.sentiment || 'neutral',
    createdAt: new Date().toISOString()
  };
}

/**
 * Batch distill multiple conversations
 */
export async function distillBatch(
  memories: Array<{ id: string; title: string; content: string; source: string }>,
  onProgress: (current: number, total: number, title: string) => void
): Promise<DistilledInsight[]> {
  const insights: DistilledInsight[] = [];
  
  // Filter to only meaningful conversations (500+ chars)
  const toProcess = memories.filter(m => m.content.length >= 500);
  
  for (let i = 0; i < toProcess.length; i++) {
    const memory = toProcess[i];
    onProgress(i + 1, toProcess.length, memory.title.slice(0, 40));
    
    try {
      const insight = await distillConversation(memory);
      insights.push(insight);
    } catch (err) {
      console.error(`Failed to distill ${memory.title}:`, err);
    }
    
    // Rate limiting - 500ms between calls
    await new Promise(r => setTimeout(r, 500));
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
