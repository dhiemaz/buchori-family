import StatsPanel from './StatsPanel'
import FamilyTree from './FamilyTree'
import ImportExport from './ImportExport'
import GoogleSheetsSync from './GoogleSheetsSync'
import { useFamily } from '../context/FamilyContext'

export default function Dashboard() {
  const { members, openAddRoot } = useFamily()

  return (
    <main className="dashboard">
      {members.length > 0 && (
        <>
          <StatsPanel />
          <div className="dashboard-actions">
            <div className="sync-group">
              <ImportExport />
              <GoogleSheetsSync />
            </div>
            <button className="btn btn-primary" onClick={openAddRoot}>
              + Add to Our Family
            </button>
          </div>
        </>
      )}
      <section className="tree-section">
        <h2 className="section-title">
          <span>Our Family Story</span>
        </h2>
        <FamilyTree />
      </section>
    </main>
  )
}
