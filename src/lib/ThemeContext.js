import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEMES, DEFAULT_THEME } from "./theme";

const THEME_KEY = "mizan_theme_v1";

const ThemeContext = createContext({
  themeId: DEFAULT_THEME,
  theme: THEMES[DEFAULT_THEME],
  setTheme: () => {},
  ready: false,
});

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved && THEMES[saved]) setThemeId(saved);
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  const setTheme = useCallback(async (id) => {
    if (!THEMES[id]) return;
    setThemeId(id);
    try { await AsyncStorage.setItem(THEME_KEY, id); } catch (e) {}
  }, []);

  const value = {
    themeId,
    theme: THEMES[themeId] || THEMES[DEFAULT_THEME],
    setTheme,
    ready,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
