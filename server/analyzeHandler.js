 /**
 * POST /api/analyze — OpenAI vision + tekst (veivokter-rapport).
 * Krever OPENAI_API_KEY. Modell: OPENAI_MODEL (standard gpt-4.1).
 */

import OpenAI from 'openai'

const DEFAULT_MODEL = 'gpt-4.1'

const SYSTEM_PROMPT = `Du er en erfaren veivokter i Norge.
Analyser bildet og teksten fra brukeren.

Fokuser på:
- raske og praktiske løsninger
- vinterforhold
- sikkerhet

Svar kort og konkret.

Returner JSON med:
- problem
- risk
- action
- explanation
- report (ferdig skrevet rapport klar til bruk)

Svar ALLTID med gyldig JSON-objekt med nøklene problem, risk, action, explanation, report. Bruk norsk.`

const SYSTEM_PROMPT_FOLLOWUP = `Du er en erfaren veivokter i Norge.
Brukeren har et bilde og en tidligere analyse (JSON eller tekst) i samtalen.
Svar kort og konkret på norsk på oppfølgingsspørsmålet, med utgangspunkt i bildet og analysen.
Ikke gjenta hele JSON-analysen med mindre brukeren ber om det.`

/**
 * @param {string} image
 * @returns {Promise<string>} image_url for OpenAI (https eller data: URL)
 */
async function normalizeImageForOpenAI(image) {
  const t = image.trim()
  if (t.startsWith('https://') || t.startsWith('http://')) {
    const r = await fetch(t, {
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    })
    if (!r.ok) {
      throw new Error(`Kunne ikke hente bilde-URL (${r.status}).`)
    }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > 20 * 1024 * 1024) {
      throw new Error('Bildet fra URL er for stort (maks 20 MB).')
    }
    const ct = (r.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    const safeCt = ct.startsWith('image/') ? ct : 'image/jpeg'
    return `data:${safeCt};base64,${buf.toString('base64')}`
  }
  if (t.startsWith('data:image/')) {
    return t
  }
  const b64 = t.replace(/\s/g, '')
  if (!b64.length) throw new Error('Tomt bildeinnhold.')
  return `data:image/jpeg;base64,${b64}`
}

function buildUserText(text, vehicle, temperature) {
  let s = `Brukerens beskrivelse:\n${String(text).trim()}`
  if (vehicle != null && String(vehicle).trim()) {
    s += `\n\nKjøretøy/utstyr (valgfritt): ${String(vehicle).trim()}`
  }
  if (temperature != null && String(temperature).trim()) {
    s += `\n\nTemperatur / føreforhold (valgfritt): ${String(temperature).trim()}`
  }
  return s
}

function coerceResult(obj) {
  const keys = ['problem', 'risk', 'action', 'explanation', 'report']
  const out = {}
  for (const k of keys) {
    const v = obj && typeof obj === 'object' ? obj[k] : null
    out[k] = typeof v === 'string' ? v : v != null ? String(v) : ''
  }
  return out
}

/**
 * OpenAI kan returnere assistant.content som streng eller som liste med tekst-deler.
 * @param {unknown} message
 * @returns {string}
 */
function textFromAssistantMessage(message) {
  if (!message || typeof message !== 'object') return ''
  const m = /** @type {Record<string, unknown>} */ (message)
  if (typeof m.refusal === 'string' && m.refusal.trim()) {
    return m.refusal.trim()
  }
  const c = m.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return c
      .map((part) => {
        if (!part || typeof part !== 'object') return ''
        const p = /** @type {Record<string, unknown>} */ (part)
        if (typeof p.text === 'string') return p.text
        return ''
      })
      .join('')
  }
  if (c == null) return ''
  return String(c)
}

/** @type {OpenAI | null} */
let client = null

function getClient() {
  const key = process.env.OPENAI_API_KEY
  if (!key || !key.trim()) return null
  if (!client) {
    client = new OpenAI({ apiKey: key.trim() })
  }
  return client
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function isOpenAiMessagesArray(v) {
  return Array.isArray(v) && v.length > 0 && v.length <= 40
}

export async function handleAnalyze(req, res) {
  try {
    const body = req.body
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Ugyldig JSON.' })
      return
    }

    const openai = getClient()
    if (!openai) {
      res.status(503).json({
        error:
          'OPENAI_API_KEY er ikke satt. Legg til nøkkel i miljøvariabler for serveren.',
      })
      return
    }

    const model = (process.env.OPENAI_MODEL || DEFAULT_MODEL).trim()

    /** Flertråds chat: klient sender OpenAI-format messages (første = user med bilde). */
    if (isOpenAiMessagesArray(body.messages)) {
      const msgs = /** @type {Array<{ role: string, content: unknown }>} */ (
        body.messages
      )
      const isFirstShot = msgs.length === 1
      const sys = isFirstShot ? SYSTEM_PROMPT : SYSTEM_PROMPT_FOLLOWUP
      const completion = await openai.chat.completions.create({
        model,
        response_format: isFirstShot ? { type: 'json_object' } : undefined,
        max_tokens: isFirstShot ? 2500 : 4096,
        messages: [{ role: 'system', content: sys }, ...msgs],
      })

      const raw = textFromAssistantMessage(completion.choices[0]?.message)
      if (!raw || !String(raw).trim()) {
        res.status(502).json({ error: 'Tomt svar fra modellen.' })
        return
      }

      if (isFirstShot) {
        let parsed
        try {
          parsed = JSON.parse(raw.trim())
        } catch {
          res.status(502).json({ error: 'Kunne ikke tolke JSON fra modellen.' })
          return
        }
        res.json(coerceResult(parsed))
        return
      }

      res.json({ reply: raw.trim() })
      return
    }

    const { image, text, vehicle, temperature } = body

    if (text == null || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Mangler tekst (beskrivelse).' })
      return
    }
    if (image == null || typeof image !== 'string' || !String(image).trim()) {
      res.status(400).json({ error: 'Mangler bilde (URL eller base64).' })
      return
    }

    const imageUrl = await normalizeImageForOpenAI(String(image))
    const userText = buildUserText(text, vehicle, temperature)

    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      max_tokens: 2500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'high' },
            },
          ],
        },
      ],
    })

    const raw = textFromAssistantMessage(completion.choices[0]?.message)
    if (!raw || !String(raw).trim()) {
      res.status(502).json({ error: 'Tomt svar fra modellen.' })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(raw.trim())
    } catch {
      res.status(502).json({ error: 'Kunne ikke tolke JSON fra modellen.' })
      return
    }

    const result = coerceResult(parsed)
    res.json(result)
  } catch (err) {
    console.error('analyze:', err)
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: string }} */ (err).message)
        : 'Analyse feilet.'
    /** Ikke videresend OpenAI sin HTTP-status (f.eks. 404 ved ukjent modell) — gir «feil 404» i appen uten tydelig årsak. */
    const hint =
      /404|model/i.test(msg) && !/fetch|connect/i.test(msg)
        ? ' Sjekk OPENAI_MODEL i server/.env (f.eks. gpt-4o).'
        : ''
    res.status(502).json({ error: `${msg}${hint}` })
  }
}
