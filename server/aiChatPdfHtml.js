/**
 * HTML for A4-PDF fra VeiAi-chat (Puppeteer).
 * @param {{ title?: string, generatedAtLabel?: string, lines?: Array<{ role?: string, text?: string }>, conclusion?: string, highlights?: string[] }} data
 */

import { wrapHighlightsInEscapedHtml } from './aiChatPdfSummary.js'

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {{ title?: string, generatedAtLabel?: string, lines?: Array<{ role?: string, text?: string }>, conclusion?: string, highlights?: string[] }} data
 */
export function buildAiChatPdfHtml(data) {
  const title = esc(data.title || 'RoadMindAi – dokumentering')
  const generatedAt = esc(
    typeof data.generatedAtLabel === 'string' && data.generatedAtLabel.trim()
      ? data.generatedAtLabel.trim()
      : new Date().toLocaleString('nb-NO', {
          dateStyle: 'long',
          timeStyle: 'short',
        }),
  )
  const conclusionRaw =
    typeof data.conclusion === 'string' ? data.conclusion.trim() : ''
  const highlights = Array.isArray(data.highlights) ? data.highlights : []

  if (conclusionRaw) {
    const escaped = esc(conclusionRaw).replace(/\r\n/g, '\n')
    const withKw = wrapHighlightsInEscapedHtml(escaped, highlights)
    const safe = withKw.replace(/\n/g, '<br />')
    return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #111;
      margin: 0;
      padding: 0;
    }
    h1 { font-size: 16pt; margin: 0 0 0.35rem; font-weight: 700; }
    .meta { font-size: 9.5pt; color: #444; margin-bottom: 1rem; }
    .badge {
      display: inline-block;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #15803d;
      margin-bottom: 0.5rem;
    }
    .summary-body {
      margin: 0;
      padding: 0.65rem 0.75rem;
      border: 1px solid #e5e5e5;
      border-radius: 4px;
      background: #fafafa;
    }
    .pdf-kw {
      display: inline;
      border: 1.2pt solid #16a34a;
      border-radius: 2pt;
      padding: 0.08em 0.22em;
      margin: 0 0.05em;
      background: rgba(22, 163, 74, 0.09);
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    .note { font-size: 8.5pt; color: #666; margin-top: 1rem; font-style: italic; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">${generatedAt}</p>
  <p class="badge">Konklusjon (AI-oppsummert)</p>
  <div class="summary-body">${withKw}</div>
  <p class="note">Nøkkelord og konkrete opplysninger er markert med grønn ramme.</p>
</body>
</html>`
  }

  const lines = Array.isArray(data.lines) ? data.lines : []
  const blocks = lines
    .map((line) => {
      const isUser = line.role === 'user'
      const label = isUser ? 'Bruker' : 'RoadMindAi'
      const raw = typeof line.text === 'string' ? line.text.trim() : ''
      if (!raw) return ''
      const safe = esc(raw).replace(/\r\n/g, '\n').replace(/\n/g, '<br />')
      return `<section class="block"><h2 class="who">${esc(label)}</h2><div class="txt">${safe}</div></section>`
    })
    .filter(Boolean)
    .join('')

  const empty = !blocks.trim()

  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #111;
      margin: 0;
      padding: 0;
    }
    h1 { font-size: 16pt; margin: 0 0 0.35rem; font-weight: 700; }
    .meta { font-size: 9.5pt; color: #444; margin-bottom: 1.2rem; }
    .block { margin-bottom: 1rem; page-break-inside: avoid; }
    .who {
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #2563eb;
      margin: 0 0 0.25rem;
    }
    .txt { margin: 0; }
    .empty { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">${generatedAt}</p>
  ${empty ? '<p class="empty">Ingen samtaleinnhold.</p>' : blocks}
</body>
</html>`
}
