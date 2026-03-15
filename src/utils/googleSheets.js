/**
 * Google Sheets sync via Google Apps Script web app.
 *
 * Uses JSONP (script-tag injection) to bypass CORS.
 *
 * Why not fetch()  → CORS fails on Google's redirect chain
 * Why not iframe  → Google's HtmlService sandbox blocks window.parent.postMessage
 * Why JSONP works → <script> tags load cross-origin URLs without CORS checks;
 *                   the server wraps its response in callbackFn({...}) which the
 *                   browser executes, calling our pre-registered callback.
 *
 * The Apps Script must return Content-Type: application/javascript (not JSON)
 * so Chrome doesn't block it with strict MIME checking. It does this only when
 * the `callback` URL parameter is present; otherwise it returns plain JSON.
 *
 * Pre-requisite: deploy the script with "Who has access: Anyone" (not
 * "Anyone with Google account"). Without this, Google redirects to a login
 * page, which Chrome refuses to execute as a script (causing onerror).
 */
import { HEADERS, SHEET_HEADERS, membersToRows, parseRowsToMembers, buildColIdx } from './csv.js'

// ── Apps Script code to give to the user ─────────────────────────────────────
export const APPS_SCRIPT_CODE = `// Family Tree Sync
// Deploy → New Deployment → Web App
//   Execute as: Me   |   Who has access: Anyone  ← must be "Anyone", not "Anyone with Google account"
const SHEET = 'FamilyTree';

function doGet(e) {
  const cb     = e.parameter.callback; // JSONP callback name
  const action = e.parameter.action || 'status';
  let data;

  try {
    if (action === 'pull') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet()
                      .getSheetByName(SHEET);
      if (!sheet)
        throw new Error('Sheet "FamilyTree" not found — it will be created on first Push.');
      data = { ok: true, values: sheet.getDataRange().getValues() };
    }
    else if (action === 'push') {
      const values = JSON.parse(e.parameter.data);
      const ss     = SpreadsheetApp.getActiveSpreadsheet();
      let sheet    = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
      sheet.clearContents();
      if (values.length > 0)
        sheet.getRange(1, 1, values.length, values[0].length)
             .setValues(values);
      data = { ok: true, rows: values.length };
    }
    else {
      data = { ok: true, status: 'ready' };
    }
  } catch (ex) {
    data = { ok: false, error: ex.message };
  }

  const json = JSON.stringify(data);

  // IMPORTANT: return application/javascript when callback is present.
  // Chrome refuses to execute responses with application/json MIME type
  // as a <script>, causing onerror. The JSONP wrapper makes it valid JS.
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // Plain JSON fallback (for direct browser testing)
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}`

// ── JSONP helper ──────────────────────────────────────────────────────────────

function jsonp(scriptUrl, params = {}) {
  return new Promise((resolve, reject) => {
    const cb  = `_gs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const qs  = new URLSearchParams({ ...params, callback: cb }).toString()

    const el  = document.createElement('script')
    el.crossOrigin = 'anonymous'

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(
        'Request timed out (25 s). ' +
        'Make sure the script is deployed and "Who has access" is set to "Anyone".'
      ))
    }, 25_000)

    function cleanup() {
      delete window[cb]
      el.parentNode?.removeChild(el)
      clearTimeout(timer)
    }

    window[cb] = data => {
      cleanup()
      if (!data.ok) reject(new Error(data.error || 'Script returned an error.'))
      else resolve(data)
    }

    el.src = `${scriptUrl}?${qs}`

    el.onerror = () => {
      cleanup()
      reject(new Error(
        'Could not load the script.\n' +
        '• Make sure "Who has access" is set to "Anyone" (not "Anyone with Google account")\n' +
        '• Make sure the URL ends in /exec\n' +
        '• Try opening the URL directly in a new browser tab to check it works'
      ))
    }

    document.head.appendChild(el)
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function testConnection(scriptUrl) {
  await jsonp(scriptUrl, { action: 'status' })
}

export async function pullFromScript(scriptUrl) {
  const data    = await jsonp(scriptUrl, { action: 'pull' })
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
  const values  = [SHEET_HEADERS, ...membersToRows(members)]
  const dataStr = JSON.stringify(values)

  if (encodeURIComponent(dataStr).length > 500_000) {
    throw new Error(
      `Family data is too large to sync directly (${Math.round(dataStr.length / 1024)} KB). ` +
      'Use CSV Export for very large trees.'
    )
  }

  return jsonp(scriptUrl, { action: 'push', data: dataStr })
}
