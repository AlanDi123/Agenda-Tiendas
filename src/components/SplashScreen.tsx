import './SplashScreen.css';

// Dommuss Logo SVG - Casa azul con tilde naranja (oficial)
function DommussLogoLarge() {
  return (
    <svg width="120" height="120" viewBox="0 0 100 100" fill="none" className="splash-logo">
      {/* Casa azul */}
      <path
        d="M10 40L50 10L90 40V85H10V40Z"
        fill="#2D3E50"
      />
      {/* Tilde naranja central */}
      <path
        d="M35 55L45 65L70 40"
        stroke="#FF6B35"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <DommussLogoLarge />
        <h1 className="splash-title">Dommuss</h1>
        <p className="splash-subtitle">Agenda Familiar</p>
      </div>
    </div>
  );
}
