import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { stylePresets, StylePreset, StyleConfig } from '@/lib/stylePresets';

interface StudioThemeContextType {
  theme: StyleConfig;
  themeName: StylePreset;
  setTheme: (name: StylePreset) => void;
  availableThemes: StylePreset[];
}

const StudioThemeContext = createContext<StudioThemeContextType | null>(null);

const STORAGE_KEY = 'swissbrain-studio-theme';

export function StudioThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<StylePreset>('corporate');

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && stylePresets[saved as StylePreset]) {
      setThemeName(saved as StylePreset);
    }
  }, []);

  const setTheme = (name: StylePreset) => {
    if (stylePresets[name]) {
      setThemeName(name);
      localStorage.setItem(STORAGE_KEY, name);
    }
  };

  const theme = stylePresets[themeName] || stylePresets.corporate;

  return (
    <StudioThemeContext.Provider value={{
      theme,
      themeName,
      setTheme,
      availableThemes: Object.keys(stylePresets) as StylePreset[]
    }}>
      {children}
    </StudioThemeContext.Provider>
  );
}

export function useStudioTheme() {
  const context = useContext(StudioThemeContext);
  if (!context) {
    throw new Error('useStudioTheme must be used within a StudioThemeProvider');
  }
  return context;
}
