// Swiss BrAIn Design Tokens
// Light theme only, sovereignTeal primary, clean minimal aesthetic

export const SWISS_LUXURY_COLORS = {
  // Primary: Sovereign Teal (#1D4E5F)
  primary: '#1D4E5F',
  sovereignTeal: '#1D4E5F',
  
  // Neutrals (Light Mode ONLY)
  light: {
    background: '#FFFFFF',       // Pure white
    surface: '#F8F9FA',          // Light gray
    surfaceHover: '#F1F3F5',     // Hover state
    border: '#E5E7EB',           // gray-200
    borderSubtle: '#F3F4F6',     // gray-100
    text: '#1A1A1A',             // Near black
    textSecondary: '#5C5C5C',    // Medium gray
    textTertiary: '#8C8C8C',     // Light gray
  },
  
  // Semantic
  success: '#047857',
  warning: '#B45309',
  error: '#B91C1C',
  info: '#1D4E5F',  // Use primary
  
  // Accents (for model badges)
  badges: {
    private: '#1D4E5F',
    default: '#047857',
    new: '#722F37',
    payPerUse: '#B45309',
    anonymized: '#1D4E5F',
    beta: '#6B21A8',
    vision: '#0891B2',
    reasoning: '#7C3AED',
    audio: '#059669',
  }
};

export const SWISS_TYPOGRAPHY = {
  // Playfair Display italic for headings
  fontSerif: '"Playfair Display", Georgia, serif',
  // Inter for body text
  fontSans: '"Inter", system-ui, sans-serif',
  // JetBrains Mono for code
  fontMono: '"JetBrains Mono", monospace',
  
  // Sizes
  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
  },
  
  // Weights
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
  },
};

// Icon settings
export const SWISS_ICONS = {
  strokeWidth: 1.15,
  // NO emojis - Lucide only
};

// Layout constants
export const SWISS_LAYOUT = {
  cardPadding: '24px',
  borderRadius: '8px',
  transitionDuration: '200ms',
};

// HSL conversions for CSS variables
export const SWISS_HSL = {
  // Primary: Sovereign Teal
  primary: '193 53% 24%',
  sovereignTeal: '193 53% 24%',
  
  // Light mode ONLY
  light: {
    background: '0 0% 100%',
    surface: '210 17% 98%',
    surfaceHover: '210 14% 96%',
    border: '220 13% 90%',
    text: '0 0% 10%',
    textSecondary: '0 0% 36%',
    textTertiary: '0 0% 55%',
  },
  
  // Semantic
  success: '162 91% 17%',
  warning: '32 91% 36%',
  error: '0 66% 41%',
  info: '193 53% 24%',
  
  // Badges
  badges: {
    private: '193 53% 24%',
    default: '162 91% 17%',
    new: '355 42% 32%',
    payPerUse: '32 91% 36%',
    anonymized: '193 53% 24%',
    beta: '271 70% 40%',
    vision: '189 94% 37%',
    reasoning: '263 70% 50%',
    audio: '160 84% 22%',
  }
};
