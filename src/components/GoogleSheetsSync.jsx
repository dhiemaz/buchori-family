import { useState, useRef } from 'react'
import { useFamily } from '../context/FamilyContext'
import {
  APPS_SCRIPT_CODE,
  testConnection,
  pullFromScript,
  pushToScript,
} from '../utils/googleSheets'

const LS_URL      = 'gs-script-url'
const LS_SHEET_ID = 'gs-sheet-id'
const LS_SYNC     = 'gs-last-sync'

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwHWk2ZspNolgsMQrjyNHOc_4_G8YUO8GTaUi9Z3a2WgD2we4L4iTvxdrfLuId4VO16/exec'
const DEFAULT_SHEET_ID   = '11LC6KuSOE-AT-Z4sB8PB_oKjOXqRoyXJ3mRbpRO7jFc'

// Pre-seed defaults on first visit so the app is always connected
if (!localStorage.getItem(LS_URL))      localStorage.setItem(LS_URL,      DEFAULT_SCRIPT_URL)
if (!localStorage.getItem(LS_SHEET_ID)) localStorage.setItem(LS_SHEET_ID, DEFAULT_SHEET_ID)

function fmtTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function sheetIdFromUrl(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

export default function GoogleSheetsSync() {
  const { members, importMembers } = useFamily()

  const [scriptUrl,  setScriptUrl]  = useState(() => localStorage.getItem(LS_URL)      || '')
  const [sheetId,    setSheetId]    = useState(() => localStorage.getItem(LS_SHEET_ID)  || '')
  const [lastSync,   setLastSync]   = useState(() => localStorage.getItem(LS_SYNC)      || '')

  const [open,       setOpen]       = useState(false)
  const [view,       setView]       = useState('sync')  // 'setup' | 'sync'
  const [busy,       setBusy]       = useState('')      // '' | 'test' | 'push' | 'pull'
  const [msg,        setMsg]        = useState(null)    // null | { ok, text }

  const [draftUrl,   setDraftUrl]   = useState('')
  const [copied,     setCopied]     = useState(false)
  const [pullPreview, setPullPreview] = useState(null)

  const copyTimeoutRef = useRef(null)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const isConnected = !!scriptUrl
  const isBusy      = !!busy

  function openModal() {
    setMsg(null)
    setPullPreview(null)
    setDraftUrl(scriptUrl)
    setView(scriptUrl ? 'sync' : 'setup')
    setOpen(true)
  }

  function closeModal() { setOpen(false) }

  function persist(url) {
    localStorage.setItem(LS_URL, url)
    setScriptUrl(url)
    const id = sheetIdFromUrl(url)
    if (id) { localStorage.setItem(LS_SHEET_ID, id); setSheetId(id) }
  }

  function stampSync() {
    const ts = new Date().toISOString()
    localStorage.setItem(LS_SYNC, ts)
    setLastSync(ts)
  }

  async function copyScript() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(APPS_SCRIPT_CODE)
      } else {
        // Fallback for HTTP (non-secure) contexts where Clipboard API is unavailable
        const ta = document.createElement('textarea')
        ta.value = APPS_SCRIPT_CODE
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Copy failed silently — user can manually select the code block
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleTest() {
    const url = draftUrl.trim()
    if (!url) return
    setBusy('test'); setMsg(null)
    try {
      await testConnection(url)
      persist(url)
      setMsg({ ok: true, text: '✅ Connected! Script is responding correctly.' })
      setView('sync')
    } catch (e) {
      setMsg({ ok: false, text: `Connection failed: ${e.message}` })
    } finally { setBusy('') }
  }

  async function handlePush() {
    setBusy('push'); setMsg(null)
    try {
      const result = await pushToScript(scriptUrl, members)
      stampSync()
      setMsg({ ok: true, text: `✅ Berhasil menyimpan ${result.rows - 1} anggota ke Google Sheet.` })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally { setBusy('') }
  }

  async function handleSync() {
    setBusy('sync'); setMsg(null)
    try {
      const imported = await pullFromScript(scriptUrl)
      setPullPreview(imported)
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally { setBusy('') }
  }

  function doPull(mode) {
    importMembers(pullPreview, mode)
    stampSync()
    setPullPreview(null)
    setMsg({ ok: true, text: `✅ Berhasil disinkronisasi: ${pullPreview.length} anggota dari Google Sheet.` })
  }

  function disconnect() {
    localStorage.removeItem(LS_URL)
    localStorage.removeItem(LS_SHEET_ID)
    localStorage.removeItem(LS_SYNC)
    setScriptUrl(''); setSheetId(''); setLastSync(''); setDraftUrl('')
    setMsg(null); setPullPreview(null)
    setView('setup')
  }

  // ── Sheet URL ──────────────────────────────────────────────────────────────

  const sheetUrl = sheetId
    ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
    : null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <button
        className={`btn btn-secondary ie-btn gs-trigger-btn ${isConnected ? 'gs-is-connected' : ''}`}
        onClick={openModal}
        title="Sync with Google Sheets"
      >
        <SheetsIcon />
        <span>Sheets</span>
        {isConnected && <span className="gs-connected-pip" />}
      </button>

      {open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal gs-modal">

            <div className="modal-header">
              <h2><SheetsIcon size={20} /> Google Sheets</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {/* ═══════════ PULL PREVIEW ═══════════ */}
            {pullPreview ? (
              <div className="ie-preview-body">
                <p className="ie-preview-count">
                  Found <strong>{pullPreview.length}</strong> member{pullPreview.length !== 1 ? 's' : ''} in the sheet
                </p>
                <div className="ie-preview-list">
                  {pullPreview.slice(0, 10).map((m, i) => (
                    <div key={i} className="ie-preview-row">
                      <span className={`ie-dot ${m.gender}`} />
                      <span className="ie-preview-name">{m.fullName}</span>
                      <span className="ie-preview-tag">
                        {m.relation === 'spouse' ? '💑' : m.relation === 'kid' ? '👶' : '🌱'} {m.relation}
                      </span>
                      {m.birthdate && <span className="ie-preview-date">{m.birthdate}</span>}
                    </div>
                  ))}
                  {pullPreview.length > 10 && (
                    <p className="ie-preview-more">…and {pullPreview.length - 10} more</p>
                  )}
                </div>
                <p className="form-hint">📷 Photos are not synced via Google Sheets.</p>
                {members.length > 0 ? (
                  <div className="ie-choice">
                    <p className="ie-choice-label">Bagaimana cara mengimpor data?</p>
                    <div className="ie-choice-btns">
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          if (window.confirm('Ganti SEMUA data keluarga saat ini dengan data dari Google Sheet?')) {
                            doPull('replace')
                          }
                        }}
                      >
                        🔄 Ganti Semua
                      </button>
                      <button className="btn btn-secondary" onClick={() => doPull('merge')}>
                        ➕ Tambah ke Ada
                      </button>
                    </div>
                    <p className="form-hint">
                      <strong>Ganti Semua</strong> mengganti seluruh data dengan data dari Sheet.{' '}
                      <strong>Tambah ke Ada</strong> menambahkan anggota baru dari Sheet ke pohon saat ini.
                    </p>
                  </div>
                ) : (
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => setPullPreview(null)}>Batal</button>
                    <button className="btn btn-primary" onClick={() => doPull('replace')}>
                      🌿 Muat Keluarga
                    </button>
                  </div>
                )}
              </div>

            ) : view === 'setup' ? (
              /* ═══════════ SETUP ═══════════ */
              <div className="gs-body">
                <div className="gs-setup-intro">
                  <p>No Google Cloud setup needed — just paste a small script into your Google Sheet.</p>
                </div>

                <ol className="gs-steps">
                  <li>
                    Open (or create) a <strong>Google Sheet</strong> where you want to store your family data
                  </li>
                  <li>
                    Click <strong>Extensions → Apps Script</strong>
                  </li>
                  <li>
                    Delete any existing code, then paste the script below and click <strong>Save&nbsp;💾</strong>
                  </li>
                  <li>
                    Click <strong>Deploy → New Deployment → Web App</strong>
                  </li>
                  <li>
                    Set <em>Execute as</em>: <strong>Me</strong> &nbsp;·&nbsp; <em>Who has access</em>: <strong>Anyone</strong>
                  </li>
                  <li>
                    Click <strong>Deploy</strong>, copy the <strong>Web app URL</strong> and paste it below
                  </li>
                </ol>

                {/* Script code block */}
                <div className="gs-code-block">
                  <div className="gs-code-header">
                    <span className="gs-code-label">Apps Script</span>
                    <button className="gs-copy-btn" onClick={copyScript}>
                      {copied ? '✅ Copied!' : '📋 Copy Script'}
                    </button>
                  </div>
                  <pre className="gs-code">{APPS_SCRIPT_CODE}</pre>
                </div>

                {/* URL input */}
                <div className="form-group">
                  <label>Web App URL <span className="required">*</span></label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://script.google.com/macros/s/…/exec"
                    value={draftUrl}
                    onChange={e => { setDraftUrl(e.target.value); setMsg(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleTest()}
                  />
                  <span className="form-hint">Paste the Web app URL from the Deploy dialog.</span>
                </div>

                {msg && (
                  <div className={`gs-msg ${msg.ok ? 'gs-msg-ok' : 'gs-msg-err'}`}>
                    {msg.text}
                  </div>
                )}

                <div className="form-actions">
                  <button className="btn btn-secondary" onClick={scriptUrl ? () => setView('sync') : closeModal}>
                    {scriptUrl ? 'Back' : 'Cancel'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleTest}
                    disabled={isBusy || !draftUrl.trim()}
                  >
                    {busy === 'test' ? '⏳ Testing…' : '🔗 Test & Connect'}
                  </button>
                </div>
              </div>

            ) : (
              /* ═══════════ SYNC ═══════════ */
              <div className="gs-body">

                {/* Connection status */}
                <div className="gs-status-bar">
                  <div className="gs-status-left">
                    <span className="gs-dot gs-dot-on" />
                    <a
                      className="gs-status-label gs-status-link"
                      href={sheetUrl || scriptUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Buka Google Sheet"
                    >
                      Terkoneksi dengan Google Sheet ↗
                    </a>
                  </div>
                  <div className="gs-status-right">
                    {sheetUrl && (
                      <a className="gs-open-link" href={sheetUrl} target="_blank" rel="noreferrer">
                        📄 Buka Google Sheet ↗
                      </a>
                    )}
                    <button
                      className="btn btn-secondary gs-sm-btn"
                      onClick={() => { setView('setup'); setMsg(null) }}
                      title="Change script URL"
                    >
                      ⚙
                    </button>
                    <button
                      className="btn btn-secondary gs-sm-btn gs-disconnect-btn"
                      onClick={disconnect}
                      title="Disconnect"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Push & Pull buttons */}
                <div className="gs-action-grid">
                  <button
                    className="gs-action-btn gs-action-push"
                    onClick={handlePush}
                    disabled={isBusy || members.length === 0}
                  >
                    <span className="gs-action-icon">☁️</span>
                    <span className="gs-action-label">
                      {busy === 'push' ? 'Menyimpan…' : 'Simpan ke Google Sheet'}
                    </span>
                    <span className="gs-action-sub">
                      {busy === 'push' ? '⏳' : `${members.length} anggota → Sheet`}
                    </span>
                  </button>

                  <button
                    className="gs-action-btn gs-action-pull"
                    onClick={handleSync}
                    disabled={isBusy}
                  >
                    <span className="gs-action-icon">📋</span>
                    <span className="gs-action-label">
                      {busy === 'sync' ? 'Mengambil…' : 'Ambil dari Google Sheet'}
                    </span>
                    <span className="gs-action-sub">
                      {busy === 'sync' ? '⏳' : 'Sheet → Aplikasi'}
                    </span>
                  </button>
                </div>

                {/* Feedback */}
                {msg && (
                  <div className={`gs-msg ${msg.ok ? 'gs-msg-ok' : 'gs-msg-err'}`}>
                    {msg.text}
                  </div>
                )}

                {lastSync && !msg && (
                  <p className="gs-last-sync">Terakhir disinkronisasi: {fmtTime(lastSync)}</p>
                )}

                <p className="form-hint">
                  <strong>Sinkronisasi</strong> mengambil data terbaru dari Google Sheet ke aplikasi.{' '}
                  Google Sheet adalah sumber data utama. Foto tidak disertakan.
                </p>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function SheetsIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
      <rect x="3" y="1" width="18" height="22" rx="2" fill="#0F9D58" />
      <rect x="6" y="6"  width="12" height="2" rx="1" fill="white" opacity="0.9" />
      <rect x="6" y="10" width="12" height="2" rx="1" fill="white" opacity="0.9" />
      <rect x="6" y="14" width="8"  height="2" rx="1" fill="white" opacity="0.9" />
    </svg>
  )
}
