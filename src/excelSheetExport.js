export const EXCEL_SHEET_STORAGE_KEY = 'scanix-excel-sheet-v1'

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
 * @param {{ label: string, value: string }[]} rows
 */
export async function downloadExcelSheet(rows) {
  const XLSX = await import('xlsx')
  const aoa = [['Beskrivelse', 'Verdi'], ...rows.map((r) => [r.label ?? '', r.value ?? ''])]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  const stamp = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fname = `scanix-data-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.xlsx`
  XLSX.writeFile(wb, fname)
}
