/**
 * Klient-side nedlasting av NVDB veglenkesekvenser/segmentert for et kartutsnitt.
 * Brukes av offline-vegnedlasting i hamburger-menyen. Samme paginering og format
 * som scripts/generate-offline-vegref-package.mjs slik at resultatene treffer
 * eksisterende offline-resolver i src/vegrefLocal.js (mergeNvdbSegmentsIntoOfflineDb).
 */

const NVDB_SEGMENTERT =
  'https://nvdbapiles.atlas.vegvesen.no/vegnett/api/v4/veglenkesekvenser/segmentert'

const DEFAULT_CLIENT = 'Scanix'
const DEFAULT_PAGE_SIZE = 400

/** Maks tid pr. enkelt HTTP-kall mot NVDB før vi avbryter (mobilnett-knekk). */
const NVDB_FETCH_TIMEOUT_MS = 15_000

/** Sikkerhetsnett mot for store nedlastinger pr. forespørsel. */
export const MAX_PAGES_PER_DOWNLOAD = 10
export const MAX_SEGMENTS_PER_DOWNLOAD = MAX_PAGES_PER_DOWNLOAD * DEFAULT_PAGE_SIZE

/**
 * Maks utstrekning på bbox (bredde/høyde i grader). Holder forespørselen til ett
 * begrenset område og dermed antall sider og minne på enheten lavt. ~0,35°
 * tilsvarer ca. 38 km i lengdegrad og ~39 km i breddegrad — nok til å dekke
 * de aller fleste veg-strekninger man vil ha med uten nett, men fortsatt
 * begrenset så NVDB ikke får hele Norge i én forespørsel.
 */
export const MAX_BBOX_DEG = 0.35

/**
 * @typedef {{ minLng: number, minLat: number, maxLng: number, maxLat: number }} Bbox
 */

/**
 * @param {Bbox} b
 */
export function formatBbox(b) {
  return `${b.minLng},${b.minLat},${b.maxLng},${b.maxLat}`
}

/**
 * @param {Bbox} b
 */
export function bboxIsValid(b) {
  if (!b || typeof b !== 'object') return false
  const { minLng, minLat, maxLng, maxLat } = b
  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return false
  }
  if (minLng >= maxLng || minLat >= maxLat) return false
  if (maxLng - minLng > MAX_BBOX_DEG) return false
  if (maxLat - minLat > MAX_BBOX_DEG) return false
  return true
}

/**
 * Utvid en bbox med ca. `km` kilometer i alle retninger. Bruker cos(lat) for
 * lengdegrad slik at radius blir rimelig på vår breddegrad.
 * @param {Bbox} b
 * @param {number} km
 * @returns {Bbox}
 */
export function expandBboxKm(b, km) {
  const dLat = km / 111
  const midLat = (b.minLat + b.maxLat) / 2
  const cosLat = Math.max(0.05, Math.cos((midLat * Math.PI) / 180))
  const dLng = km / (111 * cosLat)
  return {
    minLng: b.minLng - dLng,
    minLat: b.minLat - dLat,
    maxLng: b.maxLng + dLng,
    maxLat: b.maxLat + dLat,
  }
}

/**
 * Anslå nedlastingens størrelse meget grovt — kun for UI-veiledning, ikke for grenser.
 * @param {Bbox} b
 */
export function estimateAreaKm2(b) {
  const dLat = b.maxLat - b.minLat
  const dLng = b.maxLng - b.minLng
  const midLat = (b.minLat + b.maxLat) / 2
  const cosLat = Math.max(0.05, Math.cos((midLat * Math.PI) / 180))
  const km = (deg, scale) => Math.abs(deg) * scale
  return km(dLat, 111) * km(dLng, 111 * cosLat)
}

/**
 * Samme felt som scripts/generate-offline-vegref-package.mjs lagrer. Hold
 * formatet stabilt — resolveren i vegrefLocal/nvdbVegref leser disse direkte.
 */
