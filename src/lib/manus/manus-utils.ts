export type ManusHeading = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
};

export function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? div.innerText ?? "").replace(/\s+/g, " ").trim();
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function estimateReadingMinutes(words: number): number {
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / 150));
}

export function extractHeadings(html: string): ManusHeading[] {
  if (typeof document === "undefined") return [];
  const div = document.createElement("div");
  div.innerHTML = html;
  const nodes = div.querySelectorAll("h1, h2, h3");
  return Array.from(nodes).map((node, index) => {
    const tag = node.tagName.toLowerCase();
    const level = tag === "h1" ? 1 : tag === "h2" ? 2 : 3;
    const text = (node.textContent ?? "").trim() || `Avsnitt ${index + 1}`;
    const id = `manus-h-${index}-${text.toLowerCase().replace(/\W+/g, "-").slice(0, 40)}`;
    return { id, level, text };
  });
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildPrintHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 720px; margin: 2rem auto; line-height: 1.6; color: #111; }
    h1 { font-size: 1.75rem; } h2 { font-size: 1.35rem; } h3 { font-size: 1.1rem; }
    blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1rem; color: #444; }
    pre { background: #f4f4f4; padding: 0.75rem; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${bodyHtml}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printManus(title: string, bodyHtml: string) {
  const html = buildPrintHtml(title, bodyHtml);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export const MANUS_NOTES_STORAGE_KEY = "nylead-manus-notes-v1";

export function browserFindInPage(query: string): boolean {
  if (typeof window === "undefined" || !query.trim()) return false;
  const w = window as Window & {
    find?: (
      text: string,
      caseSensitive?: boolean,
      backwards?: boolean,
      wrapAround?: boolean,
      wholeWord?: boolean,
      searchInFrames?: boolean,
      showDialog?: boolean
    ) => boolean;
  };
  return w.find?.(query, false, false, true, false, true, false) ?? false;
}

export function loadManusNotes(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(MANUS_NOTES_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveManusNotes(notes: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MANUS_NOTES_STORAGE_KEY, notes);
}
