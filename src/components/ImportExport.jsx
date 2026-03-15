import { useRef, useState } from 'react'
import { useFamily } from '../context/FamilyContext'
import { exportToCSV, parseCSVToMembers } from '../utils/csv'

export default function ImportExport() {
  const { members, importMembers } = useFamily()
  const fileRef = useRef(null)
  const [modal, setModal] = useState(null) // null | { parsed, error }

  function handleExport() {
    exportToCSV(members)
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const text = await file.text()
      const parsed = parseCSVToMembers(text)
      setModal({ parsed, error: null })
    } catch (err) {
      setModal({ parsed: null, error: err.message })
    }
  }

  function doImport(mode) {
    importMembers(modal.parsed, mode)
    setModal(null)
  }

  function closeModal() {
    setModal(null)
  }

  return (
    <>
      <div className="ie-btns">
        <button
          className="btn btn-secondary ie-btn"
          onClick={handleExport}
          disabled={members.length === 0}
          title={members.length === 0 ? 'Nothing to export yet' : 'Download family data as CSV'}
        >
          ⬇ Export CSV
        </button>
        <button
          className="btn btn-secondary ie-btn"
          onClick={() => fileRef.current?.click()}
          title="Import family data from a CSV file"
        >
          ⬆ Import CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal ie-modal">

            <div className="modal-header">
              <h2>{modal.error ? '⚠️ Import Error' : '📥 Import Family Data'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {modal.error ? (
              <div className="ie-error-body">
                <p className="ie-error-msg">{modal.error}</p>
                <p className="form-hint">
                  Make sure your CSV file has at least a <strong>fullName</strong> column.
                  Download an export first to see the expected format.
                </p>
                <div className="form-actions">
                  <button className="btn btn-secondary" onClick={closeModal}>Close</button>
                  <button className="btn btn-primary" onClick={() => { closeModal(); fileRef.current?.click() }}>
                    Try Another File
                  </button>
                </div>
              </div>
            ) : (
              <div className="ie-preview-body">

                <p className="ie-preview-count">
                  Found <strong>{modal.parsed.length}</strong> member{modal.parsed.length !== 1 ? 's' : ''} in the file
                </p>

                <div className="ie-preview-list">
                  {modal.parsed.slice(0, 10).map((m, i) => (
                    <div key={i} className="ie-preview-row">
                      <span className={`ie-dot ${m.gender}`} />
                      <span className="ie-preview-name">{m.fullName}</span>
                      <span className="ie-preview-tag">
                        {m.relation === 'spouse' ? '💑' : m.relation === 'kid' ? '👶' : '🌱'}
                        {' '}{m.relation}
                      </span>
                      {m.birthdate && (
                        <span className="ie-preview-date">{m.birthdate}</span>
                      )}
                    </div>
                  ))}
                  {modal.parsed.length > 10 && (
                    <p className="ie-preview-more">…and {modal.parsed.length - 10} more</p>
                  )}
                </div>

                <p className="form-hint">
                  📷 Photos are not included in CSV — all other fields will be imported.
                </p>

                {members.length > 0 ? (
                  <div className="ie-choice">
                    <p className="ie-choice-label">How would you like to import?</p>
                    <div className="ie-choice-btns">
                      <button className="btn btn-secondary" onClick={() => doImport('merge')}>
                        ➕ Add to Existing
                      </button>
                      <button
                        className="btn ie-replace-btn"
                        onClick={() => {
                          if (window.confirm('This will replace ALL current family data with the imported file. Are you sure?')) {
                            doImport('replace')
                          }
                        }}
                      >
                        🔄 Replace All
                      </button>
                    </div>
                    <p className="form-hint">
                      <strong>Add to Existing</strong> keeps your current tree and adds new members.
                      {' '}<strong>Replace All</strong> clears everything and loads the file.
                    </p>
                  </div>
                ) : (
                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => doImport('replace')}>
                      🌿 Import Family
                    </button>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
