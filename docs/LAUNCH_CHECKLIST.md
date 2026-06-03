# NyLead — lanseringssjekkliste

Sist oppdatert: 1. juni 2026  
Prod: https://nye-firma-plattform.vercel.app

---

## Klart for lansering (side 1)

| Område | Status |
|--------|--------|
| Landing, footer, personvern, vilkår, cookie-banner | ✅ |
| Registrering, innlogging, utlogging, session | ✅ |
| App-navigasjon (ingen 404 på hovedmeny) | ✅ |
| Skann markedet — firma, filter, paginering, kompakt tabell | ✅ |
| Nettside-skanning + Facebook/Instagram + lagring i DB | ✅ (krever migrasjon 008) |
| Facebook-e-post i tabell («Fra Facebook») | ✅ |
| E-post: Outlook OAuth + SMTP app-passord | ✅ |
| E-post: Gmail — viser pen melding hvis ikke konfigurert | ✅ |
| Abonnement uten Stripe (`BILLING_FAKE=true`) | ✅ |
| Gratis tilgang for eier (`BILLING_FREE_EMAILS`) | ✅ |
| Kampanjer, maler, pipeline, sekvenser | ✅ |
| Mobil (meny + bunn-faner) | ✅ |
| `npm run build` | ✅ |

---

## Side 2 — utsettes med vilje

| Område | Merknad |
|--------|---------|
| Ekte Stripe-betaling med kort | Sett `BILLING_FAKE=false` + `STRIPE_PRICE` (499 kr/mnd) når dere er klare |
| Gmail OAuth | Valgfritt — sett `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` i Vercel |
| Stripe Customer Portal | Skjult når fake billing er på |

---

## Det DU må gjøre i Supabase

Kjør SQL i [Supabase SQL Editor](https://supabase.com/dashboard/project/umsimryvoifrjmkaelup/sql/new).

### Ny database (første gang)

Kjør migrasjonene i rekkefølge:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_sales_tools.sql`
3. `supabase/migrations/003_user_mail_accounts.sql`

### Eksisterende database (mest sannsynlig)

Kjør **hele** filen `supabase/SETUP_BILLING.sql` — den inkluderer nå:

- **004** — abonnementsfelt på `profiles`
- **005** — `usage_monthly`
- **006** — `usage_company_leads`
- **007** — SMTP-provider (`smtp`) på `user_mail_accounts`
- **008** — `user_website_scans` (lagrer skann-resultater)
- **009** — tillater `plan = nylead` (én pakke)

> Uten 008: skann fungerer, men resultater forsvinner når du bytter side eller logger inn på nytt.

Alternativt kan du kjøre enkeltfiler:

- `supabase/migrations/007_smtp_mail_provider.sql`
- `supabase/migrations/008_user_website_scans.sql`

---

## Miljøvariabler i Vercel

### Må være satt (prod)

| Variabel | Eksempel / merknad |
|----------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-prosjekt URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server) |
| `NEXT_PUBLIC_APP_URL` | `https://nye-firma-plattform.vercel.app` |
| `EMAIL_TOKEN_SECRET` | Minst 32 tilfeldige tegn |
| `CRON_SECRET` | Minst 32 tilfeldige tegn |

### Lansering uten Stripe

| Variabel | Verdi for lansering |
|----------|---------------------|
| `NEXT_PUBLIC_DEMO_MODE` | **`false`** — krever innlogging og abonnement |
| `BILLING_FAKE` | **`true`** — «Aktiver test» i stedet for kort |
| `BILLING_FREE_EMAILS` | Din e-post, f.eks. `ben-dik@hotmail.com` |
| `NEXT_PUBLIC_BRREG_LIVE` | `true` |

### E-post (Outlook)

| Variabel | Merknad |
|----------|---------|
| `MICROSOFT_CLIENT_ID` | Azure app |
| `MICROSOFT_CLIENT_SECRET` | Azure app |
| `MICROSOFT_TENANT_ID` | `common` for privatkontoer |

Redirect URI i Azure: `{NEXT_PUBLIC_APP_URL}/api/email/callback/microsoft`  
Se også `docs/OUTLOOK_SETUP.md`.

### Valgfritt

| Variabel | Merknad |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail OAuth |
| `SERPAPI_API_KEY` | Facebook/Instagram-profil + Google-søk |
| `GOOGLE_CSE_API_KEY` / `GOOGLE_CSE_CX` | Alternativ nettside-søk |
| `RESEND_API_KEY` | Fallback hvis bruker ikke har koblet e-post |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE` | Side 2 — én pakke 499 kr/mnd (se `docs/BILLING_SETUP.md`) |

### Juridisk (personvern/vilkår)

| Variabel |
|----------|
| `NEXT_PUBLIC_LEGAL_NAME` |
| `NEXT_PUBLIC_LEGAL_ORG_NR` |
| `NEXT_PUBLIC_LEGAL_ADDRESS` |
| `NEXT_PUBLIC_LEGAL_EMAIL` |

---

## Test før du annonserer lansering

Gå gjennom dette i prod (logg inn som vanlig bruker, ikke eier):

- [ ] Forside → Registrer → Logg inn
- [ ] Velg abonnement (test) → kom inn i appen
- [ ] **Skann** — filter, paginering, velg firma
- [ ] Kjør nettside-skanning → se FB/IG og «Fra Facebook» på e-post
- [ ] Bytt side og tilbake — skann-resultater skal være der (krever migrasjon 008)
- [ ] **Innstillinger** — koble Outlook (OAuth eller app-passord)
- [ ] **Kampanjer** — send test til deg selv
- [ ] **Abonnement** — viser pakke og grenser
- [ ] **Personvern** og **Vilkår** fra footer
- [ ] Cookie-banner vises første gang
- [ ] Mobil — bunn-meny og «Mer»-skuff
- [ ] Logg ut → innlogging igjen

Som eier (`BILLING_FREE_EMAILS`):

- [ ] Slipper abonnement-sperre
- [ ] Full tilgang uten «Aktiver test»

---

## Kjente begrensninger ved lansering

1. **Fake billing** — brukere «kjøper» pakke uten kort; bytt til Stripe på side 2.
2. **Gmail** — hvis ikke satt opp, vises forklaring i stedet for knapp.
3. **Hotmail app-passord** — fungerer ikke for alle; OAuth er backup.
4. **`NEXT_PUBLIC_DEMO_MODE=true`** — alle slipper inn uten abonnement. **Skal være `false` i prod.**
