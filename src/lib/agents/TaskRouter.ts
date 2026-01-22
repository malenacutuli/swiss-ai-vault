/**
 * Smart Task Router
 *
 * Analyzes task prompts and routes them to the appropriate tools, modes, and execution paths.
 * This provides intelligent task routing similar to Manus.im's smart detection.
 */

import type { TaskMode } from '@/components/agents/AgentsTaskInput';

export interface TaskRouteResult {
  mode: TaskMode;
  toolsRequired: string[];
  confidenceScore: number;
  suggestedTemplate?: string;
  estimatedDuration?: 'quick' | 'medium' | 'long';
  requiresBrowser?: boolean;
  requiresCode?: boolean;
  requiresFiles?: boolean;
  requiresResearch?: boolean;
}

interface DetectionPattern {
  patterns: RegExp[];
  keywords: string[];
  mode: TaskMode;
  tools: string[];
  template?: string;
}

// Detection patterns for different task types
const DETECTION_PATTERNS: DetectionPattern[] = [
  // Presentations/Slides
  {
    patterns: [
      /\b(create|make|build|design|generate)\b.*\b(presentation|slides?|deck|ppt|powerpoint|keynote)\b/i,
      /\b(pitch\s*deck|slide\s*deck)\b/i,
    ],
    keywords: ['presentation', 'slides', 'deck', 'ppt', 'keynote', 'pitch'],
    mode: 'slides',
    tools: ['document_generator', 'image_generator'],
    template: 'pitch-deck',
  },

  // Research
  {
    patterns: [
      /\b(research|investigate|analyze|study|explore)\b.*\b(topic|subject|question|issue|market|industry)\b/i,
      /\b(deep\s*research|market\s*analysis|competitive\s*analysis)\b/i,
      /\bwhat\s+(is|are|do|does|can)\b.*\?/i,
    ],
    keywords: ['research', 'investigate', 'analyze', 'study', 'explore', 'findings', 'report'],
    mode: 'research',
    tools: ['web_search', 'document_analyzer', 'summarizer'],
    template: 'deep-research',
  },

  // Website/Web Development
  {
    patterns: [
      /\b(create|build|make|design|develop)\b.*\b(website|web\s*app|webpage|landing\s*page|portfolio)\b/i,
      /\b(html|css|javascript|react|vue|angular)\b.*\b(page|site|app)\b/i,
    ],
    keywords: ['website', 'webapp', 'webpage', 'landing', 'html', 'css', 'frontend'],
    mode: 'website',
    tools: ['code_generator', 'sandbox', 'browser'],
    template: 'personal-website',
  },

  // Apps/Software
  {
    patterns: [
      /\b(create|build|develop|code|program)\b.*\b(app|application|software|tool|script|program)\b/i,
      /\b(python|javascript|typescript|java|c\+\+|rust|go)\b.*\b(script|code|program)\b/i,
    ],
    keywords: ['app', 'application', 'software', 'code', 'script', 'program', 'function'],
    mode: 'apps',
    tools: ['code_generator', 'code_executor', 'sandbox'],
    template: 'custom-web-tool',
  },

  // Data Analysis/Visualization
  {
    patterns: [
      /\b(analyze|visualize|chart|graph|plot)\b.*\b(data|csv|excel|spreadsheet|dataset)\b/i,
      /\b(data\s*analysis|data\s*visualization|create\s*chart)\b/i,
    ],
    keywords: ['data', 'analyze', 'chart', 'graph', 'visualization', 'csv', 'excel', 'statistics'],
    mode: 'visualization',
    tools: ['data_analyzer', 'chart_generator', 'code_executor'],
    template: 'data-analysis',
  },

  // Spreadsheets
  {
    patterns: [
      /\b(create|make|build|generate)\b.*\b(spreadsheet|excel|table|csv)\b/i,
      /\b(organize|structure)\b.*\b(data|information)\b.*\b(table|spreadsheet)\b/i,
    ],
    keywords: ['spreadsheet', 'excel', 'table', 'csv', 'rows', 'columns'],
    mode: 'spreadsheet',
    tools: ['document_generator', 'data_processor'],
    template: 'export-table',
  },

  // Design/Images
  {
    patterns: [
      /\b(create|generate|design|make)\b.*\b(image|logo|graphic|illustration|banner|poster)\b/i,
      /\b(edit|modify|enhance)\b.*\b(image|photo|picture)\b/i,
    ],
    keywords: ['design', 'image', 'logo', 'graphic', 'illustration', 'visual'],
    mode: 'design',
    tools: ['image_generator', 'image_editor'],
    template: 'ai-image-wizard',
  },

  // Documents/Writing
  {
    patterns: [
      /\b(write|draft|create|compose)\b.*\b(document|report|article|essay|paper|letter|email)\b/i,
      /\b(resume|cv|cover\s*letter|business\s*plan)\b/i,
    ],
    keywords: ['write', 'document', 'report', 'article', 'essay', 'draft', 'compose'],
    mode: 'default',
    tools: ['document_generator', 'text_editor'],
    template: 'career-document',
  },

  // Scheduling
  {
    patterns: [
      /\b(schedule|plan|organize|set\s*up)\b.*\b(meeting|appointment|event|calendar|reminder)\b/i,
    ],
    keywords: ['schedule', 'calendar', 'meeting', 'appointment', 'reminder'],
    mode: 'schedule',
    tools: ['calendar_integration', 'reminder_system'],
    template: 'automated-reminders',
  },

  // Video
  {
    patterns: [
      /\b(create|generate|make|produce)\b.*\b(video|animation|clip|movie)\b/i,
    ],
    keywords: ['video', 'animation', 'clip', 'movie', 'motion'],
    mode: 'video',
    tools: ['video_generator', 'media_processor'],
  },

  // Audio/Podcast
  {
    patterns: [
      /\b(create|generate|make|record)\b.*\b(audio|podcast|voiceover|music|sound)\b/i,
    ],
    keywords: ['audio', 'podcast', 'voice', 'music', 'sound'],
    mode: 'podcast',
    tools: ['audio_generator', 'tts', 'media_processor'],
  },

  // Learning/Education
  {
    patterns: [
      /\b(create|generate|make)\b.*\b(flashcard|quiz|test|study\s*guide|lesson)\b/i,
      /\b(learn|study|memorize|practice)\b.*\b(topic|subject|concept)\b/i,
    ],
    keywords: ['flashcard', 'quiz', 'study', 'learn', 'memorize', 'education'],
    mode: 'flashcards',
    tools: ['document_generator', 'quiz_generator'],
  },

  // Mind Maps
  {
    patterns: [
      /\b(create|make|generate)\b.*\b(mind\s*map|concept\s*map|diagram|flowchart)\b/i,
      /\b(visualize|map\s*out|diagram)\b.*\b(concept|idea|process)\b/i,
    ],
    keywords: ['mindmap', 'concept', 'diagram', 'flowchart', 'visualize'],
    mode: 'mindmap',
    tools: ['diagram_generator', 'visualization_tool'],
  },
];

