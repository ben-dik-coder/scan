# Scanix (GPS + kart + logg)

## Kjøre lokalt på PC

```bash
cd count-clicker
npm install
npm run dev
```

Åpne lenken Vite viser (vanligvis `https://localhost:5173`). Godkjenn sertifikatvarselet ved første besøk – det er forventet med lokal HTTPS.

## Personlig hotspot (iPhone deler nett til Mac)

Da får Mac ofte en adresse som **`172.20.10.x`** (som i Vite under **Network**). Det er helt normalt.

- Bruk **`https://172.20.10.x:5173`** i Safari – **ikke** `http://`.
- Kjør **`npm run dev`** (HTTPS), ikke `npm run dev:http`.
- Godkjenn **sertifikatvarselet** første gang.

## Teste på mobil (samme Wi‑Fi som PC)

1. Start utviklingsserveren: `npm run dev`
2. Se i terminalen etter linjen **Network** – den har en `https://`-adresse, ofte `https://192.168.x.x:5173`
3. På telefonen: koble til **samme trådløse nett** som Mac-en, åpne nettleseren og gå til **den Network-URL-en**
4. Første gang: godkjenn **sertifikat** (selvsignert lokalt sertifikat)
5. Tillat **posisjon** når nettleseren spør

**Viktig for GPS:** Bruk alltid **`https://`-lenken**, ikke `http://` til IP-adresse.

Hvis du ikke ser **Network**, start `npm run dev` på nytt og sjekk at ingen feilmelding om opptatt port.

**Tips:** Slå av VPN på telefon/PC hvis siden ikke laster.

### Safari sier «kunne ikke åpne tjenesten» / siden laster ikke

Det betyr nesten alltid at **telefonen ikke når Mac-en** (brannmur, feil nett, feil IP/port) – ikke at appen er «ødelagt».

#### Steg A – Test uten HTTPS (kun for å sjekke nettverk)

1. Stopp eventuell kjørende `npm run dev`.
2. Kjør: `npm run dev:http`
3. I terminalen, noter **Network**-URL med **`http://`** (ikke https), f.eks. `http://192.168.1.5:5173`
4. Åpne **nøyaktig den** på telefonen (samme Wi‑Fi som Mac).

- **Åpner siden nå?** Da fungerer LAN; problemet var sannsynligvis HTTPS/sertifikat eller brannmur som bare blokkerte delvis. Gå til steg B.
- **Åpner fortsatt ikke?** Da blokkeres tilkoblingen (brannmur, ikke samme nett, gjestenett med isolasjon, feil IP). Gå til steg C.

`dev:http` gir **ikke** tilgang til GPS i nettleseren (krever https) – bare nettverkstest.

#### Steg B – Tilbake til vanlig utvikling med GPS

1. Stopp serveren, kjør `npm run dev` (HTTPS).
2. Bruk **Network**-lenken med **`https://`** på telefonen.
3. Godkjenn **sertifikatvarselet** i Safari (forventet lokalt).

#### Steg C – Sjekkliste når ingenting åpner

1. **Samme Wi‑Fi** på iPhone og Mac (ikke «bare mobilnett» på telefonen med Mac på Wi‑Fi).
2. **Ikke gjestenett** som isolerer enheter fra hverandre.
3. **Mac-brannmur:** *Systeminnstillinger → Nettverk → Brannmur* – tillat **Node** / **Terminal** / **Cursor** for innkommende, eller slå brannmur **midlertidig av** for å teste.
4. **Riktig IP:** Bruk IP fra Vite-linjen **Network**, ikke `localhost` / `127.0.0.1` på telefonen.
5. **Port:** Standard er **5173** – hele URL-en må være med `:5173` hvis terminalen viser det.

#### Steg D – Når LAN aldri fungerer: tunnel (internett)

Da trenger du ikke LAN mellom telefon og Mac:

1. Terminal 1: `npm run dev`
2. Terminal 2 (krever nett og [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)):

