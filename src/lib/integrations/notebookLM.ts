/**
 * NotebookLM Integration
 * Research, podcast, flashcard, and mind map generation
 */

import { supabase } from '@/integrations/supabase/client';

export interface Citation {
  id: string;
  text: string;
  source: string;
  pageNumber?: number;
  url?: string;
}

export interface ResearchResult {
  summary: string;
  insights: string[];
  citations: Citation[];
  topics: string[];
  keyFindings: Array<{
    title: string;
    description: string;
    evidence: string[];
  }>;
}

export interface PodcastResult {
  audioUrl: string;
  transcript: string;
  duration: number;
  hosts: {
    hostA: string;
    hostB: string;
  };
  segments: Array<{
    speaker: 'A' | 'B';
    text: string;
    startTime: number;
  }>;
}

export interface FlashcardResult {
  cards: Array<{
    id: string;
    front: string;
    back: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topic: string;
  }>;
  totalCount: number;
}

export interface QuizResult {
  questions: Array<{
    id: string;
    type: 'multiple_choice' | 'true_false' | 'short_answer';
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
  }>;
  totalQuestions: number;
}

export interface MindMapNode {
  id: string;
  label: string;
  level: number;
  children: MindMapNode[];
}

export interface MindMapResult {
  title: string;
  rootNode: MindMapNode;
  totalNodes: number;
}

export interface Source {
  id: string;
  name: string;
  type: 'pdf' | 'url' | 'text' | 'document';
  url?: string;
  content?: string;
}

/**
 * Generate research analysis from sources
 */
export async function generateResearch(
  topic: string,
  sources: Source[],
  depth: 'quick' | 'standard' | 'comprehensive' = 'standard'
): Promise<ResearchResult> {
  const { data, error } = await supabase.functions.invoke('generate-research', {
    body: {
      topic,
      sources: sources.map(s => ({
        name: s.name,
        type: s.type,
        url: s.url,
        content: s.content,
      })),
      depth,
    },
  });

  if (error) {
    console.error('[NotebookLM] Research generation error:', error);
    throw new Error(error.message || 'Failed to generate research');
  }

  return data;
}

/**
 * Generate podcast from sources
 */
export async function generatePodcast(
  topic: string,
  sources: Source[],
  hostA: string = 'kore',
  hostB: string = 'charon',
  duration: 'short' | 'medium' | 'long' = 'medium'
): Promise<PodcastResult> {
  const { data, error } = await supabase.functions.invoke('generate-podcast', {
    body: {
      topic,
      sources: sources.map(s => ({
        name: s.name,
        type: s.type,
        url: s.url,
        content: s.content,
      })),
      host_a: hostA,
      host_b: hostB,
      duration,
    },
  });

  if (error) {
    console.error('[NotebookLM] Podcast generation error:', error);
    throw new Error(error.message || 'Failed to generate podcast');
  }

  return data;
}

/**
 * Generate flashcards from sources
 */
export async function generateFlashcards(
  topic: string,
  sources: Source[],
  count: number = 20,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<FlashcardResult> {
  const { data, error } = await supabase.functions.invoke('generate-flashcards', {
    body: {
      topic,
      sources: sources.map(s => ({
        name: s.name,
        type: s.type,
        url: s.url,
        content: s.content,
      })),
      count,
      difficulty,
    },
  });

  if (error) {
    console.error('[NotebookLM] Flashcard generation error:', error);
    throw new Error(error.message || 'Failed to generate flashcards');
  }

  return data;
}

/**
 * Generate quiz from sources
 */
export async function generateQuiz(
  topic: string,
  sources: Source[],
  questionCount: number = 10,
  questionTypes: string[] = ['multiple_choice', 'true_false']
): Promise<QuizResult> {
  const { data, error } = await supabase.functions.invoke('generate-quiz', {
    body: {
      topic,
      sources: sources.map(s => ({
        name: s.name,
        type: s.type,
        url: s.url,
        content: s.content,
      })),
      question_count: questionCount,
      question_types: questionTypes,
    },
  });

  if (error) {
    console.error('[NotebookLM] Quiz generation error:', error);
    throw new Error(error.message || 'Failed to generate quiz');
  }

  return data;
}

/**
 * Generate mind map from sources
 */
export async function generateMindMap(
  topic: string,
  sources: Source[],
  depth: number = 3,
  focus?: string
): Promise<MindMapResult> {
  const { data, error } = await supabase.functions.invoke('generate-mindmap', {
    body: {
      topic,
      sources: sources.map(s => ({
        name: s.name,
        type: s.type,
        url: s.url,
        content: s.content,
      })),
      depth,
      focus,
    },
  });

  if (error) {
    console.error('[NotebookLM] Mind map generation error:', error);
    throw new Error(error.message || 'Failed to generate mind map');
  }

  return data;
}

/**
 * Available podcast hosts
 */
export const PODCAST_HOSTS = [
  { id: 'kore', name: 'Kore', voice: 'Female, Professional' },
  { id: 'charon', name: 'Charon', voice: 'Male, Conversational' },
  { id: 'puck', name: 'Puck', voice: 'Male, Energetic' },
  { id: 'sage', name: 'Sage', voice: 'Female, Warm' },
] as const;

export type HostId = typeof PODCAST_HOSTS[number]['id'];
