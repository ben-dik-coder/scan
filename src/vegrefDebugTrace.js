/**
 * Valgfritt detaljert spor for vegref-feilsøking (localStorage).
 * Skrus på under Innstillinger → «Spill inn detaljert vegref-spor».
 */

const ENABLED_KEY = 'scanix-vegref-debug-trace-enabled'
const STORAGE_KEY = 'scanix-vegref-debug-trace-v1'
const MAX_ENTRIES = 180

function safeStr(s, max = 220) {
  if (s == null) return ''
  const t = String(s)
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

export function isVegrefDebugTraceEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

/** @param {boolean} on */
export function setVegrefDebugTraceEnabled(on) {
  try {
    if (on) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} ev
 * @param {Record<string, unknown>} [payload]
 */
export function vegrefDebugTrace(ev, payload = {}) {
  if (!isVegrefDebugTraceEnabled()) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    /** @type {Array<{ t: number, ev: string } & Record<string, unknown>>} */
    const arr = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return
    const row = {
      t: Date.now(),
      ev: safeStr(ev, 80),
      ...payload,
    }
    arr.push(row)
    while (arr.length > MAX_ENTRIES) arr.shift()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch {
    /* quota / privat modus */
  }
}

/** @returns {Array<Record<string, unknown>>} */
export function getVegrefDebugTraceEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const p = raw ? JSON.parse(raw) : []
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

export function clearVegrefDebugTrace() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  window.__scanixVegrefDebugTrace = {
    get: getVegrefDebugTraceEntries,
    clear: clearVegrefDebugTrace,
    enable: () => setVegrefDebugTraceEnabled(true),
    disable: () => setVegrefDebugTraceEnabled(false),
    log: vegrefDebugTrace,
  }
}
