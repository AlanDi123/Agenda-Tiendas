import './SplashScreen.css';

function DommussLogo() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="splash-logo">
      {/* Fondo blanco redondeado */}
      <rect width="120" height="120" rx="22" fill="#FFFFFF"/>
      {/* Sombra/borde sutil */}
      <rect width="120" height="120" rx="22" fill="none" stroke="#E0E0E0" strokeWidth="1"/>
      {/* Cuerpo de la casa - azul */}
      <path d="M60 28 L95 52 L95 92 L25 92 L25 52 Z" fill="#2196F3"/>
      {/* Techo - azul más oscuro */}
      <path d="M14 54 L60 18 L106 54 L95 60 L60 28 L25 60 Z" fill="#1565C0"/>
      {/* Puerta - blanca */}
      <rect x="49" y="65" width="22" height="27" rx="3" fill="white"/>
      {/* Tilde/checkmark - AMARILLO, fuera de la casa (arriba a la derecha) */}
      <circle cx="85" cy="34" r="18" fill="#FFC107"/>
      <path d="M75 34 L82 41 L96 27" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
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
