/**
 * Nano Banana Integration
 * PowerPoint/Presentation generation API
 * Now uses the 15 Manus professional styles
 */

import { supabase } from '@/integrations/supabase/client';
import { SlideStyleName } from '@/types/slides';
import { SLIDE_STYLES } from '@/lib/slide-styles';

export interface PresentationRequest {
  prompt: string;
  template: SlideStyleName;
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
  // Get style config for the selected template
  const styleConfig = SLIDE_STYLES[request.template];
  
  const { data, error } = await supabase.functions.invoke('generate-presentation', {
    body: {
      prompt: request.prompt,
      template: request.template,
      slide_count: request.slideCount,
      format: request.format || 'pptx',
      theme: request.theme || {
        primaryColor: styleConfig.colors.primary,
        secondaryColor: styleConfig.colors.secondary,
        accentColor: styleConfig.colors.accent,
      },
      style_config: {
        fonts: styleConfig.fonts,
        promptTemplate: styleConfig.promptTemplate,
        colors: styleConfig.colors,
      },
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
 * 15 Manus Professional Presentation Styles
 * Each style has specific color palettes, fonts, and image generation prompts
 */
export const PRESENTATION_TEMPLATES = [
  { id: 'vinyl' as SlideStyleName, name: 'Vinyl', premium: false, description: 'Retro record aesthetic', bestFor: 'Music, creative' },
  { id: 'whiteboard' as SlideStyleName, name: 'Whiteboard', premium: false, description: 'Hand-drawn sketch', bestFor: 'Education, workshops' },
  { id: 'grove' as SlideStyleName, name: 'Grove', premium: false, description: 'Natural, organic', bestFor: 'Environmental, wellness' },
  { id: 'fresco' as SlideStyleName, name: 'Fresco', premium: false, description: 'Classical Renaissance', bestFor: 'Art, history, luxury' },
  { id: 'easel' as SlideStyleName, name: 'Easel', premium: false, description: 'Artist studio canvas', bestFor: 'Creative, design' },
  { id: 'diorama' as SlideStyleName, name: 'Diorama', premium: false, description: '3D miniature scenes', bestFor: 'Product, storytelling' },
  { id: 'chromatic' as SlideStyleName, name: 'Chromatic', premium: false, description: 'Bold gradients', bestFor: 'Tech, startups' },
  { id: 'sketch' as SlideStyleName, name: 'Sketch', premium: false, description: 'Pencil drawing', bestFor: 'Concepts, proposals' },
  { id: 'amber' as SlideStyleName, name: 'Amber', premium: true, description: 'Warm golden tones', bestFor: 'Luxury, executive' },
  { id: 'ginkgo' as SlideStyleName, name: 'Ginkgo', premium: false, description: 'Japanese minimalism', bestFor: 'Zen, mindfulness' },
  { id: 'neon' as SlideStyleName, name: 'Neon', premium: true, description: 'Cyberpunk glow', bestFor: 'Gaming, futuristic' },
  { id: 'paper' as SlideStyleName, name: 'Paper', premium: false, description: 'Craft paper texture', bestFor: 'DIY, crafts' },
  { id: 'blueprint' as SlideStyleName, name: 'Blueprint', premium: false, description: 'Technical drawing', bestFor: 'Engineering, architecture' },
  { id: 'polaroid' as SlideStyleName, name: 'Polaroid', premium: false, description: 'Instant photo style', bestFor: 'Personal, memories' },
  { id: 'mosaic' as SlideStyleName, name: 'Mosaic', premium: true, description: 'Colorful tile patterns', bestFor: 'Cultural, artistic' },
] as const;

export type TemplateId = SlideStyleName;

/**
 * Check if a template is premium
 */
export function isPremiumTemplate(templateId: string): boolean {
  const template = PRESENTATION_TEMPLATES.find(t => t.id === templateId);
  return template?.premium ?? false;
}

/**
 * Get template configuration
 */
export function getTemplateConfig(templateId: SlideStyleName) {
  return SLIDE_STYLES[templateId];
}
