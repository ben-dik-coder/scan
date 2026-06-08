import type { SearchHit } from "./parse-results";

type SerperOrganic = {
  title?: string;
  link?: string;
};

type SerperResponse = {
  organic?: SerperOrganic[];
  message?: string;
};

const SERPER_TIMEOUT_MS = 20_000;

export async function searchSerper(
  query: string,
  options?: { num?: number }
): Promise<SearchHit[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Serper er ikke konfigurert");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERPER_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "no",
        hl: "no",
        num: Math.min(20, Math.max(5, options?.num ?? 10)),
      }),
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Serper tok for lang tid");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json()) as SerperResponse;

  if (!res.ok) {
    throw new Error(data.message ?? `Serper feilet (${res.status})`);
  }

  return (data.organic ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      title: item.title!,
      link: item.link!,
    }));
}
