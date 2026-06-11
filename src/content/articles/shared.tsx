import Link from "next/link";
import type { ArticleMeta } from "@/lib/articles";
import { getRelatedArticles } from "@/lib/articles";

export function ArticleCta() {
  return (
    <div className="not-prose mt-10 rounded-2xl border border-app-accent/20 bg-app-accent-pale p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold text-app-ink">
        Klar til å finne nye kunder?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        NyLead finner nye firma, kontaktinfo og signaler du kan bruke med én gang. Prøv gratis —
        ingen kredittkort for å se innsiden.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/registrer" className="btn-primary !text-xs sm:!text-sm">
          Opprett gratis konto
        </Link>
        <Link
          href="/innlogging"
          className="inline-flex items-center rounded-[10px] border-2 border-app-ink/15 px-5 py-3 text-sm font-semibold text-app-ink transition hover:border-app-accent/40"
        >
          Logg inn
        </Link>
      </div>
    </div>
  );
}

export function RelatedArticles({ slug }: { slug: string }) {
  const related = getRelatedArticles(slug);
  if (related.length === 0) return null;

  return (
    <aside className="not-prose mt-10 border-t border-slate-200 pt-8">
      <h2 className="font-display text-lg font-bold text-app-ink">Les også</h2>
      <ul className="mt-4 space-y-3">
        {related.map((a: ArticleMeta) => (
          <li key={a.slug}>
            <Link
              href={`/artikler/${a.slug}`}
              className="text-sm font-medium text-app-accent hover:text-app-accentLight"
            >
              {a.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
