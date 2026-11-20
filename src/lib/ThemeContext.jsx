import React, { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = [
  { id: 'dark', name: 'Dark (Monkeytype)', icon: '🌙' },
  { id: 'light', name: 'Light (Paper)', icon: '☀️' },
  { id: 'oled', name: 'OLED (Pure Black)', icon: '🖤' }
];

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {}
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('growthdesk-theme');
      if (saved === 'dark' || saved === 'light' || saved === 'oled') {
        return saved;
      }
      return 'dark'; // Default to sleek Monkeytype dark
    } catch {
      return 'dark';
    }
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('growthdesk-theme', newTheme);
    } catch {
      // storage disabled / privacy mode
    }
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
