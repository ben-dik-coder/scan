/**
 * Langt trykk stemmemodus for kart-popup (registrering): lydanalyse + Web Speech API.
 */

/** @param {unknown} Ctor */
function getSpeechRecognitionCtor(Ctor) {
  return typeof Ctor === 'function' ? Ctor : null
}

/**
 * Enkel fordeling: første setning (. ? !) → tittel, resten → kommentar (append).
 * Uten skilletegn: hele teksten → kommentar (append), tittel uendret.
 * @param {string} raw
 * @param {string} [existingComment]
 * @param {number} maxTitle
 * @param {number} maxComment
 * @returns {{ label: string | null, comment: string | null }}
 */
export function splitTranscriptToLabelComment(
  raw,
  existingComment,
  maxTitle,
  maxComment,
) {
  const t = String(raw || '').trim()
  if (!t) return { label: null, comment: null }
  const ex = typeof existingComment === 'string' ? existingComment.trim() : ''
  const re = /^([\s\S]+?[.!?])(?:\s+([\s\S]*))?$/
  const m = re.exec(t)
  if (m) {
    const titlePart = (m[1] || '').trim().slice(0, maxTitle)
    let restPart = (m[2] || '').trim().slice(0, maxComment)
    if (ex && restPart) restPart = `${ex} ${restPart}`.slice(0, maxComment)
    else if (ex && !restPart) restPart = ex.slice(0, maxComment)
    return {
      label: titlePart || null,
      comment: restPart || null,
    }
  }
  const all = t.slice(0, maxComment)
  const commentOut =
    ex && all ? `${ex} ${all}`.slice(0, maxComment) : all || (ex ? ex.slice(0, maxComment) : null)
  return { label: null, comment: commentOut }
}

export function isSpeechRecognitionSupported() {
  return Boolean(
    getSpeechRecognitionCtor(
      globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition,
    ),
  )
}

/**
 * @param {HTMLElement} article .session-map-popup--click
 * @param {object} opts
 * @param {() => number} opts.getClickIndex
 * @param {(idx: number, raw: string) => void} opts.onApplyTranscript
 * @param {() => void} [opts.onCancel]
 * @param {() => void} opts.triggerHaptic
 * @param {(msg: string) => void} opts.toast
 * @param {AbortSignal} [opts.signal]
 */
export function attachClickPopupVoiceLongPress(article, opts) {
  const {
    getClickIndex,
    onApplyTranscript,
    onCancel = () => {},
    triggerHaptic,
    toast,
    signal,
  } = opts
  const ev = (base) => (signal ? { ...base, signal } : base)

  let holdTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null)
  let armed = false
  let startX = 0
  let startY = 0
  const MOVE_CANCEL_PX = 14

  const clearHold = () => {
    if (holdTimer != null) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
    armed = false
  }

  const isInteractiveTarget = (t) => {
    if (!(t instanceof Element)) return false
    return Boolean(
      t.closest(
        'button, a, input, textarea, select, [role="button"], .session-map-popup__edit-fallback',
      ),
    )
  }

  article.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return
      if (isInteractiveTarget(e.target)) return
      clearHold()
      armed = true
      startX = e.clientX
      startY = e.clientY
      holdTimer = setTimeout(() => {
        holdTimer = null
        if (!armed) return
        armed = false
        e.preventDefault()
        void runVoiceSession(article, {
          getClickIndex,
          onApplyTranscript,
          onCancel,
          triggerHaptic,
          toast,
        })
      }, 500)
    },
    ev({ passive: false }),
  )

  const cancelIfMoved = (e) => {
    if (!armed || holdTimer == null) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearHold()
  }

  article.addEventListener('pointermove', cancelIfMoved, ev({ passive: true }))
  article.addEventListener('pointerup', clearHold, ev({ passive: true }))
  article.addEventListener('pointercancel', clearHold, ev({ passive: true }))
  article.addEventListener(
    'lostpointercapture',
    clearHold,
    ev({ passive: true }),
  )
}

/**
 * @param {HTMLElement} article
 * @param {object} ctx
 */
