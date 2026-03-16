export default function Header({ onExit }) {
  return (
    <header className="header">
      <div className="header-left">
        <span className="header-icon">🌳</span>
        <div>
          <h1 className="header-title">Keluarga Besar Buchori.</h1>
        </div>
      </div>
      <div className="header-right">
<button className="btn header-exit-btn" onClick={onExit} title="Kembali ke halaman awal">
          ⬅ Keluar
        </button>
      </div>
    </header>
  )
}
