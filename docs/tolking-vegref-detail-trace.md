# Tolking av kjørelogger (`vegrefDetailTrace`)

Dette dokumentet forklarer hendelsene i eksporterte `vegrefDetailTrace`-logger og hvordan de henger sammen med koden. For overordnet dataflyt på forsiden, se [vegreferanse-forsiden.md](./vegreferanse-forsiden.md).

## Kontekst

Loggene eksporteres når detaljert spor er slått på (`vegrefDetailTraceEnabled: true`). De inneholder **instrumenterte hendelser** (`ev`) som matcher kommenterte regioner i koden («H1», «H2», «H5»). Typisk beskriver de **kjøring med forsiden åpen**, med online NVDB og eventuelt offline-pakke (`offlineVegrefReady`).

## Hendelser og kodekobling

| `ev` | Betydning | Hvor i kode |
|------|-----------|-------------|
| `gps_in` | Ny GPS-fix (lat/lng, nøyaktighet, fart). | Pipeline trigges fra [`src/vegrefLive.js`](../src/vegrefLive.js) (watchPosition-løkke). |
| `fetch_split` (**H5**) | Parallell henting av **posisjon**-API og **segment**-API; `mergedOk` sier om `mergePosisjonAndSegmentParallelResults` klarte å slå sammen til ett konsistent resultat. | [`src/vegrefLive.js`](../src/vegrefLive.js) (søk etter `vegrefDebugTrace('fetch_split'`) – rundt linje 956–1012. |
| `pipeline_res` | Resultat som sendes videre til UI-lag (vei, meter, `nvdbId`, avstand til vei). | Etter merge / fallback i samme pipeline. |
| `pending_dec` (**H2**) | Beslutning når **ny** `nvdbId` fra posisjon ikke matcher det som allerede vises: skal vi **bytte segment** nå, eller vente (typisk `vls:`-fluktuasjon)? | [`src/vegrefLive.js`](../src/vegrefLive.js) – `applyNvdbNullable` (søk etter `vegrefDebugTrace('pending_dec'`): terskler `clearOnRoad`, `recoveryToPublic`, `pendingMatch`, `pendingAgedOut`, og spesialregel **`waitVlsConfirm`** når kandidat er `vls:` og kun «på vei»-kriteriet slår til. |
| `skip_meter` (**H1**) | Forsiden **viser ikke** hver eneste rå metervverdi med én gang: det finnes **snap**, **deadband** og `shouldSkipVegrefMeterDisplayUpdate` for å unngå jitter; `skipped: true` betyr «behold gammel vist meter». | [`src/main.js`](../src/main.js) (søk etter `vegrefDebugTrace('skip_meter'`) – rundt linje 5069–5123; støttefunksjoner `homeVegrefMeterSnapThreshold` / `homeVegrefMeterDeadbandM` (søk etter definisjonene). |
| `home_ui` | Det som faktisk ble sendt til **home UI** (primærnavn, `m`, `s`/`d`, `nvdbId`). | Etter apply til DOM. |

## Eksempel: KV 7100 → «Åsveien»

- Lenge med `mergedOk: false` på `fetch_split` betyr at **pos**- og **segment**-svar ikke lot seg forenes i én merge — koden faller da til `pos || seg` (se [`src/vegrefLive.js`](../src/vegrefLive.js) der `merged` settes), så du kan fortsatt få fornuftige meter, men sporingen markerer at parallelle kilder var uenige.
- `primary` kan vise **«Kommunal veg 7100»** mens `nvdbId` er `vls:…` — typisk **uvsegmentert** strekning.
- Når `mergedOk: true` og `pending_dec` har `accepted: true`, `reason: "clearOnRoad"`, med bytte fra `vls:…` til **`kf:…`** og `primary` f.eks. **«Åsveien»**, er det forventet når systemet har nok tillit (avstand til vei, fart, tier) til å låse til **segmentert** veglenke-ID.
- `skip_meter` med `delta` noen meter mellom `mInt` (pipeline) og `displayed` er **UI-demping**: skjermen henger litt bak «sann» meter for å unngå hakkete tall; `willSnap: true` ved store hopp gir hopp i visningen.

## Eksempel: EV 6 → sidevei Ankenesveien

- Start på **Europaveg 6** med høy kilometerstand og `vls:`-ID er vanlig.
- `pending_dec` som **reject** med `reason: "waitVlsConfirm"` for en `vls:`-kandidat matcher **H2**-regelen — reine `vls:`-bytt godtas ikke bare fordi du er «på vei»; systemet kan vente på ekstra bekreftelse eller timeout.
- **Accept** til `kf:…` med `clearOnRoad` og nytt stedsnavn (f.eks. **«Ankenesveien»**) ved overgang fra hovedveg til lokal veg gir ofte **stort sprang** i meter (`skip_meter` med stor `delta` og `willSnap: true`) fordi du bytter til **annen veg med egen referanse**.

## Kort konklusjon

- Loggene kan vise **tiltenkt oppførsel**: fusjon av pos/segment (**H5**), forsiktig veksling ved `vls:` (**H2**), og glattet meter på forsiden (**H1**).
- **Store sprang i vist meter** (f.eks. fra tusenmeter på riksveg til lav meter på sideveg) er **ikke nødvendigvis en feil** — de følger ofte av reelt **vegnett-skifte**.
