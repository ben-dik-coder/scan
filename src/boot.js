/**
 * Tynn oppstart: global CSS først, last appen. Splash (#app-launch) fjernes i main etter forsiden er klar.
 */
import './style.css'

const MAIN_IMPORT_TIMEOUT_MS = 90_000

function showBootFailure(err) {
  console.error('Scanix: main.js kunne ikke lastes', err)
  document.getElementById('app-launch')?.remove()
  const app = document.getElementById('app')
  if (app) {
    app.innerHTML =
      '<p style="padding:1.25rem;font-family:system-ui,sans-serif;line-height:1.5;color:#fecaca;background:#1a1520;border-radius:12px;margin:1rem;">Kunne ikke starte appen. Sjekk nettverk eller oppdater siden. (Se konsoll for detaljer.)</p>'
  }
}

void Promise.race([
  import('./main.js'),
  new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            `main.js ikke ferdig etter ${MAIN_IMPORT_TIMEOUT_MS / 1000}s (sjekk nett / service worker)`,
          ),
        ),
      MAIN_IMPORT_TIMEOUT_MS,
    ),
  ),
]).catch(showBootFailure)
