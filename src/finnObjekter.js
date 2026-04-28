/**
 * «Finn objekter» — meny/kart (minimal stub til full kart er på plass).
 */

/**
 * @param {AbortSignal} signal
 * @param {{ onBack?: () => void }} opts
 */
export function bindFinnObjekterListeners(signal, opts) {
  document.getElementById('btn-back-from-menu-finn-obj')?.addEventListener(
    'click',
    () => {
      opts.onBack?.()
    },
    { signal },
  )
}

export function renderFinnObjekterHtml() {
  return `<div class="view-sub surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-finn-obj">← Meny</button>
    <h2 class="subview-title">Finn objekter</h2>
    <p class="menu-info-prose">Kart og NVDB-søk kommer her. (Midlertidig visning — modulen ble gjenopprettet som stub.)</p>
    <div id="finn-objekter-map" class="surface" style="min-height:240px;border-radius:12px"></div>
  </div>`
}

export function initFinnObjekterMap() {
  /* stub: ingen Leaflet her ennå */
}

export function destroyFinnObjekterMap() {
  /* stub */
}
