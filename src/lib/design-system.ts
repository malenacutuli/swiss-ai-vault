// Swiss Luxury Design System
// Inspired by Patek Philippe, Audemars Piguet, Vacheron Constantin

export const SWISS_LUXURY = {
  colors: {
    // Primary palette (hex for reference, use CSS vars in components)
    swissNavy: '#1A365D',
    midnightSapphire: '#0F4C81',
    imperialBurgundy: '#722F37',
    sovereignTeal: '#1D4E5F',

    // Light mode neutrals
    light: {
      bg: '#FDFBF7',
      surface: '#F8F6F1',
      surfaceHover: '#F0EDE6',
      border: '#E5E0D5',
      text: '#1A1A1A',
      textMuted: '#5C5C5C',
      textSubtle: '#8C8C8C',
    },

    // Dark mode neutrals
    dark: {
      bg: '#0A0F1A',
      surface: '#111827',
      surfaceHover: '#1F2937',
      border: '#2D3748',
      text: '#F7F7F7',
      textMuted: '#A0AEC0',
      textSubtle: '#718096',
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
    serif: '"Playfair Display", serif',
    sans: '"Inter", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },

  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },

  shadows: {
    subtle: '0 2px 8px rgba(0, 0, 0, 0.04)',
    card: '0 4px 16px rgba(0, 0, 0, 0.06)',
    elevated: '0 8px 24px rgba(0, 0, 0, 0.08)',
    luxury: '0 2px 16px rgba(26, 54, 93, 0.08)',
  },

  transitions: {
    default: 'all 200ms ease-in-out',
    fast: 'all 150ms ease-in-out',
    slow: 'all 300ms ease-in-out',
  },

  borderRadius: {
    none: '0',
    sm: '4px',
    md: '6px',
    lg: '8px',
    full: '9999px',
  },
} as const;

// Design principles
export const DESIGN_PRINCIPLES = {
  // Generous white space
  minCardPadding: '24px',
  
  // Subtle shadows
  defaultShadow: SWISS_LUXURY.shadows.subtle,
  
  // Smooth transitions
  transitionTiming: 'ease-in-out',
  transitionDuration: '200ms',
  
  // Subtle border radius
  maxBorderRadius: '8px',
  
  // Typography rules
  headingTracking: '0.05em',
  capsTracking: '0.1em',
  
  // No bright colors, no gradients, no emojis
  // Use elegant Lucide icons only
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
