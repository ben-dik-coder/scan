/**
 * POST /api/contract-chat — RAG mot contract_chunks (Supabase pgvector).
 * Krever: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Kvalitet: stort vektor-trekk → hybrid merge → (valgfritt) query-utvidelse ved embedding
 * → LLM-rerank til færre, mest relevante utdrag → svarmodell.
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

import { modelSupportsCustomTemperature } from './openaiModelHelpers.js'

const EMBEDDING_MODEL =
  process.env.CONTRACT_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small'
const EMBEDDING_DIM = Math.min(
  3072,
  Math.max(256, Number(process.env.CONTRACT_EMBEDDING_DIM || 1536)),
)
const CHAT_MODEL = process.env.OPENAI_CONTRACT_MODEL || 'gpt-5-mini'

/** Vektor-treff fra DB (pool før rerank). Må matche eller underskride match_contract_chunks limit (100). */
const POOL_MATCH_COUNT = Math.min(
  80,
  Math.max(8, Number(process.env.CONTRACT_RAG_POOL_MATCH_COUNT || 36)),
)

/** Maks utdrag etter vektor+nøkkelord før rerank (kap på token til reranker). */
const MERGE_POOL_MAX = Math.min(
  64,
  Math.max(12, Number(process.env.CONTRACT_RAG_MERGE_POOL_MAX || 52)),
)

/** Utdrag sendt til svarmodellen etter rerank (kvalitet > kvantitet). */
const MAX_CONTEXT_CHUNKS = Math.min(
  28,
  Math.max(8, Number(process.env.CONTRACT_RAG_MAX_CONTEXT_CHUNKS || 16)),
)

const KEYWORD_SUPPLEMENT = Math.min(
  20,
  Math.max(0, Number(process.env.CONTRACT_RAG_KEYWORD_SUPPLEMENT || 14)),
)

const RERANK_MODEL =
  process.env.CONTRACT_RAG_RERANK_MODEL?.trim() || 'gpt-4o-mini'
const RERANK_INPUT_MAX = Math.min(
  40,
  Math.max(12, Number(process.env.CONTRACT_RAG_RERANK_INPUT_MAX || 32)),
)

/** Lavere standard = kortere svar (kan økes med CONTRACT_RAG_MAX_COMPLETION_TOKENS). */
const MAX_COMPLETION_TOKENS = Math.min(
  4096,
  Math.max(400, Number(process.env.CONTRACT_RAG_MAX_COMPLETION_TOKENS || 1100)),
)

/** Svarmodell: høyere = mer variert resonnement (gpt-5 ignorerer temperature). */
function getContractChatTemperature() {
  const v = process.env.CONTRACT_RAG_TEMPERATURE
  if (v == null || String(v).trim() === '') return 0.35
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.35
}

function isEnvEnabled(name, defaultTrue = true) {
  const v = process.env[name]
  if (v == null || String(v).trim() === '') return defaultTrue
  const s = String(v).trim().toLowerCase()
  if (['0', 'false', 'off', 'no'].includes(s)) return false
  if (['1', 'true', 'on', 'yes'].includes(s)) return true
  return defaultTrue
}

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

function getOpenAiTimeoutMs() {
  const v = process.env.OPENAI_TIMEOUT_MS
  if (v == null || String(v).trim() === '') return 720_000
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(1_800_000, Math.max(60_000, n)) : 720_000
}

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY
  if (!key?.trim()) return null
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: key.trim(),
      timeout: getOpenAiTimeoutMs(),
    })
  }
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
    input: t.length > 8000 ? t.slice(0, 8000) : t,
    dimensions: EMBEDDING_DIM,
  })
  const emb = res.data?.[0]?.embedding
  if (!Array.isArray(emb) || emb.length !== EMBEDDING_DIM) {
    throw new Error('Ugyldig embedding-svar fra OpenAI.')
  }
  return emb
}

const QUERY_EXPAND_MODEL =
  process.env.CONTRACT_RAG_QUERY_EXPAND_MODEL?.trim() || 'gpt-4o-mini'

/**
 * Utvider brukerens spørsmål med fagord/synonymer for bedre vektor-treff (valgfritt).
 * @param {OpenAI} openai
 * @param {string} query
 */