// Browser-requiring keywords
const BROWSER_KEYWORDS = [
  'browse', 'navigate', 'visit', 'open', 'website', 'url', 'page', 'click',
  'scroll', 'search online', 'google', 'web search', 'internet'
];

// Code-requiring keywords
const CODE_KEYWORDS = [
  'code', 'script', 'program', 'function', 'api', 'database', 'server',
  'deploy', 'compile', 'run', 'execute', 'debug', 'test'
];

// File-requiring keywords
const FILE_KEYWORDS = [
  'file', 'upload', 'download', 'document', 'pdf', 'csv', 'excel', 'image',
  'attachment', 'save', 'export', 'import'
];

/**
 * Analyze a prompt and determine the best routing
 */
export function routeTask(prompt: string): TaskRouteResult {
  const promptLower = prompt.toLowerCase();
  let bestMatch: TaskRouteResult | null = null;
  let highestScore = 0;

  // Check each detection pattern
  for (const pattern of DETECTION_PATTERNS) {
    let score = 0;

    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(promptLower)) {
        score += 3;
      }
    }

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (promptLower.includes(keyword)) {
        score += 1;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = {
        mode: pattern.mode,
        toolsRequired: pattern.tools,
        confidenceScore: Math.min(score / 10, 1),
        suggestedTemplate: pattern.template,
        requiresBrowser: BROWSER_KEYWORDS.some(k => promptLower.includes(k)),
        requiresCode: CODE_KEYWORDS.some(k => promptLower.includes(k)),
        requiresFiles: FILE_KEYWORDS.some(k => promptLower.includes(k)),
        requiresResearch: promptLower.includes('research') || promptLower.includes('find') || promptLower.includes('search'),
      };
    }
  }

  // Default fallback
  if (!bestMatch || highestScore < 2) {
    bestMatch = {
      mode: 'default',
      toolsRequired: ['general_assistant'],
      confidenceScore: 0.3,
      requiresBrowser: BROWSER_KEYWORDS.some(k => promptLower.includes(k)),
      requiresCode: CODE_KEYWORDS.some(k => promptLower.includes(k)),
      requiresFiles: FILE_KEYWORDS.some(k => promptLower.includes(k)),
      requiresResearch: promptLower.includes('research') || promptLower.includes('find') || promptLower.includes('search'),
    };
  }

  // Estimate duration based on complexity
  bestMatch.estimatedDuration = estimateDuration(prompt, bestMatch);

  return bestMatch;
}

/**
 * Estimate task duration based on prompt and route
 */
function estimateDuration(
  prompt: string,
  route: TaskRouteResult
): 'quick' | 'medium' | 'long' {
  const promptLength = prompt.length;
  const hasMultipleSteps = /\b(and|then|also|additionally|next|after)\b/i.test(prompt);
  const isComplex = route.requiresBrowser || route.requiresCode;

  if (promptLength > 500 || hasMultipleSteps && isComplex) {
    return 'long';
  }

  if (promptLength > 200 || isComplex || route.requiresResearch) {
    return 'medium';
  }

  return 'quick';
}

/**
 * Get friendly description for a route
 */
export function getRouteDescription(route: TaskRouteResult): string {
  const modeDescriptions: Record<TaskMode, string> = {
    default: 'General task',
    slides: 'Creating presentation',
    research: 'Research & analysis',
    website: 'Web development',
    apps: 'App development',
    design: 'Design & graphics',
    schedule: 'Scheduling',
    spreadsheet: 'Data organization',
    visualization: 'Data visualization',
    video: 'Video creation',
    audio: 'Audio generation',
    podcast: 'Podcast production',
    chat: 'Conversation',
    playbook: 'Creating playbook',
    flashcards: 'Creating flashcards',
    quiz: 'Creating quiz',
    mindmap: 'Mind mapping',
    studyguide: 'Study guide creation',
  };

  return modeDescriptions[route.mode] || 'Processing task';
}

/**
 * Get tools description for a route
 */
export function getToolsDescription(route: TaskRouteResult): string {
  const parts: string[] = [];

  if (route.requiresBrowser) parts.push('browser');
  if (route.requiresCode) parts.push('code execution');
  if (route.requiresFiles) parts.push('file handling');
  if (route.requiresResearch) parts.push('web search');

  if (parts.length === 0) {
    return 'Standard tools';
  }

  return `Using ${parts.join(', ')}`;
}

export default { routeTask, getRouteDescription, getToolsDescription };
