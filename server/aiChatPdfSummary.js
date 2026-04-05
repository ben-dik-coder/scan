/**
 * Oppsummering av VeiAi/kontrakt-chat til kort konklusjon + markering av nøkkelord (PDF-eksport).
 */

import OpenAI from 'openai'

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Pakker inn treff i allerede HTML-escaped tekst (konklusjon).
 * Highlights er rå tekst fra modellen; må finnes som substring etter escaping.
 * @param {string} safeEscapedConclusion
 * @param {string[]} rawHighlights
 */
export function wrapHighlightsInEscapedHtml(safeEscapedConclusion, rawHighlights) {
  const uniq = [
    ...new Set((rawHighlights || []).map((h) => String(h).trim()).filter(Boolean)),
  ].sort((a, b) => b.length - a.length)
  if (!uniq.length) return safeEscapedConclusion
  const escapedParts = uniq.map((h) => esc(h)).filter(Boolean)
  const pattern = escapedParts
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  if (!pattern) return safeEscapedConclusion
  return safeEscapedConclusion.replace(
    new RegExp(`(${pattern})`, 'g'),
    '<span class="pdf-kw">$1</span>',
  )
}

/**
 * @param {Array<{ role?: string, text?: string }>} lines
 * @param {{ contractMode?: boolean }} opts
 * @returns {Promise<{ conclusion: string, highlights: string[] }>}
 */
export async function summarizeAiChatLinesForPdf(lines, opts = {}) {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    throw new Error('OPENAI_API_KEY mangler for oppsummering.')
  }
  const timeoutMs = (() => {
    const v = process.env.OPENAI_TIMEOUT_MS
    if (v == null || String(v).trim() === '') return 720_000
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(1_800_000, Math.max(60_000, n)) : 720_000
  })()
  const openai = new OpenAI({ apiKey: key, timeout: timeoutMs })
  const assistantLabel = opts.contractMode ? 'Kontrakt-AI' : 'VeiAi'
  const transcript = (Array.isArray(lines) ? lines : [])
    .map((line) => {
      const isUser = line.role === 'user'
      const who = isUser ? 'Bruker' : assistantLabel
      const raw = typeof line.text === 'string' ? line.text.trim() : ''
      return `${who}: ${raw}`
    })
    .filter((s) => s.length > String(assistantLabel).length + 2)
    .join('\n\n')

  if (!transcript.trim()) {
    return { conclusion: 'Ingen samtaleinnhold å oppsummere.', highlights: [] }
  }

  const model =
    process.env.OPENAI_PDF_SUMMARY_MODEL?.trim() || 'gpt-4o-mini'

  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    temperature: 0.28,
    max_completion_tokens: 1400,
    messages: [
      {
        role: 'system',
        content: `Du skal lese en samtale (veiassistent / kontrakt) og skrive en kort, profesjonell konklusjon på norsk.

Returner JSON med nøklene "conclusion" og "highlights":
- "conclusion": Én sammenhengende tekst (maks ca. 1200 tegn). Oppsummer det viktigste: beslutninger, krav, risiko, tiltak, datoer, mål, prosesser, stedkoder – uten å kopiere hele samtalen. Bruk korte avsnitt eller punktliste der det hjelper.
- "highlights": Liste med 4–15 korte fraser som finnes ordrett som delstreng i "conclusion". Velg konkrete ting: datoer (f.eks. "15. april 2026"), tall med enhet ("3 meter", "5 %"), prosessnumre, stedkoder, frister, §-henvisninger hvis de står i konklusjonen, navn på tiltak. Hver streng må være eksakt lik et utsnitt i "conclusion" (samme tegn, inkl. mellomrom). Ingen duplikater. Hvis conclusion er tom av grunner, bruk tom liste.

Ikke inkluder JSON utenfor strukturen. Ikke bruk markdown-kodeblokker.`,
      },
      {
        role: 'user',
        content: transcript.slice(0, 100_000),
      },
    ],
  })

  const raw = completion.choices?.[0]?.message?.content?.trim() || ''
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Kunne ikke tolke oppsummering fra modellen.')
  }
  const conclusion =
    typeof parsed.conclusion === 'string' ? parsed.conclusion.trim() : ''
  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights
        .map((h) => (typeof h === 'string' ? h.trim() : ''))
        .filter(Boolean)
    : []

  if (!conclusion) {
    return {
      conclusion: 'Ingen konklusjon kunne genereres.',
      highlights: [],
    }
  }

  const filteredHighlights = highlights.filter((h) => conclusion.includes(h))
  return { conclusion, highlights: filteredHighlights }
}
