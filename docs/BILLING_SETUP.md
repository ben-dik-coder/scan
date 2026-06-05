# Stripe-abonnement (NyLead)

## Vercel miljøvariabler (Production)

Sett disse under **Vercel → Project → Settings → Environment Variables → Production** (ikke bare Preview). **Redeploy** etter endring.

| Variabel | Påkrevd | Beskrivelse |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | Ja | Secret key (`sk_live_…`) fra Stripe Dashboard → Developers → API keys. **Ikke** `pk_…`, **ikke** `whsec_…`, **ikke** `price_…`. Lim inn uten anførselstegn. |
| `STRIPE_WEBHOOK_SECRET` | Ja | Signing secret (`whsec_…`) fra webhook-endepunkt (se under) |
| `STRIPE_PRICE` | Ja | Price ID (`price_…`) for NyLead (499 kr/mnd), samme test/live-modus som nøkkelen |
| `BILLING_FAKE` | Anbefalt | Sett `false` i prod når Stripe er satt opp |
| `BILLING_FREE_EMAILS` | Valgfritt | Kommaseparerte e-poster med gratis tilgang (f.eks. `ben-dik@hotmail.com`) |
| `NEXT_PUBLIC_APP_URL` | Ja | `https://nylead.no` — brukes i Stripe redirect-URL-er |
| `NEXT_PUBLIC_DEMO_MODE` | Viktig | Sett `false` i prod — ellers slipper alle inn uten abonnement |

### Feilsøking Stripe-nøkkel

Åpne `https://nylead.no/api/billing/status` etter deploy:

- `stripeKeyKind` skal være `"live"` (prod) eller `"test"` (dev)
- `stripeReady` skal være `true`
- `stripeKeyDebug.maskedPrefix` skal starte med `sk_live` (eller `sk_test`)
- `appUrl` skal være `https://nylead.no`

Hvis du får «STRIPE_SECRET_KEY ser ugyldig ut» selv om nøkkelen ser riktig ut i Vercel: sjekk at den er satt for **Production**, uten `"` foran, og at du har **redeployet** etter lagring.

### Bakoverkompatibilitet (valgfritt)

Eldre Stripe-priser kan fortsatt mappes via webhook:

| Variabel | Beskrivelse |
|----------|-------------|
| `STRIPE_PRICE_NYLEAD` | Alias for `STRIPE_PRICE` |
| `STRIPE_PRICE_START` | Eldre Start-pris (399 kr) |
| `STRIPE_PRICE_PRO` | Eldre Pro-pris (644 kr) |
| `STRIPE_PRICE_AGENCY` | Eldre Byrå-pris (1294 kr) |

Nye kunder skal kun bruke **én** pris: `STRIPE_PRICE` (499 kr/mnd).

## Stripe Dashboard

1. **Produkt og pris** — opprett **ett** månedlig abonnement: **NyLead, 499 NOK/mnd**. Kopier Price ID til `STRIPE_PRICE` i Vercel.
2. **Webhook** — legg til endpoint (bruk **nylead.no** hvis det er prod-domene):
   - URL: `https://nylead.no/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Kopier signing secret til `STRIPE_WEBHOOK_SECRET`
3. **Customer Portal** (valgfritt) — aktiver i Stripe → Settings → Billing → Customer portal, så brukere kan endre/avslutte abonnement.

## Lokal utvikling

- `BILLING_FAKE=true` — aktiverer test-abonnement uten kort
- Uten Stripe-nøkler brukes fake-modus automatisk (med mindre `BILLING_FAKE=false`)

## Gratis tilgang (plattform-eier)

E-poster i `BILLING_FREE_EMAILS` får full NyLead-tilgang uten Stripe-betaling. De trenger ikke velge pakke.

## Flyt for betalende kunder

1. Bruker registrerer seg og går til `/app/abonnement`
2. `POST /api/billing/checkout` oppretter Stripe Checkout Session (NyLead)
3. Bruker betaler med kort på Stripe sin side
4. Webhook oppdaterer `profiles` med plan (`nylead`) og status
5. Bruker kan administrere abonnement via Stripe Customer Portal

## Database

Kjør `supabase/migrations/009_nylead_plan.sql` (eller oppdatert `SETUP_BILLING.sql`) for å tillate `plan = 'nylead'` i Supabase.