```bash
npx cloudflared tunnel --url https://localhost:5173
```

Følg URL-en `cloudflared` skriver ut (https://….trycloudflare.com e.l.). **GPS krever https**, som denne typisk gir.

---

Når siden *faktisk* åpner over LAN med `https`, kan Safari advare om **sertifikat** – velg å fortsette (normalt for lokal utvikling).

## Produksjonsbygg for test

```bash
npm run build
npm run preview
```

Bruk **Network**-URL fra `preview` på samme måte som over for å teste på mobil.

## Deploy (produksjon)

Du trenger **to ting**: **frontend** (statiske filer) og **backend** (mappen `server/`, Node).

### 1. Backend på [Render](https://render.com) (API: PDF + OpenAI)

Repoet inkluderer **`render.yaml`** (Blueprint). Kort oppskrift:

1. Push til GitHub/GitLab/Bitbucket.
2. I Render: **New → Blueprint** → velg repo → bekreft at `render.yaml` oppdages.
3. Etter første opprettelse: **Environment** på tjenesten `scanix-api` → legg inn **`OPENAI_API_KEY`** (hemmelighet – ikke i git).
4. Noter den offentlige URL-en (f.eks. `https://scanix-api.onrender.com`). Test: `GET …/api/health` skal returnere JSON med `"ok": true`.

Allerede satt i blueprint: **`RENDER=true`** (Puppeteer bruker `@sparticuz/chromium` på Render), **`NODE_VERSION=20`**, health check mot **`/api/health`**. `PORT` settes av Render automatisk.

Hvis PDF eller oppstart feiler på **Free**-plan (lite minne), oppgrader instansen i Render til **Starter** eller høyere for Chromium.

Andre leverandører (Railway, Fly, osv.) fungerer også: rot **`server/`**, start **`npm start`**, samme miljøvariabler som i **`server/.env.example`**.

### 2. Frontend (Cloudflare Pages eller annen statisk host)

Når backend-URL-en er klar:

1. I **Cloudflare Pages** (eller lokalt i **`.env.production`**): sett minst:
   ```env
   VITE_API_BASE=https://din-tjeneste.onrender.com
   ```
   Ingen `/` på slutt. Bruk **nøyaktig** https-URL-en fra Render.

2. Legg til **`VITE_SUPABASE_URL`** og **`VITE_SUPABASE_ANON_KEY`** som i `.env.local` (disse er bare for klienten og er ment å være i frontend-bygget).

3. **`OPENAI_API_KEY` skal kun settes på Render (server)** – aldri som `VITE_*` i Cloudflare; da blir nøkkelen synlig i nettleseren.

4. Bygg og deploy:
   ```bash
   npm ci
   npm run build
   ```
   Cloudflare Pages: **Build command** `npm run build`, **Output directory** `dist`, **Root** prosjektrot (der `package.json` ligger).

Uten **`VITE_API_BASE`** peker ikke den bygde appen til backend (kun lokal Vite-proxy i `npm run dev`).

Se **`.env.production.example`**.

---

*Appen lagrer **økter** (hver med teller, kartpunkter og logg) i nettleseren (`localStorage`, nøkkel `scanix-sessions-v2`). Gamle data fra `count-clicker-v1` migreres automatisk til én økt.*

**Startskjerm:** *Ny økt* åpner først valg av **vegside** (høyre, venstre eller begge sider av vegen), deretter teller og kart. *Gjenoppta økt* og *Last ned økter* fungerer som før. I en aktiv økt: **«Last ned denne økten»** eksporterer gjeldende økt (vegside står i HTML-filen). På **iPhone** brukes ofte delingsark – velg **Lagre i Filer** om du vil. **Kart** i HTML-filen trenger **Safari** (ikke bare forhåndsvisning i Filer) og **internett** til kartfliser; en **punktliste med lenker** følger med om kartet ikke vises.
