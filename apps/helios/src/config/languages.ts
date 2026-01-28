export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  medicalCoding: { diagnosis: string; procedures: string };
  emergency: { general: string; suicide: string; poison: string };
  voice: { deepgramLanguage: string; humeLanguage: string };
}

export const LANGUAGE_CONFIG: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    medicalCoding: { diagnosis: 'ICD-10-CM', procedures: 'CPT' },
    emergency: { general: '911', suicide: '988', poison: '1-800-222-1222' },
    voice: { deepgramLanguage: 'en-US', humeLanguage: 'en' },
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    medicalCoding: { diagnosis: 'CIE-10', procedures: 'CIE-10-PCS' },
    emergency: { general: '911', suicide: '024', poison: '91-562-04-20' },
    voice: { deepgramLanguage: 'es', humeLanguage: 'es' },
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    medicalCoding: { diagnosis: 'CIM-10', procedures: 'CCAM' },
    emergency: { general: '15', suicide: '3114', poison: '01-40-05-48-48' },
    voice: { deepgramLanguage: 'fr', humeLanguage: 'fr' },
  },
};

export function getLanguageConfig(lang: SupportedLanguage): LanguageConfig {
  return LANGUAGE_CONFIG[lang];
}

export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}
