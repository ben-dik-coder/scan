/** @typedef {{ id: string, cells: string[] }} ExcelSheetRow */

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
 * @returns {{ headers: string[], rows: ExcelSheetRow[], vegColLocked: boolean[] }}
 */
export function defaultExcelSheetState() {
  const headers = [...DEFAULT_EXCEL_HEADERS]
  const n = headers.length
  return {
    headers,
    rows: Array.from({ length: 5 }, () => ({
      id: crypto.randomUUID(),
      cells: Array.from({ length: n }, () => ''),
    })),
    vegColLocked: Array(n).fill(false),
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
 * @returns {{ headers: string[], rows: ExcelSheetRow[], vegColLocked: boolean[] }}
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
    const row = /** @type {{ id?: unknown, cells?: unknown }} */ (r)
    const id =
      row && typeof row.id === 'string' ? row.id : crypto.randomUUID()
    const raw = Array.isArray(row?.cells) ? row.cells : []
    const cells = padCells(
      raw.map((c) => (typeof c === 'string' ? c : String(c ?? ''))),
      n,
    )
    return { id, cells }
  })
  while (rows.length < 5) {
    rows.push({ id: crypto.randomUUID(), cells: Array(n).fill('') })
  }
  let vegColLocked = Array.isArray(o.vegColLocked)
    ? o.vegColLocked.map((x) => Boolean(x))
    : []
  while (vegColLocked.length < n) vegColLocked.push(false)
  vegColLocked = vegColLocked.slice(0, n)
  return { headers, rows, vegColLocked }
}

/**
 * @returns {{ headers: string[], rows: ExcelSheetRow[], vegColLocked: boolean[] }}
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
 * @param {{ headers: string[], rows: ExcelSheetRow[], vegColLocked?: boolean[] }} state
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
        vegColLocked: n.vegColLocked,
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
 */
export async function downloadExcelSheetGrid(headers, rows) {
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
  const fname = `scanix-data-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.xlsx`
  XLSX.writeFile(wb, fname)
}
