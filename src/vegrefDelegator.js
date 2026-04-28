/**
 * Vegref: lokalt/offline først, valgfri NVDB-online via injisert fetch.
 */

import { resolveOfflineRoadReferenceNear } from './vegrefLocal.js'

/** @type {{ fetchOnline: (lat: number, lng: number, opts?: object) => Promise<unknown>; allowOnlineFallback: boolean }} */
let delegatorCfg = {
  fetchOnline: async () => null,
  allowOnlineFallback: true,
}

/**
 * @param {{
 *   fetchOnline: (lat: number, lng: number, opts?: object) => Promise<unknown>
 *   allowOnlineFallback?: boolean
 * }} cfg
 */
export function initDelegator(cfg) {
  delegatorCfg = {
    fetchOnline:
      typeof cfg.fetchOnline === 'function'
        ? cfg.fetchOnline
        : delegatorCfg.fetchOnline,
    allowOnlineFallback: cfg.allowOnlineFallback !== false,
  }
}

/** @param {boolean} on */
export function setDelegatorAllowOnlineFallback(on) {
  delegatorCfg.allowOnlineFallback = Boolean(on)
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {{ accuracyM?: number, allowNet?: boolean } & Record<string, unknown>} [opts]
 * @returns {Promise<{ result: unknown }>}
 */
export async function resolveVegref(lat, lng, opts = {}) {
  const allowNet =
    opts.allowNet !== false && delegatorCfg.allowOnlineFallback === true

  let offline = null
  try {
    offline = await resolveOfflineRoadReferenceNear(lat, lng, opts)
  } catch {
    offline = null
  }

  if (!allowNet) {
    return { result: offline }
  }
  if (offline) {
    return { result: offline }
  }

  try {
    const online = await delegatorCfg.fetchOnline(lat, lng, opts)
    return { result: online ?? offline }
  } catch {
    return { result: offline }
  }
}
