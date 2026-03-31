/**
 * Print-optimalisert HTML for A4-PDF (Puppeteer).
 * Nøytral typografi, norsk tegnsett (UTF-8).
 */

/**
 * @param {string} s
 */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {object} data
 * @param {{ mapDataUrl: string | null, logoDataUrl: string | null }} assets
 */
export function buildReportHtml(data, { mapDataUrl, logoDataUrl }) {
  const appName = esc(data.appName || 'Scanix')
  const userName = esc(data.userName || '—')
  const sessionTitle =
    typeof data.sessionTitle === 'string' && data.sessionTitle.trim()
      ? esc(data.sessionTitle.trim())
      : null
  const registeredNote =
    typeof data.registeredNote === 'string' && data.registeredNote.trim()
      ? esc(data.registeredNote.trim())
      : null
  const generatedAt = esc(
    data.generatedAtLabel ||
      new Date().toLocaleString('nb-NO', {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
  )
  const comments =
    typeof data.comments === 'string' && data.comments.trim()
      ? esc(data.comments.trim())
      : ''
  const roadLabel =
    typeof data.roadSideLabel === 'string' && data.roadSideLabel.trim()
      ? esc(data.roadSideLabel.trim())
      : ''
  const objLabels = Array.isArray(data.objectCategoryLabels)
    ? data.objectCategoryLabels.map((x) => esc(String(x))).filter(Boolean)
    : []
  const version = esc(data.appVersion || '')
  const clickHistory = Array.isArray(data.clickHistory) ? data.clickHistory : []
  const log = Array.isArray(data.log) ? data.log : []
  const photos = Array.isArray(data.photos) ? data.photos : []

  const detailsRows = []
  if (sessionTitle) {
    detailsRows.push(
      `<tr><th>Navn</th><td>${sessionTitle}</td></tr>`,
    )
  }
  if (registeredNote) {
    detailsRows.push(
      `<tr><th>Hva registerte du</th><td class="pre-wrap">${registeredNote}</td></tr>`,
    )
  }
  detailsRows.push(
    `<tr><th>Registreringer (trykk)</th><td>${clickHistory.length}</td></tr>`,
  )
  if (roadLabel) {
    detailsRows.push(`<tr><th>Vegside</th><td>${roadLabel}</td></tr>`)
  }
  if (objLabels.length) {
    detailsRows.push(
      `<tr><th>Objekttyper</th><td>${objLabels.join(', ')}</td></tr>`,
    )
  }

  const pointsHtml = clickHistory.length
    ? `<table class="data-table">
  <thead><tr><th>#</th><th>Tidspunkt</th><th>Koordinater</th><th>Kategori</th></tr></thead>
  <tbody>${clickHistory
    .map((p, i) => {
      const ts =
        p.timestamp && typeof p.timestamp === 'string'
          ? esc(new Date(p.timestamp).toLocaleString('nb-NO'))
          : '—'
      const lat = p.lat != null ? Number(p.lat) : null
      const lng = p.lng != null ? Number(p.lng) : null
      const coord =
        lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
          ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          : '—'
      const cat =
        typeof p.categoryLabel === 'string' && p.categoryLabel.trim()
          ? esc(p.categoryLabel.trim())
          : '—'
      return `<tr><td>${i + 1}</td><td>${ts}</td><td>${coord}</td><td>${cat}</td></tr>`
    })
    .join('')}
  </tbody></table>`
    : `<p class="muted">Ingen registrerte punkt med koordinater i denne eksporten.</p>`

  const logHtml = log.length
    ? `<ul class="log-lines">${log
        .map((e) => {
          const ts =
            e?.timestamp && typeof e.timestamp === 'string'
              ? esc(new Date(e.timestamp).toLocaleString('nb-NO'))
              : '—'
          const msg =
            e && typeof e.message === 'string' ? esc(e.message) : '—'
          return `<li><span class="log-time">${ts}</span> ${msg}</li>`
        })
        .join('')}</ul>`
    : `<p class="muted">Ingen tekstlogg.</p>`

  const photosHtml = photos.length
    ? `<div class="photo-grid">${photos
        .map((ph, i) => {
          const src =
            ph && typeof ph.dataUrl === 'string' && ph.dataUrl.startsWith('data:')
              ? ph.dataUrl
              : ''
          if (!src) {
            return `<figure class="photo-card photo-card--missing"><figcaption>Bilde ${i + 1} (mangler data)</figcaption></figure>`
          }
          const cap =
            ph.timestamp && typeof ph.timestamp === 'string'
              ? esc(new Date(ph.timestamp).toLocaleString('nb-NO'))
              : `Bilde ${i + 1}`
          return `<figure class="photo-card"><img src="${src}" alt="" /><figcaption>${cap}</figcaption></figure>`
        })
        .join('')}</div>`
    : `<p class="muted">Ingen bilder i økta.</p>`

  const mapSection = mapDataUrl
    ? `<div class="map-wrap"><img class="map-img" src="${mapDataUrl}" alt="Kartutsnitt" /></div>
       <p class="map-note">Punktene vises som markører på kartutsnittet (OpenStreetMap).</p>`
    : `<p class="muted">Kart kunne ikke genereres (ingen GPS-punkt eller tjeneste utilgjengelig).</p>`

  const logoBlock = logoDataUrl
    ? `<div class="brand-logo"><img src="${logoDataUrl}" alt="" /></div>`
    : `<div class="brand-text">${appName}</div>`

  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8" />
  <title>Rapport — ${appName}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm 18mm 14mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: #1a1d24;
      background: #fff;
    }
    .doc { max-width: 100%; }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .brand-row { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
    .brand-logo img { height: 42px; width: auto; object-fit: contain; display: block; }
    .brand-text { font-size: 16pt; font-weight: 700; letter-spacing: -0.02em; color: #0f172a; }
    h1.report-title {
      margin: 0 0 6px;
      font-size: 18pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.03em;
    }
    .meta-line { font-size: 9.5pt; color: #64748b; margin: 0; }
    h2 {
      font-size: 11.5pt;
      font-weight: 700;
      color: #0f172a;
      margin: 20px 0 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      break-after: avoid;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin: 8px 0 12px;
    }
    .data-table th, .data-table td {
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    .data-table th { background: #f8fafc; width: 28%; font-weight: 600; color: #334155; }
    td.pre-wrap { white-space: pre-wrap; word-break: break-word; }
    .muted { color: #64748b; font-size: 9.5pt; margin: 6px 0; }
    .log-lines { list-style: none; margin: 0; padding: 0; }
    .log-lines li { padding: 6px 0; border-bottom: 1px solid #f1f5f9; break-inside: avoid; }
    .log-time { display: inline-block; min-width: 9.5em; color: #2563eb; font-size: 9pt; font-weight: 600; }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 8px;
    }
    @media print {
      .photo-grid { grid-template-columns: repeat(3, 1fr); }
    }
    .photo-card {
      margin: 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .photo-card img {
      width: 100%;
      height: 120px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      display: block;
      background: #f8fafc;
    }
    .photo-card figcaption {
      font-size: 8pt;
      color: #64748b;
      margin-top: 4px;
      line-height: 1.3;
    }
    .photo-card--missing {
      min-height: 80px;
      border: 1px dashed #cbd5e1;
      border-radius: 4px;
      padding: 8px;
      font-size: 8pt;
      color: #94a3b8;
    }
    .map-wrap {
      margin: 10px 0 6px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .map-img {
      width: 100%;
      max-height: 220px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .map-note { font-size: 8.5pt; color: #64748b; margin: 0 0 4px; }
    .comments-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      white-space: pre-wrap;
      font-size: 9.5pt;
      break-inside: avoid;
    }
    .footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 8.5pt;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="doc">
    <header class="header">
      <div class="brand-row">
        ${logoBlock}
        <div>
          <h1 class="report-title">Rapport</h1>
          <p class="meta-line">Generert ${generatedAt} · Bruker: ${userName}</p>
        </div>
      </div>
    </header>

    <section>
      <h2>Registreringsdetaljer</h2>
      <table class="data-table">
        ${detailsRows.join('')}
      </table>
      ${pointsHtml}
    </section>

    <section>
      <h2>Bilder</h2>
      ${photosHtml}
    </section>

    <section>
      <h2>Kart</h2>
      ${mapSection}
    </section>

    <section>
      <h2>Kommentarer</h2>
      ${
        comments
          ? `<div class="comments-box">${comments.replace(/\n/g, '<br/>')}</div>`
          : `<p class="muted">Ingen kommentarer lagt til ved eksport.</p>`
      }
    </section>

    <section>
      <h2>Tekstlogg</h2>
      ${logHtml}
    </section>

    <footer class="footer">
      Generert av ${appName}${version ? ` · v${version}` : ''} · ${generatedAt}
    </footer>
  </div>
</body>
</html>`
}
