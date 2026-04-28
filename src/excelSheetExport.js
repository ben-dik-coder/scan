/** @typedef {{ id: string, cells: string[], vegLocked?: boolean[] }} ExcelSheetRow */

/** Gammelt format: kun label/value per rad. */
export const EXCEL_SHEET_LEGACY_V1 = 'scanix-excel-sheet-v1'

export const EXCEL_SHEET_STORAGE_KEY = 'scanix-excel-sheet-v2'

export const DEFAULT_EXCEL_HEADERS = [
  'Beskrivelse',
  'Verdi',
  'Vegvei',
  'Vegnr',
  'S',
  'D',
  'Meter',
]

const MIN_COLS = 2

/**
 * @param {string} h
 */
function isVegHeaderName(h) {
  const x = String(h).trim().toLowerCase()
  return (
    x === 'vegvei' ||
    x === 'vegnr' ||
    x === 'vegnummer' ||
    x === 's' ||
    x === 'd' ||
    x === 'meter'
  )
}

/**
 * @param {unknown} vl
 * @param {number} n
 * @param {string[]} headers
 */
function padVegLockedPerRow(vl, n, headers) {
  const a = Array.isArray(vl) ? vl.map((x) => Boolean(x)) : []
  while (a.length < n) a.push(false)
  const out = a.slice(0, n)
  for (let j = 0; j < n; j++) {
    if (!isVegHeaderName(headers[j])) out[j] = false
  }
  return out
}

/**
 * @returns {{ headers: string[], rows: ExcelSheetRow[] }}
 */
export function defaultExcelSheetState() {
  const headers = [...DEFAULT_EXCEL_HEADERS]
  const n = headers.length
  return {
    headers,
    rows: Array.from({ length: 5 }, () => ({
      id: crypto.randomUUID(),
      cells: Array.from({ length: n }, () => ''),
      vegLocked: Array(n).fill(false),
    })),
  }
}

/**
 * @param {string[]} cells
 * @param {number} n
 */
function padCells(cells, n) {
  const out = cells.slice()
  while (out.length < n) out.push('')
  while (out.length > n) out.pop()
  return out
}

/**
 * @param {unknown} s
 * @returns {{ headers: string[], rows: ExcelSheetRow[] }}
 */
export function normalizeExcelSheetState(s) {
  if (!s || typeof s !== 'object') return defaultExcelSheetState()
  const o = /** @type {{ headers?: unknown, rows?: unknown, vegColLocked?: unknown }} */ (
    s
  )
  let headers = Array.isArray(o.headers)
    ? o.headers.map((h) => (typeof h === 'string' ? h : ''))
    : []
  if (headers.length === 0) return defaultExcelSheetState()
  if (headers.length < MIN_COLS) {
    while (headers.length < MIN_COLS)
      headers.push(`Kolonne ${headers.length + 1}`)
  }
  const n = headers.length
  let rows = Array.isArray(o.rows) ? o.rows : []
  rows = rows.map((r) => {
    const row = /** @type {{ id?: unknown, cells?: unknown, vegLocked?: unknown }} */ (
      r
    )
    const id =
      row && typeof row.id === 'string' ? row.id : crypto.randomUUID()
    const raw = Array.isArray(row?.cells) ? row.cells : []
    const cells = padCells(
      raw.map((c) => (typeof c === 'string' ? c : String(c ?? ''))),
      n,
    )
    const vegLocked = padVegLockedPerRow(row?.vegLocked, n, headers)
    return { id, cells, vegLocked }
  })
  while (rows.length < 5) {
    rows.push({
      id: crypto.randomUUID(),
      cells: Array(n).fill(''),
      vegLocked: Array(n).fill(false),
    })
  }

  /** @deprecated kolonnenivå — migreres til per-celle */
  const legacyColLocked = Array.isArray(o.vegColLocked)
    ? o.vegColLocked.map((x) => Boolean(x))
    : []
  while (legacyColLocked.length < n) legacyColLocked.push(false)
  if (legacyColLocked.some(Boolean)) {
    for (let j = 0; j < n; j++) {
      if (!legacyColLocked[j] || !isVegHeaderName(headers[j])) continue
      for (const r of rows) {
        r.vegLocked[j] = true
      }
    }
  }

  return { headers, rows }
}

