export type BriefingFormat = 
  | 'deep_dive'    // Comprehensive analysis (10-20 min)
  | 'quick_brief'  // Executive summary (3-5 min)
  | 'debate'       // Two perspectives discussing (10-15 min)
  | 'critique'     // Critical analysis (5-10 min)
  | 'tutorial';    // Step-by-step explanation (varies)

export type BriefingDuration = 'short' | 'medium' | 'long';

export interface BriefingOutline {
  title: string;
  keyThemes: string[];
  keyFacts: string[];
  questions: string[];
  risks?: string[];
  opportunities?: string[];
}

export interface DialoguePart {
  speaker: 'Alex' | 'Jordan';
  text: string;
}

export interface AudioBriefing {
  id: string;
  projectId?: string;
  title: string;
  format: BriefingFormat;
  duration: BriefingDuration;
  audioUrl?: string;         // Signed URL from storage
  audioDataUrl?: string;     // Legacy Base64 for old briefings
  storagePath?: string;      // Storage bucket path for refresh
  transcript: DialoguePart[];
  outline: BriefingOutline;
  sourceDocuments: string[]; // Document IDs used
  createdAt: string;
  status: 'generating' | 'ready' | 'error';
  error?: string;
}

export interface BriefingGenerationProgress {
  stage: 'analyzing' | 'outlining' | 'scripting' | 'synthesizing' | 'complete';
  progress: number; // 0-100
  message: string;
}