async function expandQueryForRetrieval(openai, query) {
  const q = String(query).trim()
  if (!q || q.length > 12_000) return q
  const completion = await openai.chat.completions.create({
    model: QUERY_EXPAND_MODEL,
    response_format: { type: 'json_object' },
    max_completion_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'Du hjelper med semantisk søk i norske anskaffelses-/veikontrakter (drift, vedlikehold, veg, grøfter, snø, merking). Returner JSON: {"search_text":"..."} der search_text er én kort søkeforespørsel (2–5 setninger) som gjengir brukerens intensjon og legger til relevante fagord, prosess-/kapittelhenvisninger hvis brukeren nevnte dem, og nære synonymer. Ikke svar på spørsmålet; ikke moraliser. Hvis teksten allerede er presis, kan du returnere den nesten uendret i search_text.',
      },
      { role: 'user', content: q },
    ],
  })
  const raw = completion.choices?.[0]?.message?.content?.trim() || ''
  try {
    const parsed = JSON.parse(raw)
    const st =
      parsed && typeof parsed.search_text === 'string'
        ? parsed.search_text.trim()
        : ''
    if (st.length >= 8) {
      return `${q}\n\n${st}`.slice(0, 8000)
    }
  } catch {
    /* fall back */
  }
  return q
}

/**
 * Velger de mest relevante utdragene for svarmodellen (reduserer støy og «nesten riktige» chunks).
 * @param {OpenAI} openai
 * @param {string} userQuery
 * @param {unknown[]} chunks rader med id, content, similarity, metadata
 * @param {number} targetK
 */
async function rerankRetrievalChunks(openai, userQuery, chunks, targetK) {
  if (!chunks.length || chunks.length <= targetK) {
    return /** @type {any[]} */ (chunks)
  }
  const pool = chunks.slice(
    0,
    Math.min(chunks.length, RERANK_INPUT_MAX),
  )
  const previews = pool.map((row, i) => {
    const content =
      row && typeof row === 'object' && row !== null && 'content' in row
        ? String(/** @type {{ content?: string }} */ (row).content ?? '')
        : ''
    const excerpt = content.trim().slice(0, 1450)
    return `[${i}]\n${excerpt}${content.length > 1450 ? '\n…' : ''}`
  })
  const listing = previews.join('\n\n---\n\n')
  const completion = await openai.chat.completions.create({
    model: RERANK_MODEL,
    response_format: { type: 'json_object' },
    max_completion_tokens: 500,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: `Du rangerer utdrag fra et kontraktsdokument etter relevans for brukerens spørsmål. Returner JSON: {"indices":[...]} der indices er en liste av 0-baserte indekser (0–${pool.length - 1}), sortert fra mest til minst relevant. Inkluder maks ${targetK} indekser. Utelat indekser som ikke hjelper med å besvare spørsmålet. Ved tvil: inkluder utdrag som kan inneholde sitatbar ordlyd.`,
      },
      {
        role: 'user',
        content: `SPØRSMÅL:\n${String(userQuery).slice(0, 6000)}\n\nNUMMERERTE UTDDRAG:\n${listing}`,
      },
    ],
  })
  const raw = completion.choices?.[0]?.message?.content?.trim() || ''
  let indices = []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.indices)) {
      indices = parsed.indices
        .map((n) => (typeof n === 'number' ? n : parseInt(String(n), 10)))
        .filter((n) => Number.isFinite(n) && n >= 0 && n < pool.length)
    }
  } catch {
    return /** @type {any[]} */ (pool.slice(0, targetK))
  }
  const seen = new Set()
  const ordered = []
  for (const idx of indices) {
    if (seen.has(idx)) continue
    seen.add(idx)
    ordered.push(pool[idx])
    if (ordered.length >= targetK) break
  }
  if (ordered.length === 0) {
    return /** @type {any[]} */ (pool.slice(0, targetK))
  }
  return ordered
}

/**
 * Kun tekst til sluttbruker: stripper [FORSTÅELSE]/[SVAR]/[LOGIKK]/[KILDE] hvis modellen
 * fortsatt sender gammelt strukturformat.
 * @param {string} raw
 */
