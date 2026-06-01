# Salgsverktøy — research og implementasjon

Basert på research av Apollo.io, Instantly, HubSpot, Outreach, Tribe CRM og moderne outbound-stack (2025–2026).

## Hva gode salgsverktøy har

| Funksjon | Hvorfor det teller | Implementert i NyLead |
|----------|-------------------|------------------------|
| **Pipeline / lead-status** | Ingen leads faller mellom stolene | Kanban: ny → kontaktet → svarte → møte → vunnet/tapt |
| **Lead scoring** | Prioriter hvem du ringer/mailer først | Auto-score 0–100 basert på e-post, telefon, alder |
| **E-postmaler** | Spar tid, konsistent budskap | `/app/maler` — lagre og gjenbruk maler |
| **E-postsekvenser** | Oppfølging uten manuelt arbeid | `/app/sekvenser` — flerstegs med forsinkelse (dag 0, 3, 7) |
| **Aktivitetslogg** | Full historikk per firma | `lead_activities` — sendt, status, notat |
| **Notater** | Selger husker kontekst | Notatfelt per lead i pipeline |
| **Lagrede lister (ICP)** | Gjenbruk filter for område/bransje | `saved_lists` med filter-JSON |
| **Kampanjestatistikk** | Se hva som fungerer | `/app/kampanjer` — historikk og tall |
| **Oppfølging-påminnelser** | Ring tilbake til riktig tid | `next_follow_up_at` på leads |
| **Auto-stopp ved svar** | Unngå spam etter svar | Sekvens settes på pause ved status «svarte» |

## Lead scoring (regler)

- +30 har e-post
- +20 generell e-post (post@, info@) — trygg for masseutsendelse
- +15 har telefon eller mobil
- +25 registrert siste 7 dager
- +15 registrert siste 30 dager
- +5 registrert siste 90 dager

Maks 100 poeng.

## Pipeline-statuser

1. `ny` — ikke kontaktet
2. `kontaktet` — e-post/telefon sendt
3. `svarte` — de svarte (sekvens pauses)
4. `moete_booket` — møte avtalt
5. `vunnet` — kunde
6. `tapt` — nei takk
7. `ikke_interessert` — eksplisitt avslag

## Lov og Norge

- Generell e-post (post@, info@): OK uten samtykke (markedsføringsloven §15)
- Personlig e-post: krever samtykke — appen blokkerer som standard
- Avmeldingslenke i hver e-post

## Datakilder

- Brønnøysund Enhetsregisteret (gratis) — nye firma, e-post når tilgjengelig
- Proff API (betalt) — ikke brukt i MVP
