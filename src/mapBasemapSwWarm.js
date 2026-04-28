/**
 * Varmer Service Worker-cache for **raster**-bakgrunn (Leaflet TileLayer): synlig rutenett
 * pluss én flis padding. Lav prioritet og begrenset antall `fetch` per runde (unngå burst).
 * MapTiler-vektor går via egne fetch-kall som allerede matches av Workbox `runtimeCaching`.
 *
 * @param {typeof import('leaflet').default} L
 * @param {import('leaflet').Map} leafletMap
 * @param {import('leaflet').TileLayer} tileLayer
 * @returns {() => void} avregistrer
 */
export function attachRasterBasemapViewportSwWarm(L, leafletMap, tileLayer) {
  if (
    !L ||
    !leafletMap ||
    !tileLayer ||
    typeof tileLayer.getTileUrl !== 'function'
  ) {
    return () => {}
  }

  const getTileSize = () => {
    const ts = tileLayer.options.tileSize
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts
    if (ts && typeof ts === 'object' && typeof ts.x === 'number') return ts.x
    return 256
  }

  let debounceId = 0

  const warmOnce = () => {
    const z = leafletMap.getZoom()
    if (!Number.isFinite(z)) return
    const b = leafletMap.getBounds()
    const nw = leafletMap.project(b.getNorthWest(), z)
    const se = leafletMap.project(b.getSouthEast(), z)
    const tileSize = getTileSize()
    let xMin = Math.floor(Math.min(nw.x, se.x) / tileSize) - 1
    let xMax = Math.floor(Math.max(nw.x, se.x) / tileSize) + 1
    let yMin = Math.floor(Math.min(nw.y, se.y) / tileSize) - 1
    let yMax = Math.floor(Math.max(nw.y, se.y) / tileSize) + 1
    const z2 = 2 ** z
    xMin = Math.max(0, xMin)
    xMax = Math.min(z2 - 1, xMax)
    yMin = Math.max(0, yMin)
    yMax = Math.min(z2 - 1, yMax)

    /** @type {string[]} */
    const urls = []
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        try {
          urls.push(tileLayer.getTileUrl({ x, y, z }))
        } catch {
          /* ignore */
        }
      }
    }
    const uniq = [...new Set(urls)]
    const MAX = 56
    const slice = uniq.slice(0, MAX)
    const BATCH = 8
    let i = 0
    const step = () => {
      const end = Math.min(i + BATCH, slice.length)
      for (; i < end; i++) {
        void fetch(slice[i], {
          mode: 'cors',
          credentials: 'omit',
          cache: 'default',
          priority: 'low',
        }).catch(() => {})
      }
      if (i < slice.length) requestAnimationFrame(step)
    }
    step()
  }

  const onRest = () => {
    window.clearTimeout(debounceId)
    debounceId = window.setTimeout(warmOnce, 750)
  }

  leafletMap.on('moveend zoomend', onRest)
  warmOnce()

  return () => {
    window.clearTimeout(debounceId)
    leafletMap.off('moveend zoomend', onRest)
  }
}