/**
 * @returns {{ headers: string[], rows: ExcelSheetRow[] }}
 */
export function loadExcelSheetState() {
  try {
    const raw = localStorage.getItem(EXCEL_SHEET_STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (
        data &&
        data.version === 2 &&
        Array.isArray(data.headers) &&
        Array.isArray(data.rows)
      ) {
        return normalizeExcelSheetState(data)
      }
    }
    const v1 = localStorage.getItem(EXCEL_SHEET_LEGACY_V1)
    if (v1) {
      const old = JSON.parse(v1)
      if (Array.isArray(old) && old.length) {
        const headers = [...DEFAULT_EXCEL_HEADERS]
        const n = headers.length
        const rows = old.map((r) => {
          const row = /** @type {{ id?: unknown, label?: unknown, value?: unknown }} */ (
            r
          )
          return {
            id: typeof row?.id === 'string' ? row.id : crypto.randomUUID(),
            cells: padCells(
              [
                typeof row?.label === 'string' ? row.label : '',
                typeof row?.value === 'string' ? row.value : '',
                ...Array(Math.max(0, n - 2)).fill(''),
              ],
              n,
            ),
          }
        })
        return normalizeExcelSheetState({ headers, rows })
      }
    }
  } catch {
    /* ignore */
  }
  return defaultExcelSheetState()
}

/**
 * @param {{ headers: string[], rows: ExcelSheetRow[] }} state
 */
export function saveExcelSheetState(state) {
  try {
    const n = normalizeExcelSheetState(state)
    localStorage.setItem(
      EXCEL_SHEET_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        headers: n.headers,
        rows: n.rows,
      }),
    )
    try {
      localStorage.removeItem(EXCEL_SHEET_LEGACY_V1)
    } catch {
      /* ignore */
    }
  } catch {
    /* quota */
  }
}

export function resetExcelSheetState() {
  const s = defaultExcelSheetState()
  saveExcelSheetState(s)
  return s
}

/** Bakoverkompatibel: returnerer kun rader (v2-modell). */
export function loadExcelSheetRows() {
  return loadExcelSheetState().rows
}

/** Bakoverkompatibel: erstatter rader, beholder overskrifter og låser fra lagring. */
export function saveExcelSheetRows(rows) {
  const st = loadExcelSheetState()
  st.rows = rows
  saveExcelSheetState(st)
}

export function resetExcelSheetRows() {
  return resetExcelSheetState().rows
}

/**
 * @param {string[]} headers
 * @param {string[][]} rows
 * @param {string} [filenameBase] Uten .xlsx; standard scanix-data-…
 */
