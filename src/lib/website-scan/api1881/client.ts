import {
  API1881_BASE_URL,
  getApi1881PrimaryKey,
  getApi1881SecondaryKey,
} from "./config";

const TIMEOUT_MS = 12_000;

type Api1881Json = Record<string, unknown>;

function subscriptionKeys(): string[] {
  const keys = [getApi1881PrimaryKey(), getApi1881SecondaryKey()].filter(
    (k): k is string => Boolean(k)
  );
  return [...new Set(keys)];
}

function shouldRetryWithSecondary(status: number): boolean {
  return status === 401 || status === 403 || status === 429;
}

async function fetchWithKey(
  url: string,
  subscriptionKey: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** GET mot 1881 API — prøver primary, deretter secondary ved auth/rate-limit. */
export async function api1881Get(path: string): Promise<Api1881Json | null> {
  const keys = subscriptionKeys();
  if (keys.length === 0) return null;

  const url = new URL(path.replace(/^\//, ""), API1881_BASE_URL).toString();
  let lastStatus = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    try {
      const res = await fetchWithKey(url, key);
      lastStatus = res.status;

      if (res.ok) {
        return (await res.json()) as Api1881Json;
      }

      if (shouldRetryWithSecondary(res.status) && i < keys.length - 1) {
        continue;
      }

      return null;
    } catch {
      if (i < keys.length - 1) continue;
      return null;
    }
  }

  if (lastStatus) return null;
  return null;
}
