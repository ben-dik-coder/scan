/**
 * Henter statisk kartbilde (OpenStreetMap via staticmap.openstreetmap.de) som data-URL.
 * Ingen API-nøkkel; egnet for server-side PDF. Begrens antall markører for URL-lengde.
 */

const MAX_MARKERS = 24
const MAX_DIM = 1024

/**
 * @param {Array<{ lat?: unknown, lng?: unknown }>} points
 * @param {{ width?: number, height?: number }} [opts]
 * @returns {Promise<string | null>} data:image/png;base64,... eller null
 */
export async function fetchStaticMapAsDataUrl(points, opts = {}) {
  const width = Math.min(opts.width ?? 1024, MAX_DIM)
  const height = Math.min(opts.height ?? 576, MAX_DIM)
  const valid = points
    .filter(
      (p) =>
        p &&
        p.lat != null &&
        p.lng != null &&
        !Number.isNaN(Number(p.lat)) &&
        !Number.isNaN(Number(p.lng)),
    )
    .slice(0, MAX_MARKERS)
    .map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
    }))

  if (!valid.length) return null

  const lats = valid.map((p) => p.lat)
  const lngs = valid.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2
  const dLat = Math.max(maxLat - minLat, 0.0004)
  const dLng = Math.max(maxLng - minLng, 0.0004)
  const latRad = (centerLat * Math.PI) / 180
  const spanM = Math.max(
    dLat * 111_320,
    dLng * 111_320 * Math.cos(latRad || 0.001),
  )
  /** Zoom 10–17 ut fra utstrekning (meter) */
  let zoom = 14
  if (spanM < 120) zoom = 17
  else if (spanM < 350) zoom = 16
  else if (spanM < 900) zoom = 15
  else if (spanM < 2500) zoom = 14
  else if (spanM < 8000) zoom = 13
  else if (spanM < 25000) zoom = 12
  else zoom = 11

  const markerParams = valid
    .map(
      (p) =>
        `markers=${encodeURIComponent(`${p.lat.toFixed(5)},${p.lng.toFixed(5)},red-pushpin`)}`,
    )
    .join('&')

  const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${encodeURIComponent(`${centerLat},${centerLng}`)}&zoom=${zoom}&size=${width}x${height}&maptype=mapnik&${markerParams}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ScanixPDF/1.0 (contact: local)' },
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 200) return null
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
