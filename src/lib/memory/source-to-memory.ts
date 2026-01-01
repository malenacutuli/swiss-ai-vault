// src/lib/memory/source-to-memory.ts

/**
 * Source-to-Memory Pipeline
 * 
 * Allows users to save verified web sources to their personal memory.
 * This creates a feedback loop:
 *   Web Search → Verify → Save → Future RAG queries use saved sources
 */

import type { WebSource } from '@/lib/trust/verified-search';
import { addMemory, type MemoryItem } from '@/lib/memory/memory-store';
import { embed } from '@/lib/memory/embedding-engine';

export interface SavedWebSource {
  id: string;
  originalUrl: string;
  domain: string;
  title: string;
  content: string;
  snippet: string;
  trustScore: number;
  tierLabel: string;
  savedAt: number;
  fetchedAt: number;
  userNotes?: string;
  tags?: string[];
  relatedQuery: string;
  isArchived: boolean;
  lastAccessed?: number;
  accessCount: number;
}

export interface SaveSourceOptions {
  fetchFullContent?: boolean;
  addUserNotes?: string;
  tags?: string[];
  folderId?: string;
}

export interface SaveSourceResult {
  success: boolean;
  sourceId: string;
  chunksCreated: number;
  error?: string;
}

/**
 * Fetch full content from a URL
 */
async function fetchFullContent(url: string): Promise<{
  content: string;
  title: string;
  publishedDate?: string;
  author?: string;
}> {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const data = await response.json();
    const html = data.contents;
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove scripts, styles, nav, footer, etc.
    const removeSelectors = [
      'script', 'style', 'nav', 'footer', 'header', 
      'aside', '.sidebar', '.nav', '.menu', '.footer',
      '.header', '.advertisement', '.ad', '.social-share',
      'iframe', 'noscript'
    ];
    
    removeSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Get main content
    const mainSelectors = [
      'article', 'main', '.article', '.post', '.content',
      '.entry-content', '.post-content', '#content', '#main'
    ];
    
    let mainContent = '';
    for (const selector of mainSelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent) {
        mainContent = element.textContent;
        break;
      }
    }
    
    if (!mainContent) {
      mainContent = doc.body?.textContent || '';
    }
    
    mainContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    const title = doc.querySelector('title')?.textContent || 
                  doc.querySelector('h1')?.textContent ||
                  'Untitled';
    
    const dateSelectors = [
      'time[datetime]',
      '.published', '.date', '.post-date',
      'meta[property="article:published_time"]'
    ];
    
    let publishedDate: string | undefined;
    for (const selector of dateSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        publishedDate = element.getAttribute('datetime') || 
                       element.getAttribute('content') ||
                       element.textContent || undefined;
        break;
      }
    }
    
    const authorSelectors = [
      '.author', '.byline', '[rel="author"]',
      'meta[name="author"]', 'meta[property="article:author"]'
    ];
    
    let author: string | undefined;
    for (const selector of authorSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        author = element.getAttribute('content') || 
                element.textContent || undefined;
        break;
      }
    }
    
    return {
      content: mainContent,
      title: title.trim(),
      publishedDate,
      author
    };
  } catch (error) {
    console.error('Failed to fetch full content:', error);
    throw error;
  }
}

/**
 * Chunk content for memory storage
 */
function chunkContent(content: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(' ');
      const overlapWords = Math.ceil(overlap / 5);
      currentChunk = words.slice(-overlapWords).join(' ') + ' ' + paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Save a web source to memory
 */
export async function saveWebSourceToMemory(
  source: WebSource,
  encryptionKey: CryptoKey,
  options: SaveSourceOptions = {}
): Promise<SaveSourceResult> {
  const sourceId = crypto.randomUUID();
  
  try {
    let content: string;
    let title = source.title;
    let publishedDate: string | undefined;
    let author: string | undefined;
    
    if (options.fetchFullContent) {
      try {
        const fullContent = await fetchFullContent(source.url);
        content = fullContent.content;
        title = fullContent.title || source.title;
        publishedDate = fullContent.publishedDate;
        author = fullContent.author;
      } catch (error) {
        console.warn('Failed to fetch full content, using snippet:', error);
        content = source.snippet;
      }
    } else {
      content = source.snippet;
    }
    
    if (options.addUserNotes) {
      content = `[User Notes]\n${options.addUserNotes}\n\n[Content]\n${content}`;
    }
    
    const chunks = chunkContent(content);
    let chunksCreated = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      const embedding = await embed(chunkContent);
      
      const memoryItem: MemoryItem = {
        id: `${sourceId}-${i}`,
        content: chunkContent,
        embedding,
        metadata: {
          source: 'url',
          filename: title,
          title: title,
          url: source.url,
          createdAt: Date.now(),
          chunkIndex: i,
          totalChunks: chunks.length,
          folderId: options.folderId,
        }
      };
      
      await addMemory(memoryItem, encryptionKey);
      chunksCreated++;
    }
    
    return {
      success: true,
      sourceId,
      chunksCreated
    };
  } catch (error) {
    return {
      success: false,
      sourceId,
      chunksCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Save multiple sources at once (batch save)
 */
export async function saveMultipleSourcesToMemory(
  sources: WebSource[],
  encryptionKey: CryptoKey,
  options: SaveSourceOptions = {},
  onProgress?: (current: number, total: number, source: string) => void
): Promise<{
  successful: number;
  failed: number;
  results: SaveSourceResult[];
}> {
  const results: SaveSourceResult[] = [];
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    onProgress?.(i + 1, sources.length, source.title);
    
    const result = await saveWebSourceToMemory(source, encryptionKey, options);
    results.push(result);
    
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }
  
  return { successful, failed, results };
}

/**
 * Research session that groups saved sources
 */
export interface ResearchSession {
  id: string;
  name: string;
  query: string;
  createdAt: number;
  sources: string[];
  notes?: string;
  tags?: string[];
}

const SESSIONS_KEY = 'sv_research_sessions';

export function saveResearchSession(session: Omit<ResearchSession, 'id' | 'createdAt'>): ResearchSession {
  const sessions = getResearchSessions();
  
  const newSession: ResearchSession = {
    ...session,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  
  sessions.push(newSession);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  
  return newSession;
}

export function getResearchSessions(): ResearchSession[] {
  const stored = localStorage.getItem(SESSIONS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function deleteResearchSession(id: string): void {
  const sessions = getResearchSessions().filter(s => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}
