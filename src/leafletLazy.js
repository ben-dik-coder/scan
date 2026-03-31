/** @type {import('leaflet').default | null} */
export let Leaflet = null

let loadPromise = null

/** Last Leaflet + CSS første gang; deretter cache. Flytter ~hundrevis av kB ut av initial parse. */
export function ensureLeaflet() {
  if (Leaflet) return Promise.resolve(Leaflet)
  if (!loadPromise) {
    loadPromise = (async () => {
      await import('leaflet/dist/leaflet.css')
      const mod = await import('leaflet')
      Leaflet = mod.default
      return Leaflet
    })()
  }
  return loadPromise
}
