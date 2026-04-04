/**
 * POST /api/contract-chat — RAG mot contract_chunks (Supabase pgvector).
 * Krever: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIM = 1536
const CHAT_MODEL = process.env.OPENAI_CONTRACT_MODEL || 'gpt-4o-mini'
const MATCH_COUNT = Math.min(
  16,
  Math.max(4, Number(process.env.CONTRACT_RAG_MATCH_COUNT || 8)),
)

/** @type {OpenAI | null} */
let openaiClient = null
/** @type {ReturnType<typeof createClient> | null} */
let supabaseAdmin = null

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY
  if (!key?.trim()) return null
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: key.trim() })
  return openaiClient
}

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return supabaseAdmin
}

/** @returns {string[]} navn på manglende variabler */
function getMissingContractEnvVars() {
  const m = []
  if (!process.env.OPENAI_API_KEY?.trim()) m.push('OPENAI_API_KEY')
  if (!process.env.SUPABASE_URL?.trim()) m.push('SUPABASE_URL')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    m.push('SUPABASE_SERVICE_ROLE_KEY')
  }
  return m
}

/**
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedQuery(text) {
  const openai = getOpenAI()
  if (!openai) throw new Error('OPENAI_API_KEY mangler.')
  const t = String(text).trim()
  if (!t) throw new Error('Tom tekst for embedding.')
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: t,
    dimensions: EMBEDDING_DIM,
  })
  const emb = res.data?.[0]?.embedding
  if (!Array.isArray(emb) || emb.length !== EMBEDDING_DIM) {
    throw new Error('Ugyldig embedding-svar fra OpenAI.')
  }
  return emb
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleContractChat(req, res) {
  try {
    const openai = getOpenAI()
    const supabase = getSupabase()
    if (!openai || !supabase) {
      const missing = getMissingContractEnvVars()
      res.status(503).json({
        error:
          missing.length > 0
            ? `Kontrakt-RAG: mangler i server/.env: ${missing.join(', ')}. (Ikke VITE_* – bruk nøyaktig disse navnene i mappen server/)`
            : 'Kontrakt-RAG er ikke konfigurert.',
      })
      return
    }

    const body = req.body
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Ugyldig JSON.' })
      return
    }

    const messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages må være en ikke-tom tabell.' })
      return
    }
    if (messages.length > 40) {
      res.status(400).json({ error: 'For mange meldinger (maks 40).' })
      return
    }

    /** Siste brukerinnhold (tekst) for embedding */
    let lastUserText = ''
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'user' && typeof m.content === 'string') {
        lastUserText = m.content.trim()
        break
      }
    }
    if (!lastUserText) {
      res.status(400).json({ error: 'Ingen brukermelding med tekst funnet.' })
      return
    }

    const queryEmbedding = await embedQuery(lastUserText)

    const { data: rows, error: rpcError } = await supabase.rpc(
      'match_contract_chunks',
      {
        query_embedding: queryEmbedding,
        match_count: MATCH_COUNT,
        min_similarity: 0,
      },
    )

    if (rpcError) {
      console.error('contract-chat rpc:', rpcError)
      res.status(500).json({
        error:
          rpcError.message ||
          'Kunne ikke hente treff fra databasen. Sjekk at SQL for match_contract_chunks er kjørt.',
      })
      return
    }

    const chunks = Array.isArray(rows) ? rows : []
    if (chunks.length === 0) {
      res.status(503).json({
        error:
          'Ingen indeksert kontrakttekst. Kjør: npm run ingest-contract-pdf -- /sti/til/kontrakt.pdf (i server-mappen).',
        reply: null,
      })
      return
    }

    const contextBlock = chunks
      .map((row, i) => {
        const content =
          row && typeof row.content === 'string' ? row.content.trim() : ''
        const meta =
          row && row.metadata && typeof row.metadata === 'object'
            ? JSON.stringify(row.metadata)
            : ''
        return `[Utdrag ${i + 1}${meta ? ` (${meta})` : ''}]\n${content}`
      })
      .join('\n\n')

    const systemPrompt = `Du er en intelligent kontraktsanalytiker som bruker logikk, kontekst og forståelse – ikke bare direkte oppslag.

Målet ditt er å finne det mest korrekte svaret, selv når informasjonen ikke er helt direkte.

------------------------
TENKEMÅTE (OBLIGATORISK)
------------------------

Når du analyserer teksten:

1. FORSTÅ KONTEKST
- Hva handler spørsmålet egentlig om?
- Hvilken type informasjon leter du etter? (f.eks. startdato vs signeringsdato)

2. IDENTIFISER RELEVANT INFO
- Finn alle deler av teksten som kan være relevante
- Ikke stopp ved første match

3. BRUK LOGIKK
- Hvis svaret ikke er eksplisitt formulert:
  → trekk en logisk konklusjon basert på teksten
- Skill mellom lignende begreper (f.eks. ulike typer datoer)

4. VURDER ALTERNATIVER
- Hvis flere muligheter finnes:
  → forklar forskjellen
  → velg det som best svarer på spørsmålet

5. SJEKK DEG SELV
- Gir dette faktisk mening?
- Er dette det brukeren spør om – eller noe lignende?

------------------------
VIKTIG BALANSE
------------------------

- Du KAN bruke logikk og tolkning
- MEN:
  - Ikke finn opp fakta
  - All logikk må være basert på teksten
  - Hvis det ikke finnes nok info → "IKKE OPPGITT"

Svar på norsk. Bruk kun KONTEKST under som kilde – ikke ekstern kunnskap.

KONTEKST (indekserte utdrag fra kontrakten):
${contextBlock}

------------------------
SVARFORMAT
------------------------

[SVAR]
...

[LOGIKK]
Forklar hvordan du tolket informasjonen og koblet ting sammen

[ALTERNATIVER]
Andre mulige tolkninger (hvis relevant)

[KAPITTEL]
...

[UTDRAG]
"relevant sitat..." eller "IKKE OPPGITT"`

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content ?? ''),
      })),
    ]

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: /** @type {any} */ (chatMessages),
      temperature: 0.2,
      max_tokens: 3072,
    })

    const reply = completion.choices?.[0]?.message?.content?.trim() || ''
    if (!reply) {
      res.status(502).json({ error: 'Tomt svar fra modell.' })
      return
    }

    res.json({ reply })
  } catch (e) {
    console.error('contract-chat:', e)
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String(/** @type {{ message: string }} */ (e).message)
        : 'Ukjent feil.'
    res.status(500).json({ error: msg })
  }
}