/**
 * OpenAI kan returnere assistant.content som streng eller liste (gpt-5 m.fl.).
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
        if (typeof p.output_text === 'string') return p.output_text
        return ''
      })
      .join('')
  }
  if (c == null) {
    if (typeof m.output_text === 'string') return m.output_text
    return ''
  }
  return String(c)
}

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
 * @param {number} maxPool maks antall rader før rerank
 */
function mergeVectorAndKeywordChunks(vectorRows, keywordRows, maxPool) {
  const cap = Math.max(MAX_CONTEXT_CHUNKS, maxPool)
  const seen = new Set()
  const out = []
  for (const row of vectorRows) {
    const id = row && typeof row === 'object' && 'id' in row ? row.id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(row)
    if (out.length >= cap) return out
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
    if (out.length >= cap) break
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
    const queryExpandOn = isEnvEnabled('CONTRACT_RAG_QUERY_EXPAND', true)
    const textForEmbedding = queryExpandOn
      ? await expandQueryForRetrieval(openai, retrievalQuery)
      : retrievalQuery
    const queryEmbedding = await embedQuery(textForEmbedding)

    const minSim = getContractRagMinSimilarity()
    let { data: rows, error: rpcError } = await supabase.rpc(
      'match_contract_chunks',
      {
        query_embedding: queryEmbedding,
        match_count: POOL_MATCH_COUNT,
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
        match_count: POOL_MATCH_COUNT,
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
    let chunks = mergeVectorAndKeywordChunks(
      vectorChunks,
      kwRows,
      MERGE_POOL_MAX,
    )

    const rerankOn = isEnvEnabled('CONTRACT_RAG_RERANK', true)
    if (rerankOn && chunks.length > MAX_CONTEXT_CHUNKS) {
      try {
        chunks = await rerankRetrievalChunks(
          openai,
          retrievalQuery,
          chunks,
          MAX_CONTEXT_CHUNKS,
        )
      } catch (reErr) {
        console.warn('contract-chat rerank:', reErr)
        chunks = /** @type {any[]} */ (chunks).slice(0, MAX_CONTEXT_CHUNKS)
      }
    } else if (chunks.length > MAX_CONTEXT_CHUNKS) {
      chunks = /** @type {any[]} */ (chunks).slice(0, MAX_CONTEXT_CHUNKS)
    }

    const contextBlock = chunks
      .map((row) => {
        const content =
          row && typeof row.content === 'string' ? row.content.trim() : ''
        return content
      })
      .filter(Boolean)
      .join('\n\n---\n\n')

    const wantsQuote = /\b(sitat|sitere|ordrett|direkte\s+fra|hvor\s+står|pek\s+til|vis\s+meg|eksakt\s+ordlyd|siter|§\s*\d|paragraf)/i.test(
      lastUserText,
    )
    const quoteHint = wantsQuote
      ? '\nSPESIELT NÅ: Brukeren vil ha ordlyd – **sitér ordrett** fra KONTEKST i «anførselstegn». Korte sitater; ikke parafraser når ordlyd er poenget.\n'
      : ''

    const userSuggestsNumbers =
      /\b\d+[,.]?\d*\s*(m|meter|km|t|timer|min|dager|år|%)|\b\d{1,2}[.:]\d{2}\b/i.test(
        lastUserText,
      )
    const numberHint = userSuggestsNumbers
      ? `\nSPESIELT NÅ – TALL I BRUKERENS MELDING:\nKonkrete tall eller mål er nevnt. Si **aldri** at kontrakten «sier» eller «fastsetter» disse tallene med mindre **samme verdi** står ordrett i KONTEKST (vis i «anførselstegn»). Finnes ikke tallet der: si at du **ikke ser det** i den teksten du har, og vis hva som faktisk står. Ikke gjenta brukerens tall som fakta uten sitat.\n`
      : ''

    const systemPrompt = `Du er **fagassistent for kontraktsoppfølging** (vei, drift, vedlikehold, anskaffelse). Du svarer på **norsk**, praktisk og presist, for folk som jobber i felt eller drift.

## Lengde og relevans (viktig)
- Hold svaret **kort og treffsikkert**: som hovedregel **maks om lag 120–200 ord**, med mindre brukeren uttrykkelig ber om mer detaljer, full gjennomgang eller «alt som gjelder».
- **Svar først** med konklusjon eller direkte svar i **1–3 korte setninger**; deretter bare **nødvendig** presisering (punktliste der det hjelper).
- **Ikke gjenta** samme poeng; unngå lange innledninger og generelle oppsummeringer av hele kontrakten når spørsmålet er smalt.
- Ta med **kun det som er relevant** for spørsmålet; ikke fyll med relatert stoff som ikke trengs for å svare.

## To lag i svaret (bruk begge når det hjelper – men kompakt)
1. **Kontrakten / dokumentet** – det som faktisk står i **KONTEKST** nedenfor (indekserte tekstbiter, skilt med \`---\`). Dette er **ikke** nødvendigvis hele kontrakten; det kan mangle sider og sammenheng.
2. **Resonnement utenfor ordrett kontrakt** – du **kan** bruke sunn faglig fornuft og praktiske råd når det **kort** hjelper. **Merk tydelig** hva som er *fra kontrakten* vs *vurdering/råd* (f.eks. **I kontrakten** / **Vurdering**), men ikke skriv mer enn nødvendig.

${quoteHint}${numberHint}
## Streng regel bare for «hva står det i kontrakten»
- Når du sier at kontrakten **krever**, **sier**, **fastsetter** eller **henviser til** noe konkret (§, prosess, tall, frist, kode, ordlyd): da skal det **kunne spores til KONTEKST** – sitér med «anførselstegn» eller parafraser nøyaktig. **Oppfinn ikke** §-numre, prosesser, beløp, datoer eller formuleringer som ikke finnes i KONTEKST.
- Hvis brukeren bare spør «hva mener du», «hva bør vi gjøre», «er dette lurt»: du **trenger ikke** begrense deg til KONTEKST – gi et **kort** begrunnet svar og koble til kontrakten der det er relevant.

## Fleksibilitet og resonnement
- **Tolk** og **sammenlign** gjerne deler av KONTEKST når det er poenget; unngå lange steg-for-steg-forklaringer med mindre brukeren ber om det.
- Du kan trekke inn **generell kunnskap** – merk det som egen vurdering, ikke som direkte sitat fra kontrakten.
- **Ikke skjul usikkerhet**: «Jeg ser ikke dette i teksten jeg har», «Her er jeg mer usikker, men …»

## Motstrid og tidligere meldinger
- Hvis KONTEKST er motstridende: forklar det **kort** i ett svar.
- Tidligere assistentsvar i tråden kan være feil – verifiser mot KONTEKST når det gjelder **kontraktsinnhold**.

## Sitater og tall (når ordlyd teller)
- Ved spørsmål om *hvor det står*, eksakte krav eller grenser: **sitér** fra KONTEKST i «anførselstegn»; ikke referer til intern nummerering av utdrag.
- Tall brukeren foreslår: si ikke at kontrakten «sier» disse tallene uten at **samme verdi** står i KONTEKST (sitér).

## Svarstruktur
1. **Kjernen først** – direkte svar.
2. Deretter **maks nødvendig** kontrakthenvisning eller punktliste.
3. Markdown tillatt (**fet**, korte lister, små overskrifter).

## Ikke bruk disse formatene
- Ingen [SVAR], [LOGIKK], [KILDE], [FORSTÅELSE] eller lignende tagger.
- Ingen «Utdrag 1/4» eller intern chunk-nummerering.

## Før du svarer (internt — skal ikke erstatte brukersvaret)
Tenk kort gjennom: (a) hva som er fakta fra KONTEKST, (b) hva som er egen vurdering. **Svaret du skriver i denne samtalen skal alltid være et fullstendig, synlig svar til brukeren** på norsk (konklusjon først). Ikke svar med kun stillhet, tom tekst eller «intern sjekk» uten faglig innhold.

---
KONTEKST:
${contextBlock}`

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content ?? ''),
      })),
    ]

    const completionOpts = {
      model: CHAT_MODEL,
      messages: /** @type {any} */ (chatMessages),
      max_completion_tokens: MAX_COMPLETION_TOKENS,
    }
    if (modelSupportsCustomTemperature(CHAT_MODEL)) {
      completionOpts.temperature = getContractChatTemperature()
      completionOpts.top_p = 0.92
    }
    const completion = await openai.chat.completions.create(completionOpts)

    const rawReply = textFromAssistantMessage(
      completion.choices?.[0]?.message,
    ).trim()
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
