export const APP_THEME_STORAGE_KEY = "nylead-app-theme";

/** Only Skann/Ring look is supported in-app. */
export type AppThemeId = "apple";

export const DEFAULT_APP_THEME: AppThemeId = "apple";

export const APP_THEME_BACKGROUNDS: Record<AppThemeId, string> = {
  apple: "#0a0a0a",
};

export const APP_THEME_OPTIONS: {
  id: AppThemeId;
  label: string;
  description: string;
}[] = [
  {
    id: "apple",
    label: "Mørk",
    description: "Samme look som Skann og Ring",
  },
];

export function isAppThemeId(value: unknown): value is AppThemeId {
  return value === "apple";
}

export function readStoredAppTheme(): AppThemeId {
  // Always Skann/Ring look — ignore legacy "classic" storage
  return DEFAULT_APP_THEME;
}

export function storeAppTheme(theme: AppThemeId) {
  void theme;
  try {
    localStorage.setItem(APP_THEME_STORAGE_KEY, DEFAULT_APP_THEME);
  } catch {
    /* ignore */
  }
}

export function isAppRoute(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

/** Auth + onboarding routes that should share the app dark look. */
export function isAppLookRoute(pathname: string) {
  return (
    isAppRoute(pathname) ||
    pathname === "/innlogging" ||
    pathname.startsWith("/innlogging/") ||
    pathname === "/registrer" ||
    pathname.startsWith("/registrer/")
  );
}

export function applyAppThemeToDocument(
  theme: AppThemeId,
  onAppRoute: boolean
) {
  const root = document.documentElement;
  const body = document.body;
  const locked = DEFAULT_APP_THEME;

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
  root.setAttribute("data-app-theme", locked);
  root.style.backgroundColor = APP_THEME_BACKGROUNDS[locked];
  void theme;
}
