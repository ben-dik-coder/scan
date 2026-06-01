import type { SearchHit } from "./parse-results";

type GoogleCseItem = {
  title?: string;
  link?: string;
};

type GoogleCseResponse = {
  items?: GoogleCseItem[];
  error?: { message?: string };
};

export async function searchGoogleCse(query: string): Promise<SearchHit[]> {
  const key = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_CX?.trim();
  if (!key || !cx) {
    throw new Error("Google Custom Search er ikke konfigurert");
  }

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: "10",
    gl: "no",
    hl: "no",
    safe: "active",
  });

  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  const data = (await res.json()) as GoogleCseResponse;

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Google CSE feilet (${res.status})`);
  }

  return (data.items ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      title: item.title!,
      link: item.link!,
    }));
}
