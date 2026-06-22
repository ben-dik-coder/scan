export const MANUS_STORAGE_KEY = "nylead-manus-v1";

export type ManusDocument = {
  title: string;
  bodyHtml: string;
  updatedAt: string;
};

export function loadLocalManus(): ManusDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MANUS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ManusDocument>;
    if (typeof parsed.bodyHtml !== "string") return null;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "Manus",
      bodyHtml: parsed.bodyHtml,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveLocalManus(doc: ManusDocument) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MANUS_STORAGE_KEY, JSON.stringify(doc));
}

export function emptyManus(): ManusDocument {
  return {
    title: "Manus",
    bodyHtml: "",
    updatedAt: new Date().toISOString(),
  };
}
