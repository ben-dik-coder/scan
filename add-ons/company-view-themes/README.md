# Company view themes (add-on)

Ti ulike utseender for **firmavisningen** i NyLead. Dette er kun for forhåndsvisning og valg — ingen endringer i produksjonskode (`CompanyTable`, `AppPageClient`, osv.).

## Felter som vises (som i dag)

Hvert tema viser eksempeldata med:

- Firmanavn
- Org.nr
- E-post
- Telefon
- Nettside-status
- Avkrysningsboks (velg firma / velg alle)

## Temaer

| # | ID | Navn | Vibe | Når bruke |
|---|-----|------|------|-----------|
| 1 | `minimal-white` | Minimal hvit | Luftig, ren | Rolig, profesjonell liste uten støy |
| 2 | `midnight-dark` | Midnatt mørk | Dark mode | Kveldsbruk, mindre lys i øynene |
| 3 | `card-grid` | Kort-rutenett | 2-kolonne kort | Mobilvennlig skanning |
| 4 | `compact-table` | Kompakt tabell | Tett tabell | Mange firma per skjerm |
| 5 | `magazine-editorial` | Magasin | Store titler | Navn skal føles viktige |
| 6 | `brutalist` | Brutalist | Hard kontrast | Tydelig, dristig merkevare |
| 7 | `soft-pastel` | Myk pastell | Vennlig, rund | Mindre «tech», mer innbydende |
| 8 | `corporate-blue` | Bedrift blå | Klassisk B2B | Tradisjonell salgsavdeling |
| 9 | `nordic-nature` | Nordisk natur | Skog og sand | Norsk, tillitsfullt uttrykk |
| 10 | `retro-terminal` | Retro terminal | Monospace grønn | Tech-team / intern demo |

## Mappestruktur

```
add-ons/company-view-themes/
  README.md
  sample-data.ts
  themes/
    index.ts
    01-minimal-white/
      tokens.css
      CompanyListPreview.tsx
    … (10 mapper)
```

## Forhåndsvisning i Cursor

Åpne canvas-filen (lenke i chat fra agenten):

`canvases/company-view-themes.canvas.tsx`

Der kan du bytte mellom alle 10 temaer og se 4 eksempelfirma per tema.

## Forhåndsvisning i nettleser (valgfritt)

Hver mappe har `CompanyListPreview.tsx` + `tokens.css`. Disse kan importeres i en midlertidig demo-side senere — ikke koblet til appen ennå.

## Slik velger du ett tema senere

1. Se gjennom alle 10 i canvas (eller åpne preview-komponentene).
2. Noter **tema-ID** (f.eks. `nordic-nature`).
3. Si til utvikler/agent: «Vi vil ha tema `nordic-nature` i CompanyTable» — da kan `tokens.css` og layout flyttes inn i produksjon.

## Integrasjon (fremtidig, ikke gjort nå)

- Kopier valgt `tokens.css` til appens design tokens.
- Erstatt eller variant av `CompanyTable` med valgt `CompanyListPreview`-layout.
- Behold samme props: `companies`, `selected`, `onToggle`, osv.
