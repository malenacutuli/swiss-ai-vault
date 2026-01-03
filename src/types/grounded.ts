// src/types/grounded.ts
// Types for grounded (citation-backed) AI responses

export interface SourceDocument {
  id: string;
  title: string;
  content: string;
  pageNumber?: number;
  similarity: number;
  url?: string;
  type: 'document' | 'voice_note' | 'note' | 'memory';
}

export interface Citation {
  sourceIndex: number;
  sourceId: string;
  text: string;
  startOffset?: number;
  endOffset?: number;
}

export interface GroundedResponse {
  content: string;
  citations: Citation[];
  sources: SourceDocument[];
  isGrounded: boolean;
  sourceCount: number;
}

export interface GroundedChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  sources?: SourceDocument[];
  isGrounded?: boolean;
  timestamp: string;
}

export interface GroundedSearchResult {
  query: string;
  results: SourceDocument[];
  totalFound: number;
  searchTime: number;
}

export interface CitationMatch {
  citation: Citation;
  source: SourceDocument;
  matchConfidence: number;
}
