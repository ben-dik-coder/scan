/**
 * POST /api/contract-chat — RAG mot contract_chunks (Supabase pgvector).
 * Krever: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIM = 1536
const CHAT_MODEL = process.env.OPENAI_CONTRACT_MODEL || 'gpt-5-mini'
const MATCH_COUNT = Math.min(
  24,
  Math.max(6, Number(process.env.CONTRACT_RAG_MATCH_COUNT || 14)),
)

/** Maks antall utdrag sendt til modellen etter sammenslåing (vektor + nøkkelord). */
const MAX_CONTEXT_CHUNKS = Math.min(
  28,
  Math.max(10, Number(process.env.CONTRACT_RAG_MAX_CONTEXT_CHUNKS || 22)),
)

const KEYWORD_SUPPLEMENT = Math.min(
  16,
  Math.max(0, Number(process.env.CONTRACT_RAG_KEYWORD_SUPPLEMENT || 12)),
)

/** Cosinus-likhet 0–1; filtrerer svake treff (mindre støy → mindre hallusinasjon). Tomt treff → retry med 0. */
function getContractRagMinSimilarity() {
  const v = process.env.CONTRACT_RAG_MIN_SIMILARITY
  if (v == null || String(v).trim() === '') return 0.1
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(0.95, Math.max(0, n)) : 0.1
}

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
 * Kun tekst til sluttbruker: stripper [FORSTÅELSE]/[SVAR]/[LOGIKK]/[KILDE] hvis modellen
 * fortsatt sender gammelt strukturformat.
 * @param {string} raw
 */
