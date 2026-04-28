/**
 * Valgfri lokal debug-ingest (Cursor/agent).
 * - https://localhost + Vite: POST til /ingest/... (proxy → 127.0.0.1:7877), unngår mixed content.
 * - Ellers: direkte http://127.0.0.1:7877 (f.eks. http-dev eller LAN-IP).
 * Sett VITE_SCANIX_DEBUG_INGEST=0 for å skru av.
 */
const SCANIX_DEBUG_INGEST_PATH =
  '/ingest/e58399ea-bfe1-456f-9512-3bdae1c6fc15'

function scanixDebugIngestFetchUrl() {
  try {
    const p = typeof location !== 'undefined' ? location.protocol : ''
    const h = typeof location !== 'undefined' ? location.hostname : ''
    if (
      p === 'https:' &&
      (h === 'localhost' || h === '127.0.0.1')
    ) {
      return SCANIX_DEBUG_INGEST_PATH
    }
  } catch {
    /* ignore */
  }
  return `http://127.0.0.1:7877${SCANIX_DEBUG_INGEST_PATH}`
}

export function isScanixDebugIngestAllowed() {
  try {
    if (import.meta.env?.VITE_SCANIX_DEBUG_INGEST === '0') return false
  } catch {
    /* ignore */
  }
  try {
    const p = location?.protocol
    const h = location?.hostname
    if (p === 'https:' && h !== 'localhost' && h !== '127.0.0.1') return false
  } catch {
    /* ignore */
  }
  return true
}

/**
 * POST debug payload uten `JSON.stringify` når ingest er av (typisk https i app).
 * Bruk denne i stedet for `postScanixDebugIngest(JSON.stringify(...))` på varme stier.
 * @param {Record<string, unknown>} payload
 */
export function postScanixDebugPayload(payload) {
  if (!isScanixDebugIngestAllowed()) return
  let body = ''
  try {
    body = JSON.stringify(payload)
  } catch {
    return
  }
  postScanixDebugIngest(body)
}

/**
 * @param {string} body JSON string
 */
export function postScanixDebugIngest(body) {
  try {
    if (!isScanixDebugIngestAllowed()) return
    fetch(scanixDebugIngestFetchUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'ff8b7b',
      },
      body,
    }).catch(() => {})
  } catch {
    /* fetch/URL skal aldri kaste opp til window:error */
  }
}
