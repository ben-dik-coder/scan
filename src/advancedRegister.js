/**
 * Avansert registering – egen flyt (intro → kartøkt → rapport).
 * Rører ikke eksisterende økt-/state i main.js utover navigasjon og hurtigmeny-krok.
 */

import { ensureLeaflet, createAppMapTileLayer } from './leafletLazy.js'

const MAX_ACCURACY_M = 8
/** @type {{ navigate: (view: string) => void } | null} */
let app = null

/**
 * @param {{ navigate: (view: string) => void }} cfg
 */
export function configureAdvancedRegister(cfg) {
  app = cfg
}

function nav(to) {
  app?.navigate(to)
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** @typedef {{ id: string, lat: number, lng: number, accuracy: number, timestamp: string, comment: string | null, photoDataUrl: string | null }} AdvMarker */

/**
 * @type {{
 *   topic: string
 *   startedAt: string | null
 *   markers: AdvMarker[]
 * }}
 */
export const advRegState = {
  topic: '',
  startedAt: null,
  markers: [],
}

export function resetAdvancedRegisterState() {
  advRegState.topic = ''
  advRegState.startedAt = null
  advRegState.markers = []
}

/** @type {import('leaflet').Map | null} */
let advMap = null
/** @type {import('leaflet').LayerGroup | null} */
let advMarkersLayer = null
/** @type {import('leaflet').Marker | null} */
let advUserMarker = null
let advWatchId = null

function stopAdvWatch() {
  if (advWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(advWatchId)
    advWatchId = null
  }
}

function destroyAdvMap() {
  stopAdvWatch()
  if (advMap) {
    advMap.remove()
    advMap = null
  }
  advMarkersLayer = null
  advUserMarker = null
}

/** Etter at appen har vært i bakgrunn (mobil): kart trenger ofte invalidateSize. */
export function invalidateAdvRegMapSize() {
  try {
    advMap?.invalidateSize({ animate: false })
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Promise<{ lat: number, lng: number, accuracy: number }>}
 */
function getFreshGpsForAdv() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Ingen geolokasjon'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        resolve({
          lat: latitude,
          lng: longitude,
          accuracy:
            typeof accuracy === 'number' && !Number.isNaN(accuracy)
              ? accuracy
              : 25,
        })
      },
      (err) => reject(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 14000 },
    )
  })
}

export function renderAdvancedRegisterIntroHtml() {
  const t = escapeHtml(advRegState.topic)
  return `<div class="adv-reg adv-reg--intro surface">
    <header class="adv-reg__header">
      <button type="button" class="btn btn-text adv-reg__back" id="adv-reg-intro-back">← Tilbake</button>
      <h1 class="adv-reg__title">Avansert registering</h1>
    </header>
    <div class="adv-reg__body">
      <label class="adv-reg__label" for="adv-reg-topic">Hva registrerer du?</label>
      <p class="adv-reg__hint">Beskriv kort hva økten handler om (f.eks. «Inspeksjon strekning 12», «Skilt ved kryss»).</p>
      <textarea id="adv-reg-topic" class="adv-reg__textarea" rows="4" maxlength="2000" placeholder="Skriv her …">${t}</textarea>
      <p id="adv-reg-intro-status" class="adv-reg__status" role="status" aria-live="polite"></p>
      <button type="button" class="btn btn-home btn-home--primary adv-reg__cta" id="adv-reg-start">Start økt</button>
    </div>
  </div>`
}