function extractContractUserReply(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return ''

  const afterSvar = t.match(
    /\[SVAR\]\s*:?\s*([\s\S]*?)(?=\n\s*\[(?:FORSTÅELSE|LOGIKK|KILDE|SVAR)\]|\s*$)/i,
  )
  if (afterSvar && afterSvar[1] && afterSvar[1].trim()) {
    return afterSvar[1].trim()
  }

  let s = t
  s = s.replace(/\[FORSTÅELSE\][\s\S]*?(?=\n\s*\[|$)/gi, '')
  s = s.replace(/\[LOGIKK\][\s\S]*?(?=\n\s*\[|$)/gi, '')
  s = s.replace(/\[KILDE\][\s\S]*$/gi, '')
  s = s.replace(/\[KILDE\][\s\S]*?(?=\n\s*\[|$)/gi, '')
  s = s.trim()
  if (s) return s

  // Modellen skrev bare metadata-blokker: fjern kjente tagger og behold evt. ren tekst
  const stripped = t
    .replace(/\[(?:FORSTÅELSE|LOGIKK|KILDE|SVAR)\]\s*:?\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (stripped) return stripped

  const noTags = t.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim()
  return noTags || ''
}

const NO_STOP = new Set(
  `alle andre bare ble bli blir brukt bør da de deg den der det din disse du eller en er et ett fra før får har her hva hvem hvilke hvilken hvis hvor hvordan ikke inn jeg kan kom kun litt man med meg men mer min mot mye nei noe noen nå og også om opp oss over på samme seg selv si sin sine sitt skal slik som så tid til under ut være vært var ved vi vil vår år`.split(
    /\s+/,
  ),
)

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractKeywordTerms(text) {
  const raw = String(text).toLowerCase()
  const tokens = raw.match(/[0-9]+(?:[,.][0-9]+)?|[a-zæøå]+/gi) || []
  const out = []
  for (const tok of tokens) {
    const t = tok.trim()
    if (t.length < 2) continue
    if (t.length < 4 && /^\d+$/.test(t)) {
      out.push(t)
      continue
    }
    if (t.length < 4) continue
    if (NO_STOP.has(t)) continue
    out.push(t)
  }
  const seen = new Set()
  const uniq = []
  for (const t of out.sort((a, b) => b.length - a.length)) {
    if (seen.has(t)) continue
    seen.add(t)
    uniq.push(t)
  }
  return uniq.slice(0, 10)
}

/**
 * @param {string} s
 */
function escapeIlike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Kombiner siste brukermeldinger til bedre semantisk treff (oppfølgingsspørsmål).
 * @param {Array<{ role?: string, content?: unknown }>} messages
 * @param {string} lastUserText
 */
function buildRetrievalQuery(messages, lastUserText) {
  const users = []
  for (let i = messages.length - 1; i >= 0 && users.length < 4; i--) {
    const m = messages[i]
    if (m && m.role === 'user' && typeof m.content === 'string') {
      const c = m.content.trim()
      if (c) users.unshift(c)
    }
  }
  if (users.length <= 1) return lastUserText
  return users.join('\n---\n')
}

/**
 * Hent ekstra chunks via ILIKE på viktige ord (hybrid RAG).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} terms
 */
async function fetchKeywordSupplementChunks(supabase, terms) {
  if (KEYWORD_SUPPLEMENT <= 0 || !terms.length) return []
  const use = terms.slice(0, 8)
  const clauses = []
  for (const t of use) {
    if (t.length < 2) continue
    clauses.push(`content.ilike.%${escapeIlike(t)}%`)
  }
  if (!clauses.length) return []
  const orExpr = clauses.join(',')
  const { data, error } = await supabase
    .from('contract_chunks')
    .select('id, content, metadata')
    .or(orExpr)
    .limit(KEYWORD_SUPPLEMENT)

  if (error) {
    console.warn('contract-chat keyword supplement:', error.message)
    return []
  }
  return Array.isArray(data) ? data : []
}

/**
 * Vektor-treff først, deretter nøkkelord-treff uten duplikat-ID.
 * @param {unknown[]} vectorRows
 * @param {unknown[]} keywordRows
 */
function mergeVectorAndKeywordChunks(vectorRows, keywordRows) {
  const seen = new Set()
  const out = []
  for (const row of vectorRows) {
    const id = row && typeof row === 'object' && 'id' in row ? row.id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(row)
    if (out.length >= MAX_CONTEXT_CHUNKS) return out
  }
  for (const row of keywordRows) {
    const id = row && typeof row === 'object' && 'id' in row ? row.id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      ...row,
      similarity: 0.06,
      _keywordBoost: true,
    })
    if (out.length >= MAX_CONTEXT_CHUNKS) break
  }
  return out
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

    const retrievalQuery = buildRetrievalQuery(messages, lastUserText)
    const queryEmbedding = await embedQuery(retrievalQuery)

    const minSim = getContractRagMinSimilarity()
    let { data: rows, error: rpcError } = await supabase.rpc(
      'match_contract_chunks',
      {
        query_embedding: queryEmbedding,
        match_count: MATCH_COUNT,
        min_similarity: minSim,
      },
    )

    if (
      !rpcError &&
      minSim > 0 &&
      (!Array.isArray(rows) || rows.length === 0)
    ) {
      const retry = await supabase.rpc('match_contract_chunks', {
        query_embedding: queryEmbedding,
        match_count: MATCH_COUNT,
        min_similarity: 0,
      })
      rows = retry.data
      rpcError = retry.error
    }

    if (rpcError) {
      console.error('contract-chat rpc:', rpcError)
      res.status(500).json({
        error:
          rpcError.message ||
          'Kunne ikke hente treff fra databasen. Sjekk at SQL for match_contract_chunks er kjørt.',
      })
      return
    }

    const vectorChunks = Array.isArray(rows) ? rows : []
    if (vectorChunks.length === 0) {
      res.status(503).json({
        error:
          'Ingen indeksert kontrakttekst. Kjør: npm run ingest-contract-pdf -- /sti/til/kontrakt.pdf (i server-mappen).',
        reply: null,
      })
      return
    }

    const kwTerms = extractKeywordTerms(retrievalQuery)
    const kwRows = await fetchKeywordSupplementChunks(supabase, kwTerms)
    const chunks = mergeVectorAndKeywordChunks(vectorChunks, kwRows)

    const contextBlock = chunks
      .map((row, i) => {
        const content =
          row && typeof row.content === 'string' ? row.content.trim() : ''
        const meta =
          row && row.metadata && typeof row.metadata === 'object'
            ? JSON.stringify(row.metadata)
            : ''
        const sim =
          row &&
          typeof row.similarity === 'number' &&
          Number.isFinite(row.similarity)
            ? row.similarity.toFixed(3)
            : ''
        const src =
          row &&
          typeof row === 'object' &&
          '_keywordBoost' in row &&
          row._keywordBoost
            ? '+nøkkelord'
            : 'vektor'
        return `[Utdrag ${i + 1} kilde=${src}${meta ? ` meta=${meta}` : ''}${sim ? ` relevans=${sim}` : ''}]\n${content}`
      })
      .join('\n\n')

    const wantsQuote = /\b(sitat|sitere|ordrett|direkte\s+fra|hvor\s+står|pek\s+til|vis\s+meg|eksakt\s+ordlyd|siter|§\s*\d|paragraf)/i.test(
      lastUserText,
    )
    const quoteHint = wantsQuote
      ? '\nMERKNAD: Brukeren ber om ordlyd/sitat – prioriter **direkte gjengivelse fra KONTEKST** i «anførselstegn», med henvisning til utdragsnummer.\n'
      : ''

    const userSuggestsNumbers =
      /\b\d+[,.]?\d*\s*(m|meter|km|t|timer|min|dager|år|%)|\b\d{1,2}[.:]\d{2}\b/i.test(
        lastUserText,
      )
    const numberHint = userSuggestsNumbers
      ? `\nKRITISK – BRUKERFORESLÅTTE TALL I DENNE MELDINGEN:\nBrukerens siste melding inneholder konkrete tall eller mål. Du skal **aldri** bekrefte at «det står» at disse tallene gjelder, med mindre **eksakt samme tall** (samme verdi) finnes i KONTEKST og du viser det i «anførselstegn» fra et utdrag.\nHvis tallene ikke finnes ordrett i KONTEKST: si tydelig at du **ikke kan bekrefte** disse målene ut fra utdragene, og vis heller hva som faktisk står (sitér). Ikke gjenta brukerens tall som fakta uten slikt sitat.\n`
      : ''

    const systemPrompt = `Du er en kontrakt-RAG-assistent. Du har **kun** informasjon fra KONTEKST nedenfor (utdrag fra indeksert dokument). Du har ikke tilgang til hele kontrakten utenom disse utdragene. Utdrag kan komme fra **vektorsøk** og **nøkkelord-treff** (kilde=…) – bruk alle relevante utdrag før du konkluderer.
${quoteHint}${numberHint}
------------------------
ABSOLUTTE REGLER (MOT HALLUSINASJON)
------------------------

1) Oppfinn ALDRI §-numre, paragrafer, datoer, beløp, frister, partnavn eller konkrete formuleringer som ikke finnes i KONTEKST.
2) Ikke fyll ut med generell juss eller «typisk i kontrakter» – bare det som faktisk står eller sikkert følger av ordlyden i utdragene.
3) Før du sier at noe «ikke står» eller «ikke er spesifisert»: sjekk at ingen av utdragene inneholder relevante tall eller definisjoner. Hvis du er usikker, formulér: «I disse utdragene ser jeg ikke …» – ikke påstå at hele kontrakten mangler det.
4) **Ett sammenhengende svar uten selvmotsigelser.** Ikke først benekt og deretter bekrefte samme forhold uten å forklare at nye utdrag endrer bildet.
5) **Motstrid mellom utdrag:** Forklar i samme svar; ikke gi to uforenlige konklusjoner.

------------------------
BRUKERENS TALL (OPPFOLGING)
------------------------

- Når brukeren foreslår mål (f.eks. «3 meter», «5 meter») i et oppfølgingsspørsmål: bekreft bare hvis identiske tall finnes ordrett i KONTEKST med sitat. Ellers: avvis bekreftelsen og vis hva som faktisk står.

------------------------
SITAT OG ORDLYD
------------------------

- Ved spørsmål om grenser, mål, frister eller «hvor står det»: sitér relevante setninger fra KONTEKST i «anførselstegn» og angi **Utdrag N**.
- Avkort med … der nødvendig; ikke endre ordlyden.
- Finnes ikke i utdragene: si det – ikke oppfinn sitat.

------------------------
SVARSTIL
------------------------

- Svar direkte først; korte avsnitt. Markdown tillatt (**fet**, lister).
- Oppfølging: fakta kun fra KONTEKST; ikke anta at tidligere assistentsvar var korrekte uten sitat.

------------------------
INTERN SJEKK (IKKE SKRIV UT)
------------------------

Hvilke fraser i KONTEKST støtter hver påstand ordrett?

------------------------
FORBUDT I SVARET
------------------------

- Ingen [SVAR], [LOGIKK], [KILDE], [FORSTÅELSE] eller lignende.
- Ingen beskrivelse av intern tankeprosess.

KONTEKST:
${contextBlock}`

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
      temperature: 0.18,
      top_p: 0.9,
      max_tokens: 2048,
    })

    const rawReply = completion.choices?.[0]?.message?.content?.trim() || ''
    const reply = extractContractUserReply(rawReply)
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
