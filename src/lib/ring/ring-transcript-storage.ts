const STORAGE_KEY = "nylead-ring-transcripts-v1";

export type RingTranscriptRecord = {
  text: string;
  updatedAt: string;
};

type Store = Record<string, RingTranscriptRecord>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadRingTranscript(orgnr: string): string {
  return readStore()[orgnr]?.text ?? "";
}

export function saveRingTranscript(orgnr: string, text: string) {
  const store = readStore();
  store[orgnr] = {
    text,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
}

export function clearRingTranscript(orgnr: string) {
  const store = readStore();
  delete store[orgnr];
  writeStore(store);
}
