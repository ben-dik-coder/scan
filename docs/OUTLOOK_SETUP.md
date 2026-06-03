# Koble Outlook / Hotmail i NyLead

## Hva skal du bruke?

| Situasjon | Metode |
|-----------|--------|
| Privat `@hotmail.com` / `@outlook.com` og app-passord **fungerer** | App-passord (SMTP) i Innstillinger |
| Microsoft sier «basic auth er slått av» (feil 535) | **Outlook (OAuth)** — se under |
| Jobb-konto (Microsoft 365) | Outlook (OAuth) |

---

## Outlook med OAuth (anbefalt når app-passord ikke virker)

**Du (Ben) setter opp Azure én gang.** Alle brukere klikker bare «Koble Outlook (OAuth)» — de trenger ikke egen Azure-konto.

### Steg 1: Åpne Azure (gratis, ingen kredittkort for app-registrering)

1. Gå til **[https://portal.azure.com](https://portal.azure.com)**
2. Logg inn med **din vanlige Microsoft-konto** (f.eks. `ben-dik@hotmail.com`)
3. Hvis du blir bedt om «tenant»: velg **personlig** konto / «Personal Microsoft account» — **ikke** betalt bedrifts-abonnement med kredittkort

> Tips: Du kan også gå direkte til app-registreringer:  
> **[https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)**

### Steg 2: Lag ny app-registrering

1. Klikk **+ New registration** (Ny registrering)
2. **Name:** `NyLead` (eller hva du vil)
3. **Supported account types** — velg **denne** (viktig for privat Hotmail):

   **«Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)»**

   (På norsk portal kan det hete noe med «organisasjonskataloger **og** personlige Microsoft-kontoer».)

4. **Redirect URI**
   - Type: **Web**
   - URL (kopier **nøyaktig**, ingen `/` på slutten):

   ```
   https://nye-firma-plattform.vercel.app/api/email/callback/microsoft
   ```

5. Klikk **Register**

### Steg 3: API-tillatelser

1. I appen: **API permissions** → **Add a permission**
2. **Microsoft Graph** → **Delegated permissions**
3. Legg til:
   - `Mail.Send`
   - `User.Read`
   - `offline_access` (ofte under «OpenId permissions» eller søk etter «offline»)
4. Klikk **Add permissions**
5. (Valgfritt) **Grant admin consent** — for personlige kontoer er det ofte **ikke** nødvendig; brukeren godtar når de logger inn

### Steg 4: Client ID og hemmelighet (secret)

1. **Overview** → kopier **Application (client) ID** → dette er `MICROSOFT_CLIENT_ID`
2. **Certificates & secrets** → **New client secret**
   - Beskrivelse: f.eks. `NyLead prod`
   - Utløp: 24 måneder (eller det du vil)
3. Kopier **Value** med én gang (vises ikke igjen) → dette er `MICROSOFT_CLIENT_SECRET`

### Steg 5: Lim inn i Vercel (produksjon)

Gå til Vercel → prosjekt **nye-firma-plattform** → **Settings** → **Environment Variables** → **Production**:

| Navn | Verdi |
|------|--------|
| `MICROSOFT_CLIENT_ID` | Application (client) ID fra Azure |
| `MICROSOFT_CLIENT_SECRET` | Secret **Value** fra Azure |
| `MICROSOFT_TENANT_ID` | `common` |
| `NEXT_PUBLIC_APP_URL` | `https://nye-firma-plattform.vercel.app` |
| `EMAIL_TOKEN_SECRET` | (finnes allerede — ikke endre uten grunn) |

Etter nye/endrede variabler: **Redeploy** (eller kjør `npx vercel --prod`).

**Fra terminal** (erstatt `DIN_CLIENT_ID` og `DIN_SECRET` — vis dem aldri i chat):

```bash
cd nye-firma-plattform
printf '%s' 'DIN_CLIENT_ID' | npx vercel env add MICROSOFT_CLIENT_ID production
printf '%s' 'DIN_SECRET' | npx vercel env add MICROSOFT_CLIENT_SECRET production
printf '%s' 'common' | npx vercel env add MICROSOFT_TENANT_ID production
npx vercel --prod --yes
```

### Steg 6: Test i NyLead

1. Åpne **[https://nye-firma-plattform.vercel.app/app/innstillinger](https://nye-firma-plattform.vercel.app/app/innstillinger)**
2. Under **Outlook (OAuth)** skal det stå at du kan koble (ikke «Krever Azure-oppsett»)
3. Klikk **Koble Outlook (OAuth)**
4. Logg inn med `ben-dik@hotmail.com` og godta tillatelser
5. Du skal komme tilbake med grønn melding: «Outlook er koblet!»

---

## Teknisk (for utvikler)

- **Redirect URI:** `{NEXT_PUBLIC_APP_URL}/api/email/callback/microsoft`
- **Prod:** `https://nye-firma-plattform.vercel.app/api/email/callback/microsoft`
- **OAuth-endepunkt:** `login.microsoftonline.com/common` (støtter jobb **og** privat Hotmail når app-typen over er valgt)
- **Scopes:** `offline_access`, `openid`, `email`, `Mail.Send`, `User.Read`
- **Connect:** `GET /api/email/connect/microsoft`
- **Callback:** `GET /api/email/callback/microsoft`

---

## Alternativ: App-passord (SMTP) — uten Azure

Fungerer **ikke** for alle Hotmail-kontoer lenger (Microsoft har slått av basic auth).

1. [account.microsoft.com/security](https://account.microsoft.com/security) → totrinnsbekreftelse → app-passord
2. NyLead → Innstillinger → **Outlook / Hotmail** → lim inn e-post + app-passord

---

## Gmail

Se `.env.local.example` for `GOOGLE_CLIENT_ID` og `GOOGLE_CLIENT_SECRET`.

---

## Feilsøking

| Problem | Løsning |
|---------|---------|
| `535 5.7.139` / basic auth | Bruk **Outlook (OAuth)**, ikke app-passord |
| «Outlook (OAuth) er ikke satt opp» | `MICROSOFT_CLIENT_ID` og `SECRET` mangler i Vercel — gjør steg 5 |
| Redirect-feil `AADSTS50011` | Redirect URI i Azure må være **nøyaktig** lik prod-URL over |
| «personal account not supported» | Feil app-type — velg **multitenant + personal accounts** (steg 2.3) |
| Tom `NEXT_PUBLIC_APP_URL` | Sett til `https://nye-firma-plattform.vercel.app` i Vercel |

## Resend (fallback)

Uten koblet bruker-e-post kan plattformen bruke `RESEND_API_KEY` — da sendes fra plattformens adresse.
