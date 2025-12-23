// Swiss Luxury Design Tokens
// Inspired by Patek Philippe, Vacheron Constantin, and Audemars Piguet

export const SWISS_LUXURY_COLORS = {
  // Primary Colors
  swissNavy: '#1A365D',        // Primary - trust, stability
  midnightSapphire: '#0F4C81', // Accent - premium, contemporary
  imperialBurgundy: '#722F37', // Highlight - distinctive, luxurious
  sovereignTeal: '#1D4E5F',    // Secondary - modern, unexpected
  
  // Neutrals (Light Mode)
  light: {
    background: '#FDFBF7',      // Warm white (Vacheron style)
    surface: '#F8F6F1',         // Cream
    surfaceHover: '#F0EDE6',    // Light cream
    border: '#E5E0D5',          // Warm gray
    borderSubtle: '#EBE7DE',    // Lighter border
    text: '#1A1A1A',            // Near black
    textSecondary: '#5C5C5C',   // Medium gray
    textTertiary: '#8C8C8C',    // Light gray
  },
  
  // Neutrals (Dark Mode)
  dark: {
    background: '#0A0F1A',      // Deep navy black
    surface: '#111827',         // Dark surface
    surfaceHover: '#1F2937',    // Hover state
    border: '#2D3748',          // Dark border
    borderSubtle: '#1F2937',    // Subtle border
    text: '#F7F7F7',            // Off-white
    textSecondary: '#A0AEC0',   // Muted
    textTertiary: '#718096',    // Tertiary
  },
  
  // Semantic
  success: '#047857',
  warning: '#B45309',
  error: '#B91C1C',
  info: '#0F4C81',
  
  // Accents (for model badges)
  badges: {
    private: '#1A365D',
    default: '#047857',
    new: '#722F37',
    payPerUse: '#B45309',
    anonymized: '#0F4C81',
    beta: '#6B21A8',
    vision: '#0891B2',
    reasoning: '#7C3AED',
    audio: '#059669',
  }
};

export const SWISS_TYPOGRAPHY = {
  // Serif for headings (Patek Philippe style)
  fontSerif: '"Playfair Display", "Times New Roman", serif',
  // Sans for body (clean, modern)
  fontSans: '"Inter", "Helvetica Neue", sans-serif',
  // Mono for code/technical
  fontMono: '"JetBrains Mono", "SF Mono", monospace',
  
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
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  // Letter spacing (luxury feel)
  tracking: {
    tighter: '-0.02em',
    tight: '-0.01em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',  // For caps
  }
};

// HSL conversions for CSS variables
export const SWISS_HSL = {
  // Primary colors in HSL
  swissNavy: '213 55% 23%',
  midnightSapphire: '207 79% 28%',
  imperialBurgundy: '355 42% 32%',
  sovereignTeal: '193 53% 24%',
  
  // Light mode
  light: {
    background: '40 43% 98%',
    surface: '40 30% 96%',
    surfaceHover: '40 20% 92%',
    border: '37 18% 86%',
    borderSubtle: '38 20% 89%',
    text: '0 0% 10%',
    textSecondary: '0 0% 36%',
    textTertiary: '0 0% 55%',
  },
  
  // Dark mode
  dark: {
    background: '222 47% 7%',
    surface: '222 47% 11%',
    surfaceHover: '220 26% 17%',
    border: '218 23% 23%',
    borderSubtle: '220 26% 17%',
    text: '0 0% 97%',
    textSecondary: '215 25% 66%',
    textTertiary: '215 16% 51%',
  },
  
  // Semantic
  success: '162 91% 17%',
  warning: '32 91% 36%',
  error: '0 66% 41%',
  info: '207 79% 28%',
  
  // Badges
  badges: {
    private: '213 55% 23%',
    default: '162 91% 17%',
    new: '355 42% 32%',
    payPerUse: '32 91% 36%',
    anonymized: '207 79% 28%',
    beta: '271 70% 40%',
    vision: '189 94% 37%',
    reasoning: '263 70% 50%',
    audio: '160 84% 22%',
  }
};
