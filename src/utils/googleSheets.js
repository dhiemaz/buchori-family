/**
 * Google Sheets sync via backend proxy (Express → Apps Script).
 *
 * All requests go through /api/sheets (GET) or /api/sheets/push (POST).
 * The Express server makes the actual HTTP call to Google, so there are
 * no browser CORS restrictions, no JSONP script-tag hacks, and no URL
 * length limits when pushing large datasets.
 */
import { HEADERS, SHEET_HEADERS, membersToRows, parseRowsToMembers, buildColIdx } from './csv.js'

// ── Apps Script code to give to the user ─────────────────────────────────────
export const APPS_SCRIPT_CODE = `// Family Tree Sync
// Deploy → New Deployment → Web App
//   Execute as: Me   |   Who has access: Anyone
const SHEET = 'FamilyTree';

// Pull / status (GET)
function doGet(e) {
  const action = e.parameter.action || 'status';
  let data;
  try {
    if (action === 'pull') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
      if (!sheet)
        throw new Error('Sheet "FamilyTree" not found — it will be created on first Push.');
      data = { ok: true, values: sheet.getDataRange().getValues() };
    } else {
      data = { ok: true, status: 'ready' };
    }
  } catch (ex) {
    data = { ok: false, error: ex.message };
  }
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Push (POST) — receives { action: 'push', data: [[...], ...] }
function doPost(e) {
  let data;
  try {
    const payload = JSON.parse(e.postData.contents);
    const values  = payload.data;
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    let sheet     = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
    sheet.clearContents();
    if (values.length > 0)
      sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    data = { ok: true, rows: values.length };
  } catch (ex) {
    data = { ok: false, error: ex.message };
  }
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`

// ── Proxy helper ──────────────────────────────────────────────────────────────

async function proxyGet(scriptUrl, action) {
  const res = await fetch(`/api/sheets?url=${encodeURIComponent(scriptUrl)}&action=${action}`)
  if (!res.ok) throw new Error(`Proxy error ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Script returned an error.')
  return data
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function testConnection(scriptUrl) {
  await proxyGet(scriptUrl, 'status')
}

export async function pullFromScript(scriptUrl) {
  const data    = await proxyGet(scriptUrl, 'pull')
  const allRows = data.values || []

  if (allRows.length < 2) throw new Error('The FamilyTree sheet has no data rows.')

  const sheetHeaders = allRows[0].map(h => h.toString().trim())
  const colIdx       = buildColIdx(sheetHeaders)
  if (colIdx['fullName'] === -1) throw new Error('Kolom "Nama Lengkap" tidak ditemukan dalam sheet')

  const rawRows = allRows.slice(1)
    .filter(r => r.some(c => c?.toString().trim()))
    .map(r => {
      const row = {}
      HEADERS.forEach(h => {
        row[h] = colIdx[h] !== -1 ? (r[colIdx[h]] ?? '').toString().trim() : ''
      })
      return row
    })
    .filter(row => row.fullName)

  if (rawRows.length === 0) throw new Error('No valid members found in the sheet.')
  return parseRowsToMembers(rawRows)
}

export async function pushToScript(scriptUrl, members) {
  const data = [SHEET_HEADERS, ...membersToRows(members)]
  const res  = await fetch('/api/sheets/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: scriptUrl, data }),
  })
  if (!res.ok) throw new Error(`Proxy error ${res.status}`)
  const result = await res.json()
  if (!result.ok) throw new Error(result.error || 'Push failed.')
  return result
}
