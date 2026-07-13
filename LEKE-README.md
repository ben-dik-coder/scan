# NyLead leke-mappe (`nylead-leke`)

Dette er **trygg sandkasse** for store endringer. Produksjon (`main` / nylead.no) ligger i `nye-firma-plattform` og røres ikke her.

## Kom i gang

```bash
cd /Users/ben/nylead-leke
npm install
npm run dev
```

I `.env.local`:

```
NEXT_PUBLIC_NYLEAD_V2=1
```

Uten denne flaggen kjører appen som før (gammel kø-flyt).

## Kart over mapper

| Mappe | Hva |
|-------|-----|
| `src/domain/` | Enkle modeller: `List`, `WorkQueue`, `DialLead`, `Lane` |
| `src/lib/lists/` | Liste-oppslag på server (`list-repository.ts`) |
| `src/lib/queues/` | Navngitte køer + rekkefølge (`queue-repository.ts`) |
| `src/hooks/useWorkQueue.ts` | Kø i React (Ko) |
| `src/hooks/useDialSession.ts` | Felles ring/SMS-logikk |
| `src/components/apple/` | Apple-lignende UI-komponenter |
| `src/components/queues/WorkQueuePanel.tsx` | Mine køer + dra-og-slipp |
| `src/app/api/lists/` | Listemedlemmer og dial fra liste |
| `src/app/api/queues/` | CRUD for køer |
| `supabase/migrations/023_*.sql` | Nye tabeller `work_queues` |
| `supabase/migrations/024_*.sql` | `lane_key` på Smartliste-soner |

## Vanlige endringer du kan gjøre selv

### Endre tekst på en knapp (Ring)

1. Åpne `src/app/app/ring/RingClient.tsx`
2. Finn teksten du vil endre
3. Lagre og kjør `npm run dev`

### Legge til en ny kø-funksjon

1. API: `src/app/api/queues/[id]/items/route.ts`
2. Logikk: `src/lib/queues/queue-repository.ts`
3. UI: `src/components/queues/WorkQueuePanel.tsx`

### Endre Apple-farger

1. `src/styles/apple-tokens.css` — variabler som `--apple-tint`, `--apple-bg`

### Ny Smartliste-sone (standardfarger)

1. `src/lib/smartliste/board-config.ts` — `DEFAULT_LANE_SEEDS`
2. Brukere kan også trykke **+** på Smartliste (krever migrasjon 024)

## Database (prod)

Migrasjonene er **additive**. Kjør i Supabase SQL editor når du er klar:

1. `023_work_queues.sql`
2. `024_lane_key.sql`

Eksisterende `user_leads.queued_at` synkes til «Min arbeidskø» første gang V2 brukes.

## Deploy preview

```bash
git add .
git commit -m "Beskriv endringen"
git push -u origin leke/store-endringer
```

Vercel lager preview-URL. **Ikke merge til main** før du er fornøyd.

## Ikke rør

- `/Users/ben/nye-firma-plattform` (main)
- Berikelsesjobber som kjører der
