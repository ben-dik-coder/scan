/**
 * Produksjon: bygg med VITE_API_BASE=https://din-backend.tld (ingen / på slutt).
 * Lokalt: tom → /api/... går via Vite-proxy til server på 8787.
 */
export function apiUrl(path) {
  const raw = import.meta.env.VITE_API_BASE
  const base = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : ''
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}

/**
 * Forklaring når API gir 404 (lokal dev vs deploy uten/korrekt backend-URL).
 */
export function hintApiNotFound() {
  if (import.meta.env.DEV) {
    return ' Backend kjører ikke: start «node server.js» i mappen server (port 8787) samtidig som npm run dev.'
  }
  const v = import.meta.env.VITE_API_BASE
  const hasBase = typeof v === 'string' && v.trim().length > 0
  if (!hasBase) {
    return ' Du har deployet uten API-adresse: lag filen .env.production med VITE_API_BASE=https://din-backend (Render/Railway osv.), kjør npm run build, last opp dist på nytt.'
  }
  return ' Sjekk at backend kjører i skyen og at VITE_API_BASE i bygget er nøyaktig den https-URL-en (bygg på nytt etter endring).'
}
