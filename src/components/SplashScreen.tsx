import './SplashScreen.css';

function DommussLogo() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="splash-logo">
      {/* Fondo blanco redondeado */}
      <rect width="120" height="120" rx="24" fill="white"/>
      {/* Casa azul */}
      <path d="M60 22 L98 48 L98 98 L22 98 L22 48 Z" fill="#1565C0"/>
      {/* Techo */}
      <path d="M12 50 L60 16 L108 50 L98 57 L60 26 L22 57 Z" fill="#1E88E5"/>
      {/* Puerta */}
      <rect x="48" y="68" width="24" height="30" rx="4" fill="white"/>
      {/* Tilde blanco */}
      <path d="M32 58 L50 76 L86 44" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <DommussLogo />
        <h1 className="splash-title">Dommuss</h1>
        <p className="splash-subtitle">Agenda Familiar</p>
      </div>
    </div>
  );
}
