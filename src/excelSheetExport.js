export const EXCEL_SHEET_STORAGE_KEY = 'scanix-excel-sheet-v1'
export const EXCEL_INCLUDE_VEGREF_KEY = 'scanix-excel-include-vegref-v1'

/**
 * @returns {boolean}
 */
export function loadExcelIncludeVegref() {
  try {
    return localStorage.getItem(EXCEL_INCLUDE_VEGREF_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * @param {boolean} on
 */
export function saveExcelIncludeVegref(on) {
  try {
    localStorage.setItem(EXCEL_INCLUDE_VEGREF_KEY, on ? '1' : '0')
  } catch {
    /* quota */
  }
}

/**
 * @returns {{ id: string, label: string, value: string }[]}
 */
function defaultRows() {
  return Array.from({ length: 5 }, () => ({
    id: crypto.randomUUID(),
    label: '',
    value: '',
  }))
}

/**
 * @returns {{ id: string, label: string, value: string }[]}
 */
export function loadExcelSheetRows() {
  try {
    const raw = localStorage.getItem(EXCEL_SHEET_STORAGE_KEY)
    if (!raw) return defaultRows()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultRows()
    return parsed.map((r) => ({
      id: typeof r?.id === 'string' ? r.id : crypto.randomUUID(),
      label: typeof r?.label === 'string' ? r.label : '',
      value: typeof r?.value === 'string' ? r.value : '',
    }))
  } catch {
    return defaultRows()
  }
}

/**
 * @param {{ id: string, label: string, value: string }[]} rows
 */
export function saveExcelSheetRows(rows) {
  try {
    localStorage.setItem(EXCEL_SHEET_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    /* quota */
  }
}

export function resetExcelSheetRows() {
  const rows = defaultRows()
  saveExcelSheetRows(rows)
  return rows
}

/**
 * @param {Array<{
 *   label: string,
 *   value: string,
 *   vegvei?: string,
 *   vegnr?: string,
 *   s?: string,
 *   d?: string,
 *   meter?: string,
 * }>} rows
 * @param {{ includeVegref?: boolean }} [opts]
 */
export async function downloadExcelSheet(rows, opts = {}) {
  const includeVegref = Boolean(opts.includeVegref)
  const XLSX = await import('xlsx')
  const head = includeVegref
    ? ['Beskrivelse', 'Verdi', 'Vegvei', 'Vegnr', 'S', 'D', 'Meter']
    : ['Beskrivelse', 'Verdi']
  const body = includeVegref
    ? rows.map((r) => [
        r.label ?? '',
        r.value ?? '',
        r.vegvei ?? '',
        r.vegnr ?? '',
        r.s ?? '',
        r.d ?? '',
        r.meter ?? '',
      ])
    : rows.map((r) => [r.label ?? '', r.value ?? ''])
  const aoa = [head, ...body]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  const stamp = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fname = `scanix-data-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.xlsx`
  XLSX.writeFile(wb, fname)
}
