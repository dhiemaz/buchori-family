import { v4 as uuidv4 } from 'uuid'

// Internal column keys — used as object property names throughout the app
export const HEADERS = [
  'id',
  'fullName',
  'birthdate',
  'gender',
  'isAlive',
  'passedDate',
  'phone',
  'whatsapp',
  'maritalStatus',
  'parentFullName',
  'spouseOfFullName',
]

// Indonesian display names used as column headers in CSV / Google Sheets
export const HEADER_LABELS = {
  id:               'ID Anggota',
  fullName:         'Nama Lengkap',
  birthdate:        'Tanggal Lahir',
  gender:           'Jenis Kelamin',
  isAlive:          'Keterangan Hidup',
  passedDate:       'Tanggal Wafat',
  phone:            'No Telepon',
  whatsapp:         'Whatsapp',
  parentFullName:   'Nama Lengkap Orang Tua (Ayah)',
  spouseOfFullName: 'Nama Lengkap Orang Tua (Ibu)',
  maritalStatus:    'Status Pernikahan',
}

// Ordered Indonesian column header row for export
export const SHEET_HEADERS = HEADERS.map(h => HEADER_LABELS[h])

// ── Date helpers ──────────────────────────────────────────────────────────────

// YYYY-MM-DD  →  DD/MM/YYYY  (for sheet display)
function toSheetDate(isoDate) {
  if (!isoDate) return ''
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate
}

// DD/MM/YYYY  →  YYYY-MM-DD  (for HTML date input / internal storage)
function fromSheetDate(val) {
  if (!val) return ''
  const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return val  // already YYYY-MM-DD or unknown — keep as-is
}

// ── Column index builder ──────────────────────────────────────────────────────
// Returns { internalKey: columnIndex } for an arbitrary header row.
// Matches by Indonesian label first, then English internal key (backward compat).

export function buildColIdx(sheetHeaders) {
  const colIdx = {}
  HEADERS.forEach(h => {
    const label = (HEADER_LABELS[h] || h).toLowerCase()
    const key   = h.toLowerCase()
    colIdx[h] = sheetHeaders.findIndex(sh => {
      const s = sh.toLowerCase()
      return s === label || s === key
    })
  })
  return colIdx
}

// ── Shared serialization ──────────────────────────────────────────────────────

// Convert members array → array of value-arrays (one per member, no header row)
export function membersToRows(members) {
  const byId = Object.fromEntries(members.map(m => [m.id, m]))
  return members.map(m => {
    const parent   = m.parentId   ? byId[m.parentId]   : null
    const spouseOf = m.spouseOfId ? byId[m.spouseOfId] : null
    return [
      m.id,
      m.fullName,
      toSheetDate(m.birthdate),            // DD/MM/YYYY
      m.gender === 'female' ? 'P' : 'L',  // Jenis Kelamin: L | P
      m.isAlive ? 'Hidup' : 'Wafat',      // Keterangan Hidup
      m.isAlive ? 'N/A' : (m.passedDate || ''),
      m.phone        || '',
      m.whatsapp     || '',
      m.maritalStatus || '',
      parent?.fullName   || '',
      spouseOf?.fullName || '',
    ]
  })
}

// Convert array of row-objects (keyed by HEADERS internal keys) → members array
// Handles both Indonesian values (L/P, Hidup/Wafat) and legacy English values.
export function parseRowsToMembers(rawRows) {
  const nameToId = {}
  rawRows.forEach(row => {
    row._newId = uuidv4()
    if (!nameToId[row.fullName]) nameToId[row.fullName] = row._newId
  })

  return rawRows.map(row => {
    const parentId   = row.parentFullName   ? (nameToId[row.parentFullName]   ?? null) : null
    const spouseOfId = row.spouseOfFullName ? (nameToId[row.spouseOfFullName] ?? null) : null

    let relation = 'root'
    if (spouseOfId)    relation = 'spouse'
    else if (parentId) relation = 'kid'

    // Indonesian: 'Wafat' | legacy English: 'no'/'false'/'0'
    const isAliveStr = (row.isAlive || '').toLowerCase()
    const isAlive    = !['no', 'false', '0', 'wafat'].includes(isAliveStr)

    // Indonesian: 'P'/'Perempuan' | legacy English: 'female'
    const genderStr  = (row.gender || '').toLowerCase()
    const gender     = ['p', 'female', 'perempuan'].includes(genderStr) ? 'female' : 'male'

    return {
      id:            row._newId,
      fullName:      row.fullName,
      birthdate:     fromSheetDate(row.birthdate),
      gender,
      isAlive,
      passedDate:    (!isAlive && row.passedDate) ? row.passedDate : null,
      phone:         row.phone    || '',
      whatsapp:      row.whatsapp || '',
      photo:         '',
      relation,
      parentId,
      spouseOfId,
      maritalStatus: row.maritalStatus || '',
      createdAt:     new Date().toISOString(),
    }
  })
}

// ── CSV export ────────────────────────────────────────────────────────────────

function escapeField(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function exportToCSV(members) {
  const rows       = [SHEET_HEADERS, ...membersToRows(members)]
  const csvContent = rows.map(r => r.map(escapeField).join(',')).join('\r\n')
  const blob       = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url        = URL.createObjectURL(blob)
  const link       = document.createElement('a')
  link.href     = url
  link.download = `family-tree-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── CSV import ────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = []
  let current  = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else {
        current += ch
      }
    } else {
      if      (ch === '"') inQuotes = true
      else if (ch === ',') { result.push(current); current = '' }
      else                  current += ch
    }
  }
  result.push(current)
  return result
}

export function parseCSVToMembers(csvText) {
  const lines      = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) throw new Error('CSV is empty or has no data rows')

  const rawHeaders = parseCSVLine(lines[0]).map(h => h.trim())
  const colIdx     = buildColIdx(rawHeaders)
  if (colIdx['fullName'] === -1) throw new Error('Kolom "Nama Lengkap" tidak ditemukan dalam file CSV')

  const rawRows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const fields = parseCSVLine(line)
    const row    = {}
    HEADERS.forEach(h => {
      row[h] = colIdx[h] !== -1 ? (fields[colIdx[h]] ?? '').trim() : ''
    })
    if (!row.fullName) continue
    rawRows.push(row)
  }
  if (rawRows.length === 0) throw new Error('Tidak ada data yang valid dalam file')
  return parseRowsToMembers(rawRows)
}
