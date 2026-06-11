export type ArticleMeta = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingMinutes: number;
  relatedSlugs: string[];
};

export const ARTICLES: ArticleMeta[] = [
  {
    slug: "finn-nye-firma-a-selge-til",
    title: "Hvordan finne nye firma å selge til i Norge",
    description:
      "En praktisk guide for B2B-selgere som vil finne nye firma å kontakte — uten å bruke hele dagen på research.",
    publishedAt: "2026-06-12",
    readingMinutes: 6,
    relatedSlugs: ["nyregistrerte-firma-norge", "finn-firma-kommune-bransje"],
  },
  {
    slug: "telefon-og-epost-til-bedrifter",
    title: "Finn telefon og e-post til bedrifter — uten manuelt rot",
    description:
      "Slik finner du telefonnummer og e-post til norske bedrifter raskere, og slipper å hoppe mellom ti forskjellige kilder.",
    publishedAt: "2026-06-12",
    readingMinutes: 5,
    relatedSlugs: ["finn-kunder-med-telefon", "brreg-finne-kunder"],
  },
  {
    slug: "leadgenerering-b2b-selgere",
    title: "Leadgenerering for B2B-selgere: en enkel guide",
    description:
      "Hva god leadgenerering faktisk betyr for B2B-selgere i Norge — og hvordan du går fra tilfeldig liste til leads du kan ringe på.",
    publishedAt: "2026-06-12",
    readingMinutes: 7,
    relatedSlugs: ["finn-nye-firma-a-selge-til", "folge-opp-leads"],
  },
  {
    slug: "brreg-finne-kunder",
    title: "Slik bruker du Brreg til å finne nye kunder",
    description:
      "Brønnøysundregistrene er gullgruven for nye firma i Norge. Her er hvordan du bruker det smart i salgsarbeidet.",
    publishedAt: "2026-06-12",
    readingMinutes: 6,
    relatedSlugs: ["nyregistrerte-firma-norge", "finn-firma-kommune-bransje"],
  },
  {
    slug: "finn-firma-kommune-bransje",
    title: "Finn firma i ditt område: kommune og bransje",
    description:
      "Vil du selge lokalt? Slik finner du riktige firma i riktig kommune og bransje — uten å drukne i irrelevante treff.",
    publishedAt: "2026-06-12",
    readingMinutes: 5,
    relatedSlugs: ["finn-nye-firma-a-selge-til", "brreg-finne-kunder"],
  },
  {
    slug: "kald-kontakt-nye-firma",
    title: "Kald kontakt til nye firma: hva som faktisk fungerer",
    description:
      "Kald e-post og kald telefon til nye firma kan fungere — hvis du gjør det riktig. Her er det som skiller bra fra spam.",
    publishedAt: "2026-06-12",
    readingMinutes: 6,
    relatedSlugs: ["telefon-og-epost-til-bedrifter", "folge-opp-leads"],
  },
  {
    slug: "folge-opp-leads",
    title: "Følg opp leads uten å miste oversikten",
    description:
      "De fleste salg tapes i oppfølgingen. Slik holder du styr på hvem du har kontaktet, og hvem som må ringes igjen.",
    publishedAt: "2026-06-12",
    readingMinutes: 5,
    relatedSlugs: ["leadgenerering-b2b-selgere", "kald-kontakt-nye-firma"],
  },
  {
    slug: "nyregistrerte-firma-norge",
    title: "Selg til nyregistrerte firma i Norge",
    description:
      "Nye firma i Brreg er ofte de beste mulighetene — de trenger hjelp, og konkurrentene har ikke nådd dem ennå.",
    publishedAt: "2026-06-12",
    readingMinutes: 6,
    relatedSlugs: ["brreg-finne-kunder", "finn-nye-firma-a-selge-til"],
  },
  {
    slug: "finn-kunder-med-telefon",
    title: "Finn kunder med telefon og e-post på ett sted",
    description:
      "Slutt å lete telefonnummer og e-post på fem forskjellige sider. Slik samler du kontaktinfo på ett sted.",
    publishedAt: "2026-06-12",
    readingMinutes: 5,
    relatedSlugs: ["telefon-og-epost-til-bedrifter", "ai-assistent-salg-norsk"],
  },
  {
    slug: "ai-assistent-salg-norsk",
    title: "Spør på norsk og få leads klare til å ringe",
    description:
      "AI i salg handler ikke om magi — det handler om å finne riktige firma raskere. Slik bruker du en assistent på vanlig norsk.",
    publishedAt: "2026-06-12",
    readingMinutes: 5,
    relatedSlugs: ["finn-firma-kommune-bransje", "finn-kunder-med-telefon"],
  },
];

export function getArticleBySlug(slug: string): ArticleMeta | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getAllArticleSlugs(): string[] {
  return ARTICLES.map((a) => a.slug);
}

export function getRelatedArticles(slug: string): ArticleMeta[] {
  const article = getArticleBySlug(slug);
  if (!article) return [];
  return article.relatedSlugs
    .map((s) => getArticleBySlug(s))
    .filter((a): a is ArticleMeta => a !== undefined);
}
