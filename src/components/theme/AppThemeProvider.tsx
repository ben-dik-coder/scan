"use client";

import {
  applyAppThemeToDocument,
  DEFAULT_APP_THEME,
  isAppLookRoute,
  readStoredAppTheme,
  storeAppTheme,
  type AppThemeId,
} from "@/lib/theme/app-theme";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AppThemeContextValue = {
  theme: AppThemeId;
  setTheme: (theme: AppThemeId) => void;
  ready: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onAppLook = isAppLookRoute(pathname);
  const [theme, setThemeState] = useState<AppThemeId>(DEFAULT_APP_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setThemeState(readStoredAppTheme());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyAppThemeToDocument(theme, onAppLook);
  }, [theme, onAppLook, ready]);

  const setTheme = useCallback((next: AppThemeId) => {
    setThemeState(DEFAULT_APP_THEME);
    storeAppTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, ready }),
    [theme, setTheme, ready]
  );

  return (
    <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return ctx;
}