async function runVoiceSession(article, ctx) {
  const { getClickIndex, onApplyTranscript, onCancel, triggerHaptic, toast } =
    ctx
  const idx = getClickIndex()
  if (idx < 0) return

  const Ctor = getSpeechRecognitionCtor(
    globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition,
  )
  if (!Ctor) {
    toast('Stemmegjenkjenning støttes ikke her. Bruk Rediger og tastaturets mikrofon.')
    return
  }

  const mainEl = article.querySelector('.session-map-popup__main')
  const voiceEl = article.querySelector('.session-map-popup__voice-ui')
  const waveEl = article.querySelector('.session-map-popup__voice-wave')
  const micEl = article.querySelector('.session-map-popup__voice-mic')
  const statusEl = article.querySelector('.session-map-popup__voice-status')
  const stopBtn = article.querySelector('.session-map-popup__voice-stop')
  if (!mainEl || !voiceEl || !waveEl || !micEl || !statusEl || !stopBtn) return
  if (!voiceEl.hasAttribute('hidden')) return

  triggerHaptic()
  article.classList.add('session-map-popup--voice-expanded')
  mainEl.setAttribute('hidden', '')
  voiceEl.removeAttribute('hidden')

  /** @type {MediaStream | null} */
  let mediaStream = null
  /** @type {AudioContext | null} */
  let audioCtx = null
  /** @type {AnalyserNode | null} */
  let analyser = null
  /** @type {number | null} */
  let rafId = null
  /** @type {SpeechRecognition | null} */
  let recognition = null

  const bars = []
  const BAR_COUNT = 9
  waveEl.innerHTML = ''
  for (let i = 0; i < BAR_COUNT; i++) {
    const b = document.createElement('span')
    b.className = 'session-map-popup__voice-wave-bar'
    waveEl.appendChild(b)
    bars.push(b)
  }

  let cancelled = false
  let finalized = false
  /** @type {number} */
  let lastLoudAt = 0
  let everLoud = false
  let finalTranscript = ''
  let lastInterim = ''
  let maxDurHandle = 0

  const clearMaxDur = () => {
    if (maxDurHandle) window.clearTimeout(maxDurHandle)
    maxDurHandle = 0
  }

  const setStatus = (t) => {
    if (statusEl) statusEl.textContent = t
  }

  const stopRaf = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  const stopMedia = () => {
    try {
      mediaStream?.getTracks().forEach((tr) => tr.stop())
    } catch {
      /* ignore */
    }
    mediaStream = null
    try {
      audioCtx?.close()
    } catch {
      /* ignore */
    }
    audioCtx = null
    analyser = null
  }

  const collapseUi = () => {
    article.classList.remove('session-map-popup--voice-expanded')
    mainEl.removeAttribute('hidden')
    voiceEl.setAttribute('hidden', '')
    setStatus('')
    statusEl.classList.remove('session-map-popup__voice-status--dots')
    waveEl.innerHTML = ''
    micEl.classList.remove('session-map-popup__voice-mic--hot')
  }

  /** @param {boolean} userAbort */
  const endRecognition = (userAbort) => {
    const rec = recognition
    if (!rec) return Promise.resolve()
    return new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearMaxDur()
        resolve()
      }
      rec.onend = () => finish()
      try {
        if (userAbort && typeof rec.abort === 'function') rec.abort()
        else rec.stop()
      } catch {
        finish()
      }
    })
  }

  const finishCancel = async () => {
    if (finalized) return
    finalized = true
    cancelled = true
    stopRaf()
    clearMaxDur()
    await endRecognition(true)
    recognition = null
    stopMedia()
    collapseUi()
    onCancel()
  }

  stopBtn.onclick = () => {
    void finishCancel()
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
  } catch {
    toast('Mikrofon ikke tilgjengelig.')
    collapseUi()
    return
  }

  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext
    audioCtx = new AC()
    const src = audioCtx.createMediaStreamSource(mediaStream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.65
    src.connect(analyser)
  } catch {
    toast('Kunne ikke starte lydanalyse.')
    stopMedia()
    collapseUi()
    return
  }

  const data = new Uint8Array(analyser.frequencyBinCount)
  let smoothed = 0

  const anySpeechText = () =>
    (finalTranscript + lastInterim).trim().length > 0

  const finalizeFromSilence = async () => {
    if (finalized) return
    finalized = true
    cancelled = false
    stopRaf()
    micEl.classList.remove('session-map-popup__voice-mic--hot')
    setStatus('Behandler')
    statusEl.classList.add('session-map-popup__voice-status--dots')

    await endRecognition(false)
    recognition = null
    stopMedia()

    const raw = (finalTranscript + lastInterim).trim()
    await new Promise((r) => setTimeout(r, 380))
    statusEl.classList.remove('session-map-popup__voice-status--dots')
    collapseUi()
    if (raw) onApplyTranscript(idx, raw)
    else toast('Ingen tekst gjenkjent. Prøv igjen.')
  }

  const tick = () => {
    if (cancelled || finalized || !analyser) return
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    const avg = sum / (data.length * 255)
    smoothed = smoothed * 0.72 + avg * 0.28
    const level = smoothed
    const loud = level > 0.08
    if (loud) {
      lastLoudAt = performance.now()
      everLoud = true
    }
    micEl.classList.toggle('session-map-popup__voice-mic--hot', loud)

    const h = Math.max(0.12, Math.min(1, level * 3.2))
    const mid = (BAR_COUNT - 1) / 2
    for (let i = 0; i < BAR_COUNT; i++) {
      const dist = Math.abs(i - mid) / mid
      const falloff = 1 - dist * 0.45
      const bh = 4 + h * 22 * falloff * (0.85 + Math.random() * 0.15)
      bars[i].style.height = `${bh}px`
    }

    const now = performance.now()
    if (
      everLoud &&
      anySpeechText() &&
      now - lastLoudAt > 1400
    ) {
      void finalizeFromSilence()
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  recognition = new Ctor()
  recognition.lang = 'nb-NO'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onresult = (ev) => {
    lastInterim = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const piece = ev.results[i][0].transcript
      if (ev.results[i].isFinal) finalTranscript += piece
      else lastInterim += piece
    }
  }

  recognition.onerror = (ev) => {
    if (cancelled || finalized) return
    const err = ev.error
    if (err === 'aborted') return
    if (err === 'no-speech') return
    if (err === 'not-allowed') {
      toast('Mikrofontillatelse avslått.')
      void finishCancel()
      return
    }
    console.warn('SpeechRecognition', err)
  }

  maxDurHandle = window.setTimeout(() => {
    if (!finalized) void finalizeFromSilence()
  }, 90000)

  recognition.onend = () => {
    clearMaxDur()
    if (!cancelled && !finalized) {
      void finalizeFromSilence()
    }
  }

  try {
    recognition.start()
  } catch (e) {
    console.warn('recognition.start', e)
    toast('Kunne ikke starte stemmegjenkjenning.')
    clearMaxDur()
    stopRaf()
    recognition = null
    stopMedia()
    collapseUi()
    return
  }

  lastLoudAt = performance.now()
  rafId = requestAnimationFrame(tick)
}
