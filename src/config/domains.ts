// src/config/domains.ts
// Centralized domain configuration for multi-domain support

export const DOMAINS = {
  primary: 'swissbrain.ai',
  legacy: 'swissvault.ai',
  development: 'localhost:5173',
  preview: '*.lovable.app'
} as const;

export const ALL_ALLOWED_ORIGINS = [
  'https://swissbrain.ai',
  'https://www.swissbrain.ai',
  'https://app.swissbrain.ai',
  'https://swissvault.ai',
  'https://www.swissvault.ai',
  'https://app.swissvault.ai',
  'http://localhost:5173',
  'http://localhost:3000',
];

// For Supabase auth redirects
export const AUTH_REDIRECT_URLS = [
  'https://swissbrain.ai/auth/callback',
  'https://app.swissbrain.ai/auth/callback',
  'https://swissvault.ai/auth/callback',
  'https://app.swissvault.ai/auth/callback',
  'http://localhost:5173/auth/callback',
];

// OAuth callback URLs for external providers
export const OAUTH_CALLBACK_URLS = {
  google: [
    'https://swissbrain.ai/auth/callback/google',
    'https://swissvault.ai/auth/callback/google',
  ],
  github: [
    'https://swissbrain.ai/auth/callback/github',
    'https://swissvault.ai/auth/callback/github',
  ],
  slack: [
    'https://swissbrain.ai/integrations/slack/callback',
    'https://swissvault.ai/integrations/slack/callback',
  ],
  notion: [
    'https://swissbrain.ai/integrations/notion/callback',
    'https://swissvault.ai/integrations/notion/callback',
  ],
  gmail: [
    'https://swissbrain.ai/integrations/gmail/callback',
    'https://swissvault.ai/integrations/gmail/callback',
  ],
  googleDrive: [
    'https://swissbrain.ai/integrations/google-drive/callback',
    'https://swissvault.ai/integrations/google-drive/callback',
  ],
};

// Get current domain context
export function getCurrentDomain(): string {
  if (typeof window === 'undefined') return DOMAINS.primary;
  const hostname = window.location.hostname;
  
  if (hostname.includes('swissbrain')) return 'swissbrain.ai';
  if (hostname.includes('swissvault')) return 'swissvault.ai';
  if (hostname.includes('lovable.app')) return hostname;
  if (hostname === 'localhost') return 'localhost:5173';
  
  return DOMAINS.primary;
}

// Get base URL for current domain
export function getBaseUrl(): string {
  if (typeof window === 'undefined') return `https://${DOMAINS.primary}`;
  return window.location.origin;
}

// Brand name based on domain
export function getBrandName(): string {
  const domain = getCurrentDomain();
  if (domain.includes('swissbrain')) return 'SwissBrain';
  if (domain.includes('swissvault')) return 'SwissVault';
  return 'SwissBrain'; // Default to new brand
}

// Get appropriate logo path
export function getLogoPath(): string {
  const brand = getBrandName();
  return brand === 'SwissBrain' 
    ? '/assets/swissbrain-logo.svg'
    : '/assets/swissvault-logo.svg';
}
