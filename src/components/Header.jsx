import { useFamily } from '../context/FamilyContext'

export default function Header({ onExit }) {
  const { members, openAddRoot } = useFamily()

  return (
    <header className="header">
      <div className="header-left">
        <span className="header-icon">🌳</span>
        <div>
          <h1 className="header-title">Keluarga Besar Buchori.</h1>
        </div>
      </div>
      <div className="header-right">
        {members.length === 0 && (
          <button className="btn btn-primary" onClick={openAddRoot}>
            ✨ Begin Our Story
          </button>
        )}
        <button className="btn header-exit-btn" onClick={onExit} title="Kembali ke halaman awal">
          ⬅ Keluar
        </button>
      </div>
    </header>
  )
}
