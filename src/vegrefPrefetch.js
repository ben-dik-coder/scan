/**
 * Bakgrunns-prefetch av NVDB-segmenter (mobildata-besparende).
 * Minimal stub når full implementasjon mangler — appen bygger og kjører;
 * deknings-sjekk returnerer false slik at eksisterende offline-bbox brukes.
 */

/** @type {(() => boolean) | null} */
let shouldSkipPrefetchFn = null

export function abortPrefetchInFlight() {
  /* stub */
}

/**
 * @param {{
 *   persist: (segments: unknown[]) => Promise<void>
 *   onDone?: () => void
 *   shouldSkipPrefetch?: () => boolean
 * }} _cfg
 */
export function initPrefetch(_cfg) {
  shouldSkipPrefetchFn =
    typeof _cfg?.shouldSkipPrefetch === 'function' ? _cfg.shouldSkipPrefetch : null
}

export function resetPrefetch() {
  shouldSkipPrefetchFn = null
}

/**
 * @param {number} _lat
 * @param {number} _lng
 * @param {number | null} _headingForPrefetch
 * @param {number | null} _speedMps
 */
export function prefetchNotifyGps(_lat, _lng, _headingForPrefetch, _speedMps) {
  if (shouldSkipPrefetchFn?.()) return
  /* stub: ingen bakgrunnshenting */
}

/**
 * @param {number} _lat
 * @param {number} _lng
 * @returns {boolean}
 */
export function isLatLngInsidePrefetchCoverage(_lat, _lng) {
  return false
}
