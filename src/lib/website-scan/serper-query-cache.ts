import type { SearchHit } from "./parse-results";

export type CachedSerperPlaceHit = {
  title: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  category?: string;
  rating?: number;
  position?: number;
};

const TTL_MS = 10 * 60 * 1000;

type CacheEntry<T> = { value: T; expiresAt: number };

const searchCache = new Map<string, CacheEntry<SearchHit[]>>();
const placesCache = new Map<string, CacheEntry<CachedSerperPlaceHit[]>>();

function normalizeKey(kind: "search" | "places", query: string): string {
  return `${kind}:${query.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function read<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function write<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function getCachedSerperSearch(query: string): SearchHit[] | undefined {
  return read(searchCache, normalizeKey("search", query));
}

export function setCachedSerperSearch(query: string, hits: SearchHit[]) {
  write(searchCache, normalizeKey("search", query), hits);
}

export function getCachedSerperPlaces(
  query: string
): CachedSerperPlaceHit[] | undefined {
  return read(placesCache, normalizeKey("places", query));
}

export function setCachedSerperPlaces(
  query: string,
  hits: CachedSerperPlaceHit[]
) {
  write(placesCache, normalizeKey("places", query), hits);
}
