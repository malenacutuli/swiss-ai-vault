// =============================================
// SLIDE GENERATION TYPES
// =============================================

export type SlideGenerateMode = 'html' | 'image';

export type SlideType = 
  | 'title' 
  | 'content' 
  | 'section' 
  | 'data' 
  | 'quote' 
  | 'image' 
  | 'comparison' 
  | 'timeline' 
  | 'conclusion';

export type SlideStyleName = 
  | 'vinyl'
  | 'whiteboard'
  | 'grove'
  | 'fresco'
  | 'easel'
  | 'diorama'
  | 'chromatic'
  | 'sketch'
  | 'amber'
  | 'ginkgo'
  | 'neon'
  | 'paper'
  | 'blueprint'
  | 'polaroid'
  | 'mosaic';

export type SlideTheme = 'dark' | 'light' | 'corporate' | 'creative';

export interface SlideContent {
  slideNumber: number;
  slideType: SlideType;
  headline: string;
  subheadline?: string;
  bodyText?: string[];
  data?: ChartData;
  quote?: string;
  quoteAttribution?: string;
  imageUrl?: string;
  speakerNotes?: string;
  visualSuggestion?: string;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';
  labels: string[];
  datasets: ChartDataset[];
  title?: string;
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
}

export interface SlideGenerationRequest {
  contentMarkdown: string;
  slideCount: number;
  generateMode: SlideGenerateMode;
  style?: SlideStyleName;
  theme?: SlideTheme;
  aspectRatio?: '16:9' | '4:3' | '1:1';
  brandColors?: string[];
  fontFamily?: string;
  includeSpeakerNotes?: boolean;
  exportFormats?: ('pdf' | 'pptx')[];
}

export interface SlideGenerationResult {
  versionId: string;
  slides: GeneratedSlide[];
  uri: string;
  metadata: {
    generateMode: SlideGenerateMode;
    style?: SlideStyleName;
    theme: SlideTheme;
    slideCount: number;
    createdAt: string;
  };
  exportUrls?: {
    pdf?: string;
    pptx?: string;
  };
}

export interface GeneratedSlide {
  slideNumber: number;
  slideType: SlideType;
  headline: string;
  subheadline?: string;
  content?: string[];
  imageUrl?: string;
  html?: string;
  speakerNotes?: string;
}

export interface StyleConfig {
  name: string;
  displayName: string;
  description: string;
  bestFor: string;
  colors: StyleColors;
  fonts: StyleFonts;
  promptTemplate: string;
  negativePrompt: string;
  modifiers: string[];
  effects?: StyleEffect[];
}

export interface StyleColors {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
}

export interface StyleFonts {
  headline: string;
  body: string;
  accent?: string;
}

export interface StyleEffect {
  type: 'vignette' | 'grain' | 'blur_edges' | 'glow';
  intensity: number;
}

export interface TextOverlay {
  text: string;
  position: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  style: 'headline' | 'body' | 'accent' | 'caption';
}

export interface ImagePrompt {
  prompt: string;
  negativePrompt: string;
  styleModifiers: string[];
  textOverlays: TextOverlay[];
  composition: {
    layout: 'centered' | 'left-heavy' | 'right-heavy' | 'split';
    backgroundType: 'solid' | 'gradient' | 'textured' | 'image';
    visualElements: string[];
  };
}
