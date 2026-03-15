export default function WelcomeScreen({ onEnter }) {
  return (
    <div className="welcome-overlay">
      {/* Floating decorative leaves */}
      <span className="welcome-leaf wl-1">🍃</span>
      <span className="welcome-leaf wl-2">🌿</span>
      <span className="welcome-leaf wl-3">🍃</span>
      <span className="welcome-leaf wl-4">🌿</span>
      <span className="welcome-leaf wl-5">🍃</span>

      <div className="welcome-card">
        <div className="welcome-tree-icon">🌳</div>

        <h1 className="welcome-title">Keluarga Besar<br />Buchori.</h1>

        <p className="welcome-tagline">
          Merangkai kisah, menjaga kenangan,<br />
          menyatukan setiap generasi.
        </p>

        <div className="welcome-divider">
          <span />
          <span className="welcome-divider-icon">❧</span>
          <span />
        </div>

        <button className="welcome-btn" onClick={onEnter}>
          Masuk
        </button>
      </div>
    </div>
  )
}