export function renderAdvancedRegisterSessionHtml() {
  return `<div class="adv-reg adv-reg--session">
    <div id="adv-reg-map" class="adv-reg__map" role="application" aria-label="Kart"></div>
    <p id="adv-reg-gps-chip" class="adv-reg__gps-chip" role="status"></p>
    <div class="adv-reg__bottom">
      <div class="adv-reg__bottom-inner">
        <p class="adv-reg__topic-line" id="adv-reg-topic-line"></p>
        <div class="adv-reg__actions">
          <button type="button" class="btn btn-plus adv-reg__btn-reg" id="adv-reg-btn-register" aria-label="Registrer punkt">
            <span class="btn-plus__inner"><span class="btn-plus__line">Registrer</span></span>
          </button>
        </div>
        <div class="adv-reg__secondary">
          <button type="button" class="btn btn-minus btn-ghost-action" id="adv-reg-btn-undo">Angre siste</button>
          <button type="button" class="btn btn-reset btn-ghost-action" id="adv-reg-btn-reset">Nullstill alle</button>
        </div>
        <button type="button" class="btn btn-secondary adv-reg__finish" id="adv-reg-btn-finish">Avslutt økt</button>
      </div>
    </div>
    <dialog id="adv-reg-followup" class="adv-reg-dialog" aria-labelledby="adv-reg-followup-title">
      <div class="adv-reg-dialog__box">
        <h2 id="adv-reg-followup-title" class="adv-reg-dialog__title">Punkt lagt til</h2>
        <p class="adv-reg-dialog__lead">Vil du legge igjen en kommentar på dette punktet?</p>
        <div class="adv-reg-dialog__row">
          <button type="button" class="btn btn-secondary" id="adv-reg-skip-comment">Nei, hopp over</button>
          <button type="button" class="btn btn-home btn-home--primary" id="adv-reg-add-comment">Ja, skriv kommentar</button>
        </div>
        <div id="adv-reg-comment-wrap" class="adv-reg-dialog__comment-wrap" hidden>
          <label class="adv-reg__label" for="adv-reg-comment-ta">Kommentar</label>
          <textarea id="adv-reg-comment-ta" class="adv-reg__textarea" rows="3" maxlength="4000" placeholder="Valgfritt …"></textarea>
          <button type="button" class="btn btn-home btn-home--primary" id="adv-reg-save-comment">Lagre kommentar</button>
        </div>
        <hr class="adv-reg-dialog__hr" />
        <p class="adv-reg-dialog__lead">Bilde til dette punktet? (Uavhengig av kommentar.)</p>
        <div class="adv-reg-dialog__row">
          <button type="button" class="btn btn-secondary" id="adv-reg-skip-photo">Ingen bilde</button>
          <button type="button" class="btn btn-home btn-home--primary" id="adv-reg-take-photo">Ta bilde</button>
        </div>
        <input type="file" id="adv-reg-photo-input" class="visually-hidden" accept="image/*" capture="environment" tabindex="-1" aria-hidden="true" />
        <p id="adv-reg-followup-status" class="adv-reg__status" role="status"></p>
        <button type="button" class="btn btn-home btn-home--primary adv-reg-dialog__done" id="adv-reg-followup-done">Ferdig med punkt</button>
      </div>
    </dialog>
  </div>`
}

/**
 * @param {AdvMarker[]} markers
 */
function buildReportSummaryHtml(markers) {
  const topic = escapeHtml(advRegState.topic || '(uten tittel)')
  const started = advRegState.startedAt
    ? new Date(advRegState.startedAt).toLocaleString('nb-NO')
    : '–'
  const rows = markers
    .map((m, i) => {
      const com = m.comment
        ? escapeHtml(m.comment).replace(/\n/g, '<br/>')
        : '<em>Ingen kommentar</em>'
      const ph = m.photoDataUrl
        ? `<img src="${escapeHtml(m.photoDataUrl)}" alt="" class="adv-reg-report__thumb" />`
        : '<span class="adv-reg-report__muted">Ingen bilde</span>'
      return `<tr>
        <td>${i + 1}</td>
        <td>${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</td>
        <td>±${Math.round(m.accuracy)} m</td>
        <td class="adv-reg-report__cell-comment">${com}</td>
        <td class="adv-reg-report__cell-photo">${ph}</td>
      </tr>`
    })
    .join('')
  return `
    <section class="adv-reg-report__block">
      <h2 class="adv-reg-report__h">Oppsummering</h2>
      <dl class="adv-reg-report__dl">
        <div><dt>Beskrivelse av økt</dt><dd>${topic}</dd></div>
        <div><dt>Startet</dt><dd>${escapeHtml(started)}</dd></div>
        <div><dt>Antall punkter</dt><dd>${markers.length}</dd></div>
      </dl>
    </section>
    <section class="adv-reg-report__block">
      <h2 class="adv-reg-report__h">Detaljer per punkt</h2>
      <div class="adv-reg-report__table-wrap">
        <table class="adv-reg-report__table">
          <thead><tr><th>#</th><th>Posisjon</th><th>Nøyaktighet</th><th>Kommentar</th><th>Bilde</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Ingen punkter</td></tr>'}</tbody>
        </table>
      </div>
    </section>`
}

