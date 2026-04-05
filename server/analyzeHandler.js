 /**
 * POST /api/analyze — OpenAI vision + tekst (veivokter-rapport).
 * Krever OPENAI_API_KEY. Modell: OPENAI_MODEL (standard gpt-5-mini).
 *
 * Valgfri kontrakt/avtale: legg tekst i fil (se loadContractContext nedenfor)
 * eller sett miljøvariabel CONTRACT_CONTEXT_PATH. Teksten legges til systemprompt
 * (ikke «trening» – modellen følger den som instruksjon per forespørsel).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import OpenAI from 'openai'

const DEFAULT_MODEL = 'gpt-5-mini'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Leser kontrakts-/avtaletekst fra disk (én gang ved oppstart).
 * Standardfil: server/contract-context.txt (ikke i git – bruk .example som mal).
 * @returns {string} suffiks til systemprompt, eller tom streng
 */
function loadContractContext() {
  const fromEnv = process.env.CONTRACT_CONTEXT_PATH
  const defaultPath = path.join(__dirname, 'contract-context.txt')
  const p = (fromEnv && String(fromEnv).trim()) || defaultPath
  try {
    const raw = fs.readFileSync(p, 'utf8')
    const t = raw.trim()
    if (!t) return ''
    if (t.length > 120_000) {
      console.warn(
        'analyze: CONTRACT_CONTEXT er veldig lang (' +
          t.length +
          ' tegn). Vurder å korte ned eller bruk RAG for store dokumenter.',
      )
    }
    return (
      '\n\n--- Kontrakt / avtale / regelverk du skal respektere når det er relevant ---\n' +
      t
    )
  } catch (e) {
    if (fromEnv && String(fromEnv).trim()) {
      console.warn('analyze: Kunne ikke lese CONTRACT_CONTEXT_PATH:', p, e)
    }
    return ''
  }
}

const CONTRACT_CONTEXT = loadContractContext()

const SYSTEM_PROMPT_BASE = `Du er en erfaren veivokter i Norge som svarer i samme praktiske, tydelige stil som ChatGPT: hjelpsom, strukturert, tilpasset fagperson på vei.

Analyser bildet og teksten fra brukeren.

Tenk internt gjennom risiko og tiltak før du svarer (ikke skriv ut tenkeprosessen): hva er viktigst, hva er usikkert fra bildet, hva bør gjøres først?

Fokuser på: raske og praktiske løsninger, vinterforhold, sikkerhet.

I JSON-feltene: skriv explanation og report som naturlig, lesbar tekst – brukeren skal forstå hvorfor og hva først. Unngå tom byråkratjargon.

Returner JSON med:
- problem
- risk
- action
- explanation
- report (ferdig skrevet rapport klar til bruk)

Svar ALLTID med gyldig JSON-objekt med nøklene problem, risk, action, explanation, report. Bruk norsk.`

const SYSTEM_PROMPT_FOLLOWUP_BASE = `Du er samme veivokter-assistent, i ChatGPT-lignende stil: svar direkte og naturlig på norsk på det brukeren spør om nå.

Brukeren har et bilde og tidligere meldinger (analyse/tekst) i samtalen.
- Forstå oppfølgingsspørsmålet i lys av tidligere i tråden.
- Svar først med kjernen; utvid bare om det hjelper.
- Ikke gjenta hele tidligere analyse med mindre brukeren ber om det.
- Hvis noe ikke kan besvares ut fra bildet/samtalen, si det kort.`

/** Første runde uten bilde (kun tekst). */
const SYSTEM_PROMPT_TEXT_ONLY_BASE = `Du er en erfaren veivokter i Norge i ChatGPT-lignende stil: tydelig, hjelpsom, praktisk.

Brukeren har ikke vedlagt bilde – svar ut fra tekstbeskrivelsen og solid veivokter-fagkunnskap.

Tenk internt gjennom scenarioet før du fyller JSON; skriv explanation og report som levende, forståelig tekst.

Fokuser på: raske og praktiske løsninger, vinterforhold, sikkerhet.

Returner JSON med:
- problem
- risk
- action
- explanation
- report (ferdig skrevet rapport klar til bruk)

Svar ALLTID med gyldig JSON-objekt med nøklene problem, risk, action, explanation, report. Bruk norsk.`

const SYSTEM_PROMPT = SYSTEM_PROMPT_BASE + CONTRACT_CONTEXT
const SYSTEM_PROMPT_FOLLOWUP = SYSTEM_PROMPT_FOLLOWUP_BASE + CONTRACT_CONTEXT
const SYSTEM_PROMPT_TEXT_ONLY = SYSTEM_PROMPT_TEXT_ONLY_BASE + CONTRACT_CONTEXT

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
        temperature: isFirstShot ? 0.55 : 0.78,
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

    const hasImage =
      image != null && typeof image === 'string' && String(image).trim().length > 0

    /** Legacy uten bilde: ren tekst (første analyse eller oppfølging som ren tekst). */
    if (!hasImage) {
      const userText = buildUserText(text, vehicle, temperature)
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.55,
        response_format: { type: 'json_object' },
        max_tokens: 2500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_TEXT_ONLY },
          { role: 'user', content: userText },
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
      return
    }

    const imageUrl = await normalizeImageForOpenAI(String(image))
    const userText = buildUserText(text, vehicle, temperature)

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.55,
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
        ? ' Sjekk OPENAI_MODEL i server/.env (f.eks. gpt-5-mini).'
        : ''
    res.status(502).json({ error: `${msg}${hint}` })
  }
}