function normalizeNvdbSegment(seg) {
  return {
    id: seg?.id ?? null,
    geometri:
      seg?.geometri && typeof seg.geometri === 'object'
        ? {
            wkt: typeof seg.geometri.wkt === 'string' ? seg.geometri.wkt : '',
            lengde:
              typeof seg.geometri.lengde === 'number'
                ? seg.geometri.lengde
                : null,
          }
        : { wkt: '', lengde: null },
    vegsystemreferanse:
      seg?.vegsystemreferanse && typeof seg.vegsystemreferanse === 'object'
        ? seg.vegsystemreferanse
        : null,
    adresse:
      seg?.adresse && typeof seg.adresse === 'object'
        ? { navn: typeof seg.adresse.navn === 'string' ? seg.adresse.navn : '' }
        : { navn: '' },
    typeVeg: typeof seg?.typeVeg === 'string' ? seg.typeVeg : '',
    typeVeg_sosi: typeof seg?.typeVeg_sosi === 'string' ? seg.typeVeg_sosi : '',
  }
}

/**
 * @param {string} url
 * @param {AbortSignal | undefined} signal
 */
async function fetchPage(url, signal) {
  /** @type {AbortSignal | undefined} */
  let combined = signal
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    const t = AbortSignal.timeout(NVDB_FETCH_TIMEOUT_MS)
    combined =
      signal && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([signal, t])
        : signal || t
  }
  const res = await fetch(url, {
    signal: combined,
    headers: {
      'X-Client': DEFAULT_CLIENT,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`NVDB ${res.status}`)
  }
  return res.json()
}

/**
 * Last ned alle segmenter innenfor `bbox`, paginert. Avbryter ved over-grenser
 * eller eksternt signal. Returnerer normaliserte segmenter klare for
 * mergeNvdbSegmentsIntoOfflineDb i vegrefLocal.
 *
 * @param {Bbox} bbox
 * @param {{
 *   signal?: AbortSignal,
 *   onProgress?: (info: { page: number, total: number }) => void,
 * }} [opts]
 */
export async function fetchNvdbSegmentsForBbox(bbox, opts = {}) {
  if (!bboxIsValid(bbox)) {
    throw new Error('UGYLDIG_BBOX')
  }
  const startUrl = new URL(NVDB_SEGMENTERT)
  startUrl.searchParams.set('kartutsnitt', formatBbox(bbox))
  startUrl.searchParams.set('srid', '4326')
  startUrl.searchParams.set('antall', String(DEFAULT_PAGE_SIZE))
  startUrl.searchParams.set('inkluderAntall', 'false')

  /** @type {object[]} */
  const rows = []
  const seenIds = new Set()
  let nextUrl = startUrl.toString()
  let page = 0

  while (nextUrl) {
    page += 1
    if (page > MAX_PAGES_PER_DOWNLOAD) break
    const data = await fetchPage(nextUrl, opts.signal)
    const objs = Array.isArray(data?.objekter) ? data.objekter : []
    for (const seg of objs) {
      const key =
        seg?.id != null
          ? `id:${seg.id}`
          : typeof seg?.vegsystemreferanse?.kortform === 'string'
            ? `kf:${seg.vegsystemreferanse.kortform}`
            : ''
      if (key && seenIds.has(key)) continue
      if (key) seenIds.add(key)
      rows.push(normalizeNvdbSegment(seg))
      if (rows.length >= MAX_SEGMENTS_PER_DOWNLOAD) break
    }
    if (typeof opts.onProgress === 'function') {
      opts.onProgress({ page, total: rows.length })
    }
    if (rows.length >= MAX_SEGMENTS_PER_DOWNLOAD) break
    if (!objs.length) break
    const nextHref =
      typeof data?.metadata?.neste?.href === 'string'
        ? data.metadata.neste.href
        : ''
    nextUrl = nextHref
  }

  return rows
}