export function renderAdvancedRegisterReportHtml() {
  const markers = advRegState.markers
  const inner = buildReportSummaryHtml(markers)
  return `<div class="adv-reg adv-reg--report surface">
    <header class="adv-reg__header">
      <button type="button" class="btn btn-text adv-reg__back" id="adv-reg-report-back">← Tilbake til oppdrag</button>
      <h1 class="adv-reg__title">Rapport · avansert registering</h1>
    </header>
    <div class="adv-reg-report">
      ${inner}
      <div class="adv-reg-report__actions">
        <button type="button" class="btn btn-secondary" id="adv-reg-save-json">Lagre som fil (JSON)</button>
        <button type="button" class="btn btn-home btn-home--primary" id="adv-reg-gen-pdf">Generer PDF</button>
        <button type="button" class="btn btn-home btn-home--primary" id="adv-reg-send-mail">Send på e-post</button>
      </div>
      <p id="adv-reg-report-status" class="adv-reg__status" role="status"></p>
    </div>
  </div>`
}

/**
 * @param {AdvMarker} m
 * @param {number} index
 */
function markerPopupHtml(m, index) {
  const com = m.comment
    ? escapeHtml(m.comment).replace(/\n/g, '<br/>')
    : '<span class="adv-reg-popup__muted">Ingen kommentar</span>'
  const img = m.photoDataUrl
    ? `<div class="adv-reg-popup__img-wrap"><img src="${escapeHtml(m.photoDataUrl)}" alt="" class="adv-reg-popup__img" /></div>`
    : ''
  return `<div class="adv-reg-popup">
    <strong>Punkt ${index + 1}</strong>
    <p class="adv-reg-popup__coords">${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</p>
    <div class="adv-reg-popup__comment">${com}</div>
    ${img}
    <button type="button" class="btn btn-secondary adv-reg-popup__del" data-adv-delete="${escapeHtml(m.id)}">Slett punkt</button>
  </div>`
}

async function refreshAdvMarkersLayerAsync() {
  const L = await ensureLeaflet()
  if (!advMarkersLayer || !advMap) return
  advMarkersLayer.clearLayers()
  advRegState.markers.forEach((m, i) => {
    const mk = L.marker([m.lat, m.lng], { title: `Punkt ${i + 1}` })
    mk.bindPopup(markerPopupHtml(m, i), { maxWidth: 280 })
    mk.on('popupopen', () => {
      const el = mk.getPopup()?.getElement()
      const btn = el?.querySelector('[data-adv-delete]')
      btn?.addEventListener(
        'click',
        () => {
          advRegState.markers = advRegState.markers.filter((x) => x.id !== m.id)
          mk.closePopup()
          void refreshAdvMarkersLayerAsync()
        },
        { once: true },
      )
    })
    mk.addTo(/** @type {import('leaflet').LayerGroup} */ (advMarkersLayer))
  })
}

/** @type {string | null} */
let pendingMarkerId = null

