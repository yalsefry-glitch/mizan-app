// contexts/ThemeContext.tsx
// سياق الثيم: يحفظ اختيار الطفل للثيم في AsyncStorage ويطبّقه فوريًّا على كل الشاشات.
// الثيمات الستة: برتقالي، بنفسجي، أخضر، أزرق، وردي، ليلي.

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme, type ThemeName, type Theme } from '../config/theme';

const THEME_KEY = 'hakeem_theme';

type ThemeContextType = {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('orange');
  const [theme, setThemeState] = useState<Theme>(getTheme('orange'));

  // استرجاع الثيم المحفوظ عند الإقلاع
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved && isValidThemeName(saved)) {
          setThemeName(saved);
          setThemeState(getTheme(saved));
        }
      })
      .catch(() => {
        // لا يضرّ: يبقى الافتراضي (orange).
      });
  }, []);

  const setTheme = (name: ThemeName) => {
    setThemeName(name);
    setThemeState(getTheme(name));
    AsyncStorage.setItem(THEME_KEY, name).catch(() => {
      // الحفظ ليس حرجًا — نتجاهل بصمت.
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme يجب استخدامه داخل ThemeProvider');
  }
  return ctx;
}

function isValidThemeName(name: string): name is ThemeName {
  return ['orange', 'purple', 'green', 'blue', 'pink', 'dark'].includes(name);
}
