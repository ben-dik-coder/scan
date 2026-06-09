export const APP_THEME_STORAGE_KEY = "nylead-app-theme";

export type AppThemeId = "classic" | "apple";

export const DEFAULT_APP_THEME: AppThemeId = "apple";

export const APP_THEME_BACKGROUNDS: Record<AppThemeId, string> = {
  classic: "#234a73",
  apple: "#000000",
};

export const APP_THEME_OPTIONS: {
  id: AppThemeId;
  label: string;
  description: string;
}[] = [
  {
    id: "classic",
    label: "Klassisk",
    description: "Blå glass-stil med lys blå aksent",
  },
  {
    id: "apple",
    label: "Apple",
    description: "Mørk iOS-stil over hele appen",
  },
];

export function isAppThemeId(value: unknown): value is AppThemeId {
  return value === "classic" || value === "apple";
}

export function readStoredAppTheme(): AppThemeId {
  if (typeof window === "undefined") return DEFAULT_APP_THEME;
  try {
    const stored = localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (isAppThemeId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_APP_THEME;
}

export function storeAppTheme(theme: AppThemeId) {
  try {
    localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function isAppRoute(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

export function applyAppThemeToDocument(theme: AppThemeId, onAppRoute: boolean) {
  const root = document.documentElement;
  const body = document.body;

  if (!onAppRoute) {
    root.classList.remove("app-glass-theme");
    body.classList.remove("app-glass-theme");
    root.removeAttribute("data-app-theme");
    root.style.backgroundColor = "";
    body.style.color = "";
    return;
  }

  root.classList.add("app-glass-theme");
  body.classList.add("app-glass-theme");
  root.setAttribute("data-app-theme", theme);
  root.style.backgroundColor = APP_THEME_BACKGROUNDS[theme];
}