async function shareOrDownloadPdfBlob(blob, filename) {
  const file = new File([blob], filename, { type: 'application/pdf' })
  let canShareFiles = false
  try {
    canShareFiles = Boolean(
      navigator.canShare && navigator.canShare({ files: [file] }),
    )
  } catch {
    canShareFiles = false
  }
  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
      })
      return
    } catch (e) {
      if (e && /** @type {{ name?: string }} */ (e).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function buildAdvRegPdfBlob() {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  let y = margin
  doc.setFontSize(16)
  doc.text('Avansert registering – rapport', margin, y)
  y += 10
  doc.setFontSize(10)
  doc.text(`Beskrivelse: ${advRegState.topic || '–'}`, margin, y)
  y += 6
  doc.text(
    `Start: ${advRegState.startedAt ? new Date(advRegState.startedAt).toLocaleString('nb-NO') : '–'}`,
    margin,
    y,
  )
  y += 6
  doc.text(`Antall punkter: ${advRegState.markers.length}`, margin, y)
  y += 10

  advRegState.markers.forEach((m, i) => {
    if (y > 270) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.text(`Punkt ${i + 1}`, margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Koordinater: ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)} (±${Math.round(m.accuracy)} m)`,
      margin,
      y,
    )
    y += 5
    if (m.comment) {
      const lines = doc.splitTextToSize(`Kommentar: ${m.comment}`, 180)
      doc.text(lines, margin, y)
      y += lines.length * 5 + 2
    }
    if (m.photoDataUrl && m.photoDataUrl.startsWith('data:image')) {
      try {
        const fmt = /data:image\/png/i.test(m.photoDataUrl) ? 'PNG' : 'JPEG'
        doc.addImage(m.photoDataUrl, fmt, margin, y, 50, 38)
        y += 42
      } catch {
        doc.text('(Kunne ikke legge inn bilde)', margin, y)
        y += 6
      }
    }
    y += 4
  })

  const blob = doc.output('blob')
  return blob
}

function downloadJson() {
  const payload = {
    type: 'scanix-advanced-register',
    version: 1,
    topic: advRegState.topic,
    startedAt: advRegState.startedAt,
    exportedAt: new Date().toISOString(),
    markers: advRegState.markers,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `avansert-registrering-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function mailtoReport() {
  const sub = encodeURIComponent(
    `Avansert registering: ${advRegState.topic || 'rapport'}`,
  )
  const lines = [
    `Beskrivelse: ${advRegState.topic}`,
    `Start: ${advRegState.startedAt || '–'}`,
    `Antall punkter: ${advRegState.markers.length}`,
    '',
    ...advRegState.markers.map((m, i) =>
      [
        `Punkt ${i + 1}: ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)} (±${Math.round(m.accuracy)} m)`,
        m.comment ? `  Kommentar: ${m.comment}` : '  (ingen kommentar)',
        m.photoDataUrl ? '  (bilde vedlagt i app/PDF)' : '  (ingen bilde)',
      ].join('\n'),
    ),
  ]
  const body = encodeURIComponent(lines.join('\n'))
  window.location.href = `mailto:?subject=${sub}&body=${body}`
}

/**
 * @param {'advRegIntro' | 'advRegSession' | 'advRegReport'} currentView
 * @param {AbortSignal} signal
 */
export function bindAdvancedRegister(currentView, signal) {
  if (currentView === 'advRegIntro') {
    document.getElementById('adv-reg-intro-back')?.addEventListener(
      'click',
      () => nav('session'),
      { signal },
    )
    document.getElementById('adv-reg-start')?.addEventListener(
      'click',
      () => {
        const ta = /** @type {HTMLTextAreaElement | null} */ (
          document.getElementById('adv-reg-topic')
        )
        const st = document.getElementById('adv-reg-intro-status')
        const raw = ta?.value?.trim() ?? ''
        if (!raw) {
          if (st) st.textContent = 'Skriv inn hva du registrerer.'
          return
        }
        advRegState.topic = raw
        advRegState.startedAt = new Date().toISOString()
        advRegState.markers = []
        if (st) st.textContent = ''
        nav('advRegSession')
      },
      { signal },
    )
    return
  }

  if (currentView === 'advRegReport') {
    document.getElementById('adv-reg-report-back')?.addEventListener(
      'click',
      () => {
        resetAdvancedRegisterState()
        nav('session')
      },
      { signal },
    )
    document.getElementById('adv-reg-save-json')?.addEventListener(
      'click',
      () => downloadJson(),
      { signal },
    )
    document.getElementById('adv-reg-gen-pdf')?.addEventListener(
      'click',
      async () => {
        const st = document.getElementById('adv-reg-report-status')
        if (st) st.textContent = 'Genererer PDF …'
        try {
          const blob = await buildAdvRegPdfBlob()
          await shareOrDownloadPdfBlob(
            blob,
            `avansert-registrering-${Date.now()}.pdf`,
          )
          if (st) st.textContent = 'PDF klar (delt eller lastet ned).'
        } catch (e) {
          if (st) st.textContent = 'Kunne ikke lage PDF.'
          console.error(e)
        }
      },
      { signal },
    )
    document.getElementById('adv-reg-send-mail')?.addEventListener(
      'click',
      () => {
        mailtoReport()
        const st = document.getElementById('adv-reg-report-status')
        if (st) st.textContent = 'Åpnet e-postprogram med utkast.'
      },
      { signal },
    )
    return
  }

  if (currentView !== 'advRegSession') return

  const topicLine = document.getElementById('adv-reg-topic-line')
  if (topicLine) {
    topicLine.textContent = advRegState.topic
  }

  const gpsEl = document.getElementById('adv-reg-gps-chip')

  void (async () => {
    const L = await ensureLeaflet()
    const el = document.getElementById('adv-reg-map')
    if (!el) return
    destroyAdvMap()
    advMap = L.map('adv-reg-map', { zoomControl: true }).setView(
      [65.5, 12.5],
      5,
    )
    createAppMapTileLayer(L).addTo(advMap)
    advMarkersLayer = L.layerGroup().addTo(advMap)

    advWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        if (!advMap) return
        if (!advUserMarker) {
          advUserMarker = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#38bdf8',
            fillColor: '#0ea5e9',
            fillOpacity: 0.85,
          }).addTo(advMap)
        } else {
          advUserMarker.setLatLng([latitude, longitude])
        }
        if (gpsEl) {
          gpsEl.textContent = `GPS ±${Math.round(accuracy)} m`
        }
      },
      () => {
        if (gpsEl) gpsEl.textContent = 'GPS utilgjengelig'
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )

    try {
      const p = await getFreshGpsForAdv()
      advMap.setView([p.lat, p.lng], 15)
    } catch {
      if (advRegState.markers.length) {
        const m = advRegState.markers[0]
        advMap.setView([m.lat, m.lng], 15)
      }
    }

    await refreshAdvMarkersLayerAsync()
    queueMicrotask(() => advMap?.invalidateSize())
    window.setTimeout(() => advMap?.invalidateSize(), 400)
  })()

  const followupDlg = document.getElementById('adv-reg-followup')
  const onFollowupDone = () => {
    pendingMarkerId = null
    void refreshAdvMarkersLayerAsync()
  }

  document.getElementById('adv-reg-btn-register')?.addEventListener(
    'click',
    async () => {
      if (gpsEl) gpsEl.textContent = 'Henter posisjon …'
      try {
        const p = await getFreshGpsForAdv()
        if (p.accuracy > MAX_ACCURACY_M) {
          if (gpsEl) {
            gpsEl.textContent = `For usikkert (±${Math.round(p.accuracy)} m). Trenger ca. ±${MAX_ACCURACY_M} m.`
          }
          return
        }
        const id = crypto.randomUUID()
        advRegState.markers.push({
          id,
          lat: p.lat,
          lng: p.lng,
          accuracy: p.accuracy,
          timestamp: new Date().toISOString(),
          comment: null,
          photoDataUrl: null,
        })
        pendingMarkerId = id
        await refreshAdvMarkersLayerAsync()
        if (gpsEl) {
          gpsEl.textContent = `Nøyaktighet ca. ${Math.round(p.accuracy)} m`
        }
        if (followupDlg instanceof HTMLDialogElement) {
          const ta = /** @type {HTMLTextAreaElement | null} */ (
            document.getElementById('adv-reg-comment-ta')
          )
          const wrap = document.getElementById('adv-reg-comment-wrap')
          const inp = /** @type {HTMLInputElement | null} */ (
            document.getElementById('adv-reg-photo-input')
          )
          if (ta) ta.value = ''
          if (wrap) wrap.hidden = true
          if (inp) inp.value = ''
          const st = document.getElementById('adv-reg-followup-status')
          if (st) st.textContent = ''
          followupDlg.showModal()
        }
      } catch {
        if (gpsEl) gpsEl.textContent = 'Kunne ikke hente posisjon.'
      }
    },
    { signal },
  )

  document.getElementById('adv-reg-skip-comment')?.addEventListener(
    'click',
    () => {
      if (pendingMarkerId) {
        const m = advRegState.markers.find((x) => x.id === pendingMarkerId)
        if (m) m.comment = null
      }
      const wrap = document.getElementById('adv-reg-comment-wrap')
      if (wrap) wrap.hidden = true
    },
    { signal },
  )
  document.getElementById('adv-reg-add-comment')?.addEventListener(
    'click',
    () => {
      const wrap = document.getElementById('adv-reg-comment-wrap')
      if (wrap) wrap.hidden = false
    },
    { signal },
  )
  document.getElementById('adv-reg-save-comment')?.addEventListener(
    'click',
    () => {
      const ta = /** @type {HTMLTextAreaElement | null} */ (
        document.getElementById('adv-reg-comment-ta')
      )
      if (pendingMarkerId && ta) {
        const m = advRegState.markers.find((x) => x.id === pendingMarkerId)
        if (m) m.comment = ta.value.trim() || null
      }
      const st = document.getElementById('adv-reg-followup-status')
      if (st) st.textContent = 'Kommentar lagret.'
    },
    { signal },
  )
  document.getElementById('adv-reg-skip-photo')?.addEventListener(
    'click',
    () => {
      const st = document.getElementById('adv-reg-followup-status')
      if (st) st.textContent = 'Ingen bilde.'
    },
    { signal },
  )
  document.getElementById('adv-reg-take-photo')?.addEventListener(
    'click',
    () => document.getElementById('adv-reg-photo-input')?.click(),
    { signal },
  )
  document.getElementById('adv-reg-photo-input')?.addEventListener(
    'change',
    (ev) => {
      const inp = /** @type {HTMLInputElement} */ (ev.target)
      const f = inp.files?.[0]
      if (!f || !pendingMarkerId) return
      const r = new FileReader()
      r.onload = () => {
        const m = advRegState.markers.find((x) => x.id === pendingMarkerId)
        if (m && typeof r.result === 'string') {
          m.photoDataUrl = r.result
          const st = document.getElementById('adv-reg-followup-status')
          if (st) st.textContent = 'Bilde lagret på punktet.'
        }
        inp.value = ''
      }
      r.readAsDataURL(f)
    },
    { signal },
  )
  document.getElementById('adv-reg-followup-done')?.addEventListener(
    'click',
    () => {
      if (followupDlg instanceof HTMLDialogElement) followupDlg.close()
      onFollowupDone()
    },
    { signal },
  )

  document.getElementById('adv-reg-map')?.addEventListener(
    'click',
    (ev) => {
      const del = ev.target.closest?.('[data-adv-delete]')
      if (del instanceof HTMLElement) {
        const id = del.getAttribute('data-adv-delete')
        if (id) {
          advRegState.markers = advRegState.markers.filter((x) => x.id !== id)
          void refreshAdvMarkersLayerAsync()
        }
      }
    },
    { signal },
  )

  document.getElementById('adv-reg-btn-undo')?.addEventListener(
    'click',
    () => {
      if (!advRegState.markers.length) return
      advRegState.markers.pop()
      void refreshAdvMarkersLayerAsync()
    },
    { signal },
  )
  document.getElementById('adv-reg-btn-reset')?.addEventListener(
    'click',
    () => {
      if (
        !advRegState.markers.length ||
        !window.confirm('Slette alle punkter i denne økten?')
      ) {
        return
      }
      advRegState.markers = []
      void refreshAdvMarkersLayerAsync()
    },
    { signal },
  )
  document.getElementById('adv-reg-btn-finish')?.addEventListener(
    'click',
    () => {
      destroyAdvMap()
      nav('advRegReport')
    },
    { signal },
  )

  signal.addEventListener('abort', () => {
    destroyAdvMap()
  })
}

