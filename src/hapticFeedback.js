/**
 * Haptikk-profiler (nettleser: vibrasjon der støttet).
 */

const LS_ENABLED = 'scanix-haptic-enabled'
const LS_PROFILE = 'scanix-haptic-profile-id'

/** @type {{ id: string, label: string, hint: string, pattern: number | number[] }[]} */
export const HAPTIC_PROFILES = [
  { id: 'p1', label: 'Kort', hint: 'Ett lite tap', pattern: 12 },
  { id: 'p2', label: 'Dobbelt', hint: 'To raske', pattern: [10, 40, 14] },
  { id: 'p3', label: 'Trippel', hint: 'Tre små', pattern: [8, 30, 8, 30, 8] },
  { id: 'p4', label: 'Lang', hint: 'Ett trykk ~90 ms', pattern: 90 },
  { id: 'p5', label: 'Staccato', hint: 'Rask serie', pattern: [12, 20, 12, 20, 12] },
  { id: 'p6', label: 'Myk', hint: 'Sakte inn/ut', pattern: [20, 60, 30] },
  { id: 'p7', label: 'Skarp', hint: 'Sterk kontrast', pattern: [6, 50, 20, 50, 6] },
  { id: 'p8', label: 'Registrer-feel', hint: 'Ligner teller', pattern: [18, 25, 35] },
  { id: 'p9', label: 'Kamera-feel', hint: 'Lukker-klikk', pattern: [8, 16, 8, 40, 22] },
  { id: 'p10', label: 'Minimal', hint: 'Nesten stille', pattern: 6 },
]

/** @returns {boolean} */
export function readHapticEnabled() {
  try {
    if (typeof localStorage === 'undefined') return true
    return localStorage.getItem(LS_ENABLED) !== '0'
  } catch {
    return true
  }
}

/** @param {boolean} on */
export function writeHapticEnabled(on) {
  try {
    if (typeof localStorage === 'undefined') return
    if (on) localStorage.removeItem(LS_ENABLED)
    else localStorage.setItem(LS_ENABLED, '0')
  } catch {
    /* ignore */
  }
}

/** @returns {string} */
export function readHapticProfileId() {
  try {
    if (typeof localStorage === 'undefined') return 'p2'
    const v = localStorage.getItem(LS_PROFILE)
    if (v && HAPTIC_PROFILES.some((p) => p.id === v)) return v
  } catch {
    /* ignore */
  }
  return 'p2'
}

/** @param {string} id */
export function writeHapticProfileId(id) {
  try {
    if (typeof localStorage === 'undefined') return
    if (HAPTIC_PROFILES.some((p) => p.id === id))
      localStorage.setItem(LS_PROFILE, id)
  } catch {
    /* ignore */
  }
}

/** @returns {number | number[] | null} */
function patternForProfileId(id) {
  const p = HAPTIC_PROFILES.find((x) => x.id === id)
  return p ? p.pattern : [12, 30, 12]
}

/** @returns {Promise<void>} */
export async function previewHapticFeedback() {
  if (!readHapticEnabled()) return
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(patternForProfileId(readHapticProfileId()))
    }
  } catch {
    /* ignore */
  }
}

export function triggerHapticMark() {
  void previewHapticFeedback()
}

export function triggerHapticPhoto() {
  void previewHapticFeedback()
}
