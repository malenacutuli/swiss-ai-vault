// Swiss BrAIn Design System
// Light theme only, sovereignTeal primary, clean minimal aesthetic

export const SWISS_LUXURY = {
  colors: {
    // Primary: Sovereign Teal (#1D4E5F)
    primary: '#1D4E5F',
    sovereignTeal: '#1D4E5F',
    
    // NO dark backgrounds, NO gold (#D4AF37)
    
    // Light mode neutrals ONLY
    light: {
      bg: '#FFFFFF',
      surface: '#F8F9FA',
      surfaceHover: '#F1F3F5',
      border: '#E5E7EB',
      text: '#1A1A1A',
      textMuted: '#5C5C5C',
      textSubtle: '#8C8C8C',
    },

    // Semantic
    success: '#047857',
    warning: '#B45309',
    error: '#B91C1C',

    // Model tag colors
    tags: {
      private: '#1A365D',
      default: '#047857',
      new: '#722F37',
      payPerUse: '#B45309',
      anonymized: '#0F4C81',
      beta: '#6B21A8',
      vision: '#0891B2',
      reasoning: '#7C3AED',
      audio: '#047857',
    },
  },

  typography: {
    // Playfair Display for headings
    serif: '"Playfair Display", Georgia, serif',
    // Inter for body text
    sans: '"Inter", system-ui, sans-serif',
    // JetBrains Mono for code
    mono: '"JetBrains Mono", monospace',
  },

  // Icon settings
  icons: {
    strokeWidth: 1.15,
    // NO emojis - Lucide only
  },

  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px - card padding
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },

  // NO gradients, NO glassmorphism
  shadows: {
    subtle: '0 1px 2px rgba(0, 0, 0, 0.05)',
    card: '0 1px 3px rgba(0, 0, 0, 0.08)',
    elevated: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },

  transitions: {
    default: 'all 200ms ease-in-out',
  },

  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',  // max radius
  },
} as const;

// Design principles - STRICT RULES
export const DESIGN_PRINCIPLES = {
  // Theme
  theme: 'light',  // LIGHT EVERYWHERE
  
  // Primary color
  primary: '#1D4E5F',  // sovereignTeal
  
  // Backgrounds
  backgrounds: {
    white: '#FFFFFF',
    lightGray: '#F8F9FA',
  },
  
  // Borders
  borderColor: '#E5E7EB',  // gray-200
  
  // Card padding
  cardPadding: '24px',
  
  // Border radius max
  maxBorderRadius: '8px',  // rounded-lg
  
  // Transitions
  transitionDuration: '200ms',
  
  // Icons
  iconStrokeWidth: 1.15,  // Lucide only, NO emojis
  
  // FORBIDDEN
  noGradients: true,
  noGlassmorphism: true,
  noDarkBackgrounds: true,
  noGold: true,  // NO #D4AF37
} as const;

// Badge variant mapping for model tags
export const TAG_VARIANTS = {
  private: {
    bg: 'bg-badge-private/10',
    text: 'text-swiss-navy',
    border: 'border-badge-private/20',
  },
  default: {
    bg: 'bg-badge-default/10',
    text: 'text-success',
    border: 'border-badge-default/20',
  },
  new: {
    bg: 'bg-badge-new/10',
    text: 'text-swiss-burgundy',
    border: 'border-badge-new/20',
  },
  'pay-per-use': {
    bg: 'bg-badge-pay-per-use/10',
    text: 'text-warning',
    border: 'border-badge-pay-per-use/20',
  },
  anonymized: {
    bg: 'bg-badge-anonymized/10',
    text: 'text-swiss-sapphire',
    border: 'border-badge-anonymized/20',
  },
  beta: {
    bg: 'bg-badge-beta/10',
    text: 'text-badge-beta',
    border: 'border-badge-beta/20',
  },
  vision: {
    bg: 'bg-badge-vision/10',
    text: 'text-badge-vision',
    border: 'border-badge-vision/20',
  },
  reasoning: {
    bg: 'bg-badge-reasoning/10',
    text: 'text-badge-reasoning',
    border: 'border-badge-reasoning/20',
  },
  audio: {
    bg: 'bg-badge-audio/10',
    text: 'text-badge-audio',
    border: 'border-badge-audio/20',
  },
} as const;

export type TagVariant = keyof typeof TAG_VARIANTS;