export async function downloadExcelSheetGrid(headers, rows, filenameBase) {
  const XLSX = await import('xlsx')
  const head = headers.map((h) => (h == null ? '' : String(h)))
  const body = rows.map((r) =>
    r.map((c) => (c == null ? '' : String(c))),
  )
  const aoa = [head, ...body]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  const stamp = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const base =
    typeof filenameBase === 'string' && filenameBase.trim()
      ? filenameBase.trim().replace(/[/\\?%*:|"<>]/g, '-')
      : `scanix-data-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`
  const fname = `${base}.xlsx`
  XLSX.writeFile(wb, fname)
}

/** 96 dpi: punkter → skjempiksler (samme som Excel bruker for kolonnebredder i px). */
const EXCEL_PT_TO_PX = 96 / 72

/**
 * @param {import('xlsx').WorkSheet} ws
 * @param {typeof import('xlsx')} XLSX
 * @param {{ rowHeightPt?: number, colWidthPt?: number }} opts
 */
function applyWorksheetPtDimensions(ws, XLSX, opts) {
  const ref = ws['!ref']
  if (!ref || typeof ref !== 'string') return
  const range = XLSX.utils.decode_range(ref)
  const nRow = range.e.r - range.s.r + 1
  const nCol = range.e.c - range.s.c + 1
  const rowH = opts.rowHeightPt
  if (typeof rowH === 'number' && Number.isFinite(rowH) && rowH > 0) {
    ws['!rows'] = Array.from({ length: nRow }, () => ({ hpt: rowH }))
  }
  const colW = opts.colWidthPt
  if (typeof colW === 'number' && Number.isFinite(colW) && colW > 0) {
    const wpx = Math.round(colW * EXCEL_PT_TO_PX)
    ws['!cols'] = Array.from({ length: nCol }, () => ({ wpx }))
  }
}

/**
 * Bygger .xlsx som Blob (for deling/nedlasting på mobil der writeFile er upålitelig).
 * @param {string[][]} aoa Første rad = overskrifter
 * @param {string} [sheetName]
 * @param {{ rowHeightPt?: number, colWidthPt?: number }} [dimOpts] Radhøyde/kolonnebredde i punkter (pt)
 * @returns {Promise<Blob>}
 */
export async function excelAoaToXlsxBlob(aoa, sheetName = 'Data', dimOpts = {}) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  if (dimOpts.rowHeightPt != null || dimOpts.colWidthPt != null) {
    applyWorksheetPtDimensions(ws, XLSX, dimOpts)
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Friksjonsmåling: én rad per strekning — vegnavn/vegnr/S/D fra start, meterteller ved Start- og Stopp-trykk.
 * @param {Array<{
 *   distanceM: number,
 *   value: number,
 *   createdAt: string,
 *   startVegref?: { vegnavn?: string, vegnr?: string, s?: string, d?: string, meter?: string } | null,
 *   endVegref?: { vegnavn?: string, vegnr?: string, s?: string, d?: string, meter?: string } | null,
 * }>} measurements
 */
export async function downloadFrictionMeasurementsXlsx(measurements) {
  const headers = [
    'Vegnavn',
    'Vegnr',
    'S',
    'D',
    'Meter_start',
    'Meter_stopp',
    'Strekning_m',
    'Friksjon',
    'Tidspunkt',
  ]
  /** @param {number} m */
  const distStr = (m) => {
    if (typeof m !== 'number' || !Number.isFinite(m)) return ''
    const rounded = Math.round(m * 10) / 10
    return String(rounded).replace('.', ',')
  }
  /** @param {number} v */
  const valStr = (v) =>
    typeof v === 'number' && Number.isFinite(v) ? String(v).replace('.', ',') : ''
  /**
   * @param {{ vegnavn?: string, vegnr?: string, s?: string, d?: string, meter?: string } | null | undefined} snap
   */
  const snapStr = (snap, k) => {
    if (!snap || typeof snap !== 'object') return ''
    const v = /** @type {Record<string, unknown>} */ (snap)[k]
    if (v === undefined || v === null) return ''
    if (typeof v === 'number' && Number.isFinite(v)) {
      return k === 'meter' ? String(Math.round(v)) : String(v)
    }
    const t = String(v).trim()
    if (t === '–' || t === '-') return ''
    return t
  }
  const sorted = [...measurements].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const rows = []
  for (const m of sorted) {
    const sv = m.startVegref
    const ev = m.endVegref
    rows.push([
      snapStr(sv, 'vegnavn'),
      snapStr(sv, 'vegnr'),
      snapStr(sv, 's'),
      snapStr(sv, 'd'),
      snapStr(sv, 'meter'),
      snapStr(ev, 'meter'),
      distStr(m.distanceM),
      valStr(m.value),
      typeof m.createdAt === 'string' ? m.createdAt : '',
    ])
  }
  const stamp = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fname = `scanix-friksjon-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`
  await downloadExcelSheetGrid(headers, rows, fname)
}
