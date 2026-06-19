import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'denvise_theme';

export const LIGHT = {
  bg: '#F0F4F8',
  white: '#FFFFFF',
  dark: '#1a2340',
  text: '#1a2340',
  text2: '#4a5568',
  muted: '#94a3b8',
  border: '#E2E8F0',
  light: '#EEF2FF',
  primary: '#3b82f6',
  accent: '#60a5fa',
  success: '#22c55e',
  danger: '#ef4444',
  warn: '#f59e0b',
  card: '#FFFFFF',
  isDark: false as const,
};

export const DARK = {
  bg: '#0F1117',
  white: '#1C2130',
  dark: '#0A0D14',
  text: '#F0F4F8',
  text2: '#94A3B8',
  muted: '#64748B',
  border: '#2D3748',
  light: '#1E2A3A',
  primary: '#60A5FA',
  accent: '#93C5FD',
  success: '#4ADE80',
  danger: '#F87171',
  warn: '#FCD34D',
  card: '#1C2130',
  isDark: true as const,
};

export type Theme = typeof LIGHT | typeof DARK;

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: LIGHT,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: isDark ? DARK : LIGHT, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}