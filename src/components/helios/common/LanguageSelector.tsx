/**
 * Language Selector Component
 */

import React from 'react';
import { Globe } from 'lucide-react';
import type { SupportedLanguage } from '@/lib/helios/types';

interface LanguageSelectorProps {
  value: SupportedLanguage;
  onChange: (lang: SupportedLanguage) => void;
}

const LANGUAGES: Array<{ code: SupportedLanguage; name: string; flag: string }> = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SupportedLanguage)}
        className="appearance-none pl-8 pr-4 py-1.5 bg-gray-100 dark:bg-gray-800
                   border border-gray-200 dark:border-gray-700 rounded-lg text-sm
                   focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <Globe className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
    </div>
  );
}
