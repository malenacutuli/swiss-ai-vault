/**
 * Nano Banana Integration
 * PowerPoint/Presentation generation API
 */

import { supabase } from '@/integrations/supabase/client';

export interface PresentationRequest {
  prompt: string;
  template: string;
  slideCount: number;
  format?: 'pptx' | 'pdf' | 'google-slides';
  theme?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
}

export interface PresentationResult {
  url: string;
  fileId: string;
  slideCount: number;
  format: string;
  thumbnail?: string;
}

export interface GenerationProgress {
  step: number;
  totalSteps: number;
  message: string;
}

/**
 * Generate a presentation using the Nano Banana API via edge function
 */
export async function generatePresentation(
  request: PresentationRequest,
  onProgress?: (progress: GenerationProgress) => void
): Promise<PresentationResult> {
  const { data, error } = await supabase.functions.invoke('generate-presentation', {
    body: {
      prompt: request.prompt,
      template: request.template,
      slide_count: request.slideCount,
      format: request.format || 'pptx',
      theme: request.theme,
    },
  });

  if (error) {
    console.error('[NanoBanana] Generation error:', error);
    throw new Error(error.message || 'Failed to generate presentation');
  }

  return {
    url: data.download_url,
    fileId: data.file_id,
    slideCount: data.slide_count,
    format: data.format,
    thumbnail: data.thumbnail_url,
  };
}

/**
 * Get available templates
 */
export const PRESENTATION_TEMPLATES = [
  { id: 'swiss-classic', name: 'Swiss Classic', premium: false },
  { id: 'zurich', name: 'Zurich', premium: false },
  { id: 'geneva', name: 'Geneva', premium: false },
  { id: 'alps', name: 'Alps', premium: false },
  { id: 'glacier', name: 'Glacier', premium: false },
  { id: 'burgundy', name: 'Burgundy', premium: true },
  { id: 'navy', name: 'Navy', premium: false },
  { id: 'minimal', name: 'Minimal', premium: false },
  { id: 'modern', name: 'Modern', premium: true },
] as const;

export type TemplateId = typeof PRESENTATION_TEMPLATES[number]['id'];

/**
 * Check if a template is premium
 */
export function isPremiumTemplate(templateId: string): boolean {
  const template = PRESENTATION_TEMPLATES.find(t => t.id === templateId);
  return template?.premium ?? false;
}
