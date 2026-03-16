import { useFamily } from '../context/FamilyContext'
import { exportToCSV } from '../utils/csv'

export default function ImportExport() {
  const { members } = useFamily()

  return (
    <div className="ie-btns">
      <button
        className="btn btn-secondary ie-btn"
        onClick={() => exportToCSV(members)}
        disabled={members.length === 0}
        title={members.length === 0 ? 'Nothing to export yet' : 'Download family data as CSV'}
      >
        ⬇ Export CSV
      </button>
    </div>
  )
}
