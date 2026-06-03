# Brreg — hele registeret i Supabase

Live Brreg-søk (`/enheter`) stopper ofte etter 600–2500 treff pga. API-grense (~10 000 per spørring). For **alle** firma bruker vi bulk-nedlasting + database.

## Strategi

| Steg | Hva |
|------|-----|
| 1 | **Bulk** — last ned `enheter/lastned` (~200 MB gzip) og importer til `companies` |
| 2 | **App** — `/api/companies` leser fra Supabase når `BRREG_USE_DB` er på (eller auto ≥10 000 rader) |
| 3 | **Cron** — automatisk daglig kl. 03:00 (norsk tid): henter nye/endrede enheter siden sist |

Kommune-synk (`{ "kommune": true, "kommuneIndex": 0 }`) finnes som reserve uten bulk-fil.

## Automatiske oppdateringer (ingen manuell jobb)

Etter engangs bulk-import oppdateres listen **helt automatisk**:

1. **Vercel Cron** kaller `GET /api/sync/brreg` **daglig kl. 03:00** norsk tid (02:00 UTC)
2. Synken leser `sync_state.last_sync` og henter kun **delta** fra Brreg (`/oppdateringer/enheter?dato=...`)
3. Nye og endrede firma lagres i Supabase — appen viser dem uten at du gjør noe

Du trenger **ikke** kjøre curl eller trykke på noe etter oppsettet.

### Engangsoppsett i Vercel (prod)

| Variabel | Verdi |
|----------|-------|
| `CRON_SECRET` | Tilfeldig streng (minst 32 tegn) — Vercel sender den som `Authorization: Bearer ...` |
| `BRREG_USE_DB` | `true` |
| `SUPABASE_SERVICE_ROLE_KEY` | Allerede satt |
| `NEXT_PUBLIC_SUPABASE_URL` | Allerede satt |

Cron-konfig ligger i `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/sync/brreg",
      "schedule": "0 2 * * *"
    }
  ]
}
```

## Engangsoppsett (bulk)

```bash
cd /path/til/nye-firma-plattform

# .env.local må ha:
# NEXT_PUBLIC_SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...

npm run brreg:bulk-import
```

Valgfritt — bruk fil du allerede har lastet ned:

```bash
curl -L -o enheter_alle.json.gz \
  "https://data.brreg.no/enhetsregisteret/api/enheter/lastned"
npm run brreg:bulk-import -- --file ./enheter_alle.json.gz
```

Kjør på **egen Mac/PC** (ikke Vercel). Trenger ca. 3 GB RAM og 30–90 min.

## Miljøvariabler

| Variabel | Standard | Betydning |
|----------|----------|-----------|
| `BRREG_USE_DB` | `auto` | `true` = alltid DB, `false` = kun live API, `auto` = DB når ≥10 000 rader i `companies` |
| `NEXT_PUBLIC_BRREG_LIVE` | `true` | Må være på for `/app` |
| `CRON_SECRET` | — | Beskytter cron-endepunkt (Bearer eller `x-cron-secret`) |

## Inkrementell synk (hvordan delta virker)

| Felt | Betydning |
|------|-----------|
| `sync_state.last_sync` | Tidspunkt for forrige vellykkede kjøring — brukes som `dato=` mot Brreg |
| `sync_state.cursor` | Siste `oppdateringsid` — brukes som `oppdateringsid=` (id+1) for presisjon |
| `sync_state.metadata.mode` | `bulk_import`, `updates`, `bootstrap` eller `kommune` |

Standard cron-kjøring (`{}` body) kjører **kun delta**, ikke full bulk.

## Manuell sync (valgfritt, for admin)

```bash
curl -X POST "https://nye-firma-plattform.vercel.app/api/sync/brreg" \
  -H "x-cron-secret: DITT_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Eller med Bearer (samme som Vercel Cron):

```bash
curl "https://nye-firma-plattform.vercel.app/api/sync/brreg" \
  -H "Authorization: Bearer DITT_CRON_SECRET"
```

## Kommune-synk (uten bulk)

Én kommune per kall (for å unngå timeout):

```bash
curl -X POST ".../api/sync/brreg" \
  -H "x-cron-secret: ..." \
  -H "Content-Type: application/json" \
  -d '{"kommune": true, "kommuneIndex": 0}'
```

Øk `kommuneIndex` til alle kommuner er kjørt (~356).

## Sjekk at det virker

1. Supabase → `companies` — forvent **hundretusener+** rader etter bulk
2. `sync_state` — rad `brreg_enheter` med `metadata.mode = bulk_import` (etter import) eller `updates` (etter cron)
3. App → nettverk → `/api/companies` skal ha `"source": "db"`
4. Vercel → Project → Cron Jobs — `/api/sync/brreg` skal vises som aktiv

## Daglig leder (roller-API)

Bulk-filen har **ikke** daglig leder. Feltet `companies.daglig_leder` fylles slik:

| Kilde | Når |
|-------|-----|
| **Cron delta** | Daglig sync henter roller for endrede firma **med e-post** |
| **Backfill** | Engangskjøring for eksisterende rader uten `daglig_leder` |
| **CSV / API** | On-demand hvis feltet fortsatt er tomt |

```bash
# .env.local: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run brreg:backfill-roles
npm run brreg:backfill-roles -- --days 180 --limit 500
```

Ca. 120 ms pause mellom Brreg-kall (rate limit).

## Begrensninger

- **Kontaktinfo i appen** — `applyCompanyContactLimit` gjelder fortsatt (abonnement)
- **Bulk-filen** inneholder ikke daglig leder eller alt Brreg viser i portalen (f.eks. noen underenheter)
- **Første import** — kjør bulk på nytt månedlig hvis dere vil full refresh (eller stol på cron)
- **Live API** brukes fortsatt som fallback når `BRREG_USE_DB=false` eller få rader i DB
