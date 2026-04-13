/**
 * Tynn oppstart: global CSS først, last appen. Splash (#app-launch) fjernes i main etter forsiden er klar.
 */
import './style.css'

const MAIN_IMPORT_TIMEOUT_MS = 90_000

const scanixDebug =
  typeof location !== 'undefined' &&
  (new URLSearchParams(location.search).has('scanixdebug') ||
    (typeof localStorage !== 'undefined' &&
      localStorage.getItem('scanix-debug') === '1'))

/** @param {string} msg */
function scanixDebugLine(msg) {
  if (!scanixDebug) return
  const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`
  console.info('[Scanix debug]', line)
  queueMicrotask(() => {
    try {
      let el = document.getElementById('scanix-debug-overlay')
      if (!el && document.body) {
        el = document.createElement('pre')
        el.id = 'scanix-debug-overlay'
        el.setAttribute(
          'style',
          'position:fixed;bottom:0;left:0;right:0;max-height:28vh;overflow:auto;z-index:2147483647;background:rgba(0,0,0,.88);color:#7dff9a;font:11px/1.35 ui-monospace,monospace;padding:8px;white-space:pre-wrap;pointer-events:none;margin:0',
        )
        document.body.appendChild(el)
      }
      if (el) el.textContent += `${line}\n`
    } catch {
      /* ignore */
    }
  })
}

let reportedBootFailure = false
function showBootFailure(err) {
  if (reportedBootFailure) return
  reportedBootFailure = true
  const detail =
    err && typeof err === 'object' && 'message' in err
      ? String(/** @type {{ message?: unknown }} */ (err).message)
      : String(err)
  console.error('Scanix: main.js kunne ikke lastes', err)
  scanixDebugLine(`FEIL: ${detail}`)
  document.getElementById('app-launch')?.remove()
  const app = document.getElementById('app')
  if (app) {
    app.innerHTML =
      `<p style="padding:1.25rem;font-family:system-ui,sans-serif;line-height:1.5;color:#fecaca;background:#1a1520;border-radius:12px;margin:1rem;">Kunne ikke starte appen. Sjekk nettverk eller oppdater siden. (Se konsoll for detaljer.)${scanixDebug ? `<br><br><small style="opacity:.85">${detail.slice(0, 500)}</small>` : ''}</p>`
  }
}

function shouldReportEarlyError() {
  const app = document.getElementById('app')
  const launch = document.getElementById('app-launch')
  const empty = !app?.innerHTML?.trim()
  return Boolean(launch || empty)
}

window.addEventListener(
  'error',
  (ev) => {
    if (!shouldReportEarlyError()) return
    showBootFailure(ev.error || new Error(ev.message))
  },
  true,
)

window.addEventListener('unhandledrejection', (ev) => {
  if (!shouldReportEarlyError()) return
  const r = ev.reason
  showBootFailure(r instanceof Error ? r : new Error(String(r)))
})

scanixDebugLine('boot: css ok, starter main.js …')

void Promise.race([
  import('./main.js').then(() => {
    scanixDebugLine('boot: main.js modul lastet')
  }),
  new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            `main.js ferdig ikke innen ${MAIN_IMPORT_TIMEOUT_MS / 1000}s (ofte hengende nettverkskall i oppstart)`,
          ),
        ),
      MAIN_IMPORT_TIMEOUT_MS,
    ),
  ),
]).catch(showBootFailure)
