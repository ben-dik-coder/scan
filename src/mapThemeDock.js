import {
  getSessionMapDarkPreference,
  setSessionMapDarkPreference,
} from './sessionMapBasemapPref.js'

/** v2: standard øverst til høyre under header (v1 under bunnark). */
export const SESSION_MAP_THEME_DOT_POS_KEY = 'scanix-session-map-theme-dot-pos-v2'

export const ADV_REG_MAP_THEME_DOT_POS_KEY = 'scanix-adv-reg-map-theme-dot-pos-v1'

/** @param {boolean} on */
export function syncMapThemeDockDom(on) {
  const light = document.getElementById('session-map-theme-opt-light')
  const dark = document.getElementById('session-map-theme-opt-dark')
  const dot = document.getElementById('session-map-theme-dot')
  if (light) {
    light.setAttribute('aria-checked', on ? 'false' : 'true')
    light.classList.toggle('session-map-theme-popover__opt--active', !on)
  }
  if (dark) {
    dark.setAttribute('aria-checked', on ? 'true' : 'false')
    dark.classList.toggle('session-map-theme-popover__opt--active', on)
  }
  if (dot) {
    dot.classList.toggle('session-map-theme-dot--dark', on)
    dot.setAttribute(
      'aria-label',
      on ? 'Kartunderlag: mørkt. Trykk for å bytte.' : 'Kartunderlag: lyst. Trykk for å bytte.',
    )
    dot.title = on ? 'Mørkt kart' : 'Lyst kart'
  }
}

/**
 * @param {string} frameId
 * @param {string} posKey
 */
export function applyMapThemeDockPosition(frameId, posKey) {
  const frame = document.getElementById(frameId)
  const dock = document.getElementById('session-map-theme-dock')
  if (!frame || !dock) return
  try {
    const raw = localStorage.getItem(posKey)
    if (!raw) return
    const p = JSON.parse(raw)
    if (typeof p.leftPct === 'number' && typeof p.topPct === 'number') {
      dock.style.left = `${p.leftPct}%`
      dock.style.top = `${p.topPct}%`
      dock.style.right = 'auto'
      dock.style.bottom = 'auto'
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} posKey
 * @param {number} leftPct
 * @param {number} topPct
 */
export function saveMapThemeDockPosition(posKey, leftPct, topPct) {
  try {
    localStorage.setItem(posKey, JSON.stringify({ leftPct, topPct }))
  } catch {
    /* ignore */
  }
}

/**
 * @param {AbortSignal} signal
 * @param {{
 *   frameId: string
 *   posKey: string
 *   onAfterThemeChange?: () => void | Promise<void>
 * }} opts
 */
export function wireMapThemeDock(signal, opts) {
  const { frameId, posKey, onAfterThemeChange } = opts
  const frame = document.getElementById(frameId)
  const dock = document.getElementById('session-map-theme-dock')
  const dot = document.getElementById('session-map-theme-dot')
  const popover = document.getElementById('session-map-theme-popover')
  const optLight = document.getElementById('session-map-theme-opt-light')
  const optDark = document.getElementById('session-map-theme-opt-dark')
  if (!frame || !dock || !dot || !popover || !optLight || !optDark) return

  applyMapThemeDockPosition(frameId, posKey)

  let closePopoverTimer = 0

  function closePopover() {
    if (popover.hidden) return
    popover.classList.remove('session-map-theme-popover--visible')
    dot.setAttribute('aria-expanded', 'false')
    if (closePopoverTimer) window.clearTimeout(closePopoverTimer)
    closePopoverTimer = window.setTimeout(() => {
      closePopoverTimer = 0
      popover.hidden = true
    }, 200)
  }

  function openPopover() {
    if (closePopoverTimer) {
      window.clearTimeout(closePopoverTimer)
      closePopoverTimer = 0
    }
    popover.hidden = false
    dot.setAttribute('aria-expanded', 'true')
    requestAnimationFrame(() => {
      popover.classList.add('session-map-theme-popover--visible')
    })
  }

  function togglePopover() {
    if (popover.hidden) openPopover()
    else closePopover()
  }

  function applyThemeChoice(wantDark) {
    setSessionMapDarkPreference(wantDark)
    syncMapThemeDockDom(getSessionMapDarkPreference())
    void Promise.resolve(onAfterThemeChange?.()).catch(() => {})
    closePopover()
  }

  document.addEventListener(
    'pointerdown',
    (ev) => {
      if (popover.hidden) return
      const t = ev.target
      if (!(t instanceof Node)) return
      if (dock.contains(t)) return
      closePopover()
    },
    { capture: true, signal },
  )

  document.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key !== 'Escape') return
      if (popover.hidden) return
      closePopover()
    },
    { signal },
  )

  let drag = null
  let themeDragMoved = false

  dot.addEventListener(
    'pointerdown',
    (ev) => {
      if (ev.button !== 0) return
      drag = {
        id: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        origLeft: dock.offsetLeft,
        origTop: dock.offsetTop,
      }
      themeDragMoved = false
      try {
        dot.setPointerCapture(ev.pointerId)
      } catch {
        /* ignore */
      }
    },
    { signal },
  )

  dot.addEventListener(
    'pointermove',
    (ev) => {
      if (!drag || ev.pointerId !== drag.id) return
      const dx = ev.clientX - drag.startX
      const dy = ev.clientY - drag.startY
      if (Math.abs(dx) + Math.abs(dy) > 6) themeDragMoved = true
      const pad = 6
      let nl = drag.origLeft + dx
      let nt = drag.origTop + dy
      const maxL = frame.clientWidth - dock.offsetWidth - pad
      const maxT = frame.clientHeight - dock.offsetHeight - pad
      nl = Math.max(pad, Math.min(maxL, nl))
      nt = Math.max(pad, Math.min(maxT, nt))
      dock.style.left = `${nl}px`
      dock.style.top = `${nt}px`
      dock.style.right = 'auto'
      dock.style.bottom = 'auto'
    },
    { signal },
  )

  const endDrag = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return
    drag = null
    try {
      dot.releasePointerCapture(ev.pointerId)
    } catch {
      /* ignore */
    }
    const fr = frame.getBoundingClientRect()
    const dr = dock.getBoundingClientRect()
    if (fr.width > 0 && fr.height > 0) {
      const leftPct = ((dr.left - fr.left) / fr.width) * 100
      const topPct = ((dr.top - fr.top) / fr.height) * 100
      saveMapThemeDockPosition(posKey, leftPct, topPct)
    }
  }
  dot.addEventListener('pointerup', endDrag, { signal })
  dot.addEventListener('pointercancel', endDrag, { signal })

  dot.addEventListener(
    'click',
    (ev) => {
      if (themeDragMoved) {
        ev.preventDefault()
        ev.stopPropagation()
      }
    },
    true,
  )

  dot.addEventListener(
    'click',
    (ev) => {
      if (themeDragMoved) return
      ev.preventDefault()
      togglePopover()
    },
    { signal },
  )

  optLight.addEventListener('click', () => applyThemeChoice(false), {
    signal,
  })
  optDark.addEventListener('click', () => applyThemeChoice(true), { signal })
}
