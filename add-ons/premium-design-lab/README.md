# Premium design-lab (add-on)

Ti Apollo-inspirerte temaer for **landing** og **skann** — helt isolert fra produksjon.

## Forhåndsvisning

| Side | URL |
|------|-----|
| Indeks | `/design-lab` |
| Landing-galleri | `/design-lab/landing` |
| Skann-galleri | `/design-lab/scan` |
| Ett tema | `/design-lab/landing/apollo-obsidian` eller `/design-lab/scan/apollo-obsidian` |

## Temaer

Se `themes/index.ts` for liste og `id` (brukes i URL).

## Produksjon røres ikke

- Ingen endring i `src/app/page.tsx`, `AppPageClient`, `globals.css`, `CompanyTable`
- Kun nye filer under `add-ons/premium-design-lab/` og `src/app/design-lab/`

## Velg vinner

1. Bla gjennom alle 10 på landing + skann
2. Noter `themeId` (f.eks. `nylead-nordic`)
3. Egen PR: kopier `tokens.css` + layout inn i prod

## Rollback

Slett `add-ons/premium-design-lab/` og `src/app/design-lab/` — prod er uendret.
