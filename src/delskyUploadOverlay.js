/**
 * Fullskjerm-overlay under delsky-synk: egen sky-outline, stroke-progress, prosent, avslutningslyd.
 */

let styleInjected = false

function injectStylesOnce() {
  if (styleInjected) return
  styleInjected = true
  const s = document.createElement('style')
  s.textContent = `
.delsky-upload-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(15, 18, 24, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  font-family: system-ui, "Segoe UI", sans-serif;
  animation: delsky-upload-fade-in 0.22s ease-out;
}
@keyframes delsky-upload-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.delsky-upload-overlay--out {
  animation: delsky-upload-fade-out 0.28s ease-in forwards;
}
@keyframes delsky-upload-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
.delsky-upload-overlay__svg {
  width: min(200px, 52vw);
  height: auto;
  overflow: visible;
}
.delsky-upload-overlay__track {
  fill: none;
  stroke: rgba(148, 163, 184, 0.45);
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.delsky-upload-overlay__progress {
  fill: none;
  stroke: #38bdf8;
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.delsky-upload-overlay__pct {
  margin-top: 0.65rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: #e2e8f0;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.delsky-upload-overlay__hint {
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: #94a3b8;
  max-width: 16rem;
  text-align: center;
  line-height: 1.35;
}
`
  document.head.appendChild(s)
}

/** Egen forenklet sky (én kontinuerlig outline), ikke kopiert fra referanse. */
const CLOUD_PATH_D =
  'M 28 62 L 92 62 C 104 62 112 54 110 44 C 108 34 98 28 88 30 C 84 20 70 16 60 22 C 52 14 36 16 30 26 C 18 28 12 40 18 50 C 16 58 22 62 28 62 Z'

/**
 * @param {unknown} payload
 * @param {number} uploadQueueCount
 * @returns {number}
 */
export function estimateDelskyOverlayDurationMs(payload, uploadQueueCount) {
  let chars = 60_000
  try {
    chars = JSON.stringify(payload).length
  } catch {
    /* ignore */
  }
  const kb = chars / 1024
  const fromPayload = Math.min(12_000, Math.floor(kb / 40) * 260)
  const fromQueue = Math.max(0, uploadQueueCount) * 720
  return Math.max(1500, 1500 + fromPayload + fromQueue)
}

/**
 * Kort «swish» ved fullført opplasting (Web Audio).
 */
export function playDelskyUploadCompleteSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    const filt = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, t0)
    osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.14)
    filt.type = 'bandpass'
    filt.frequency.setValueAtTime(900, t0)
    filt.Q.setValueAtTime(0.7, t0)
    filt.frequency.exponentialRampToValueAtTime(350, t0 + 0.16)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
    osc.connect(filt)
    filt.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.22)
    void ctx.resume()
    window.setTimeout(() => {
      try {
        ctx.close()
      } catch {
        /* ignore */
      }
    }, 400)
  } catch {
    /* ignore */
  }
}

/**
 * @param {() => Promise<'skip' | void>} workFn
 * @param {number} durationMs målvarighet (min 1500 fra estimate)
 * @returns {Promise<void>}
 */
export async function runDelskySyncWithOverlay(workFn, durationMs) {
  if (typeof document === 'undefined') {
    await workFn()
    return
  }
  injectStylesOnce()

  const wrap = document.createElement('div')
  wrap.className = 'delsky-upload-overlay'
  wrap.setAttribute('role', 'dialog')
  wrap.setAttribute('aria-modal', 'true')
  wrap.setAttribute('aria-live', 'polite')
  wrap.setAttribute('aria-label', 'Sender til delsky')
  wrap.innerHTML = `
    <svg class="delsky-upload-overlay__svg" viewBox="0 0 120 80" aria-hidden="true">
      <path class="delsky-upload-overlay__track" d="${CLOUD_PATH_D}" />
      <path class="delsky-upload-overlay__progress" d="${CLOUD_PATH_D}" />
    </svg>
    <div class="delsky-upload-overlay__pct">0%</div>
    <div class="delsky-upload-overlay__hint">Sender økter og bilder til delsky …</div>
  `
  document.body.appendChild(wrap)

  const progressPath = wrap.querySelector('.delsky-upload-overlay__progress')
  const pctEl = wrap.querySelector('.delsky-upload-overlay__pct')
  if (!(progressPath instanceof SVGPathElement) || !pctEl) {
    wrap.remove()
    await workFn()
    return
  }

  const pathLen = progressPath.getTotalLength()
  progressPath.style.strokeDasharray = String(pathLen)
  progressPath.style.strokeDashoffset = String(pathLen)

  const D = Math.max(1500, durationMs)
  const tStart = performance.now()
  let workDone = false
  let workSkip = false
  let workErr = /** @type {unknown} */ (null)
  let raf = 0

  const workPromise = workFn().then(
    (r) => {
      workDone = true
      if (r === 'skip') workSkip = true
    },
    (e) => {
      workDone = true
      workErr = e
    },
  )

  const setPct = (p) => {
    const clamped = Math.max(0, Math.min(100, p))
    pctEl.textContent = `${Math.round(clamped)}%`
    const off = pathLen * (1 - clamped / 100)
    progressPath.style.strokeDashoffset = String(off)
  }

  await new Promise((resolve) => {
    const finish = () => {
      cancelAnimationFrame(raf)
      resolve(undefined)
    }

    const tick = (now) => {
      const elapsed = now - tStart
      const timeLinear = Math.min(1, elapsed / D)

      let pct
      if (!workDone) {
        pct = Math.min(92, timeLinear * 92)
      } else if (workSkip || workErr) {
        finish()
        return
      } else {
        const bump = Math.min(1, (elapsed - D * 0.35) / (D * 0.65 + 400))
        pct = 92 + Math.min(8, bump * 8 + (elapsed > D ? (elapsed - D) / 600 : 0) * 4)
        pct = Math.min(100, Math.max(92, pct))
        if (elapsed >= D * 0.5) {
          pct = Math.min(100, Math.max(pct, 92 + (elapsed - D * 0.5) / 350 * 8))
        }
        if (pct >= 99.6) pct = 100
      }

      setPct(pct)

      if (workDone && !workSkip && !workErr && pct >= 100) {
        setPct(100)
        finish()
        return
      }
      if (workDone && workSkip) {
        finish()
        return
      }
      if (workDone && workErr) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
  })

  await workPromise

  const cleanupQuiet = () => {
    wrap.classList.add('delsky-upload-overlay--out')
    window.setTimeout(() => wrap.remove(), 300)
  }

  if (workSkip) {
    cleanupQuiet()
    return
  }
  if (workErr) {
    cleanupQuiet()
    throw workErr
  }

  setPct(100)
  playDelskyUploadCompleteSound()
  window.setTimeout(cleanupQuiet, 520)
}
