import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Input } from '../Input';
import './Auth.css';

interface RegisterProps {
  onSwitchToLogin: () => void;
  onRegisterSuccess: (verificationToken: string) => void;
}

export function Register({ onSwitchToLogin, onRegisterSuccess }: RegisterProps) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'La contraseña debe incluir al menos una mayúscula';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'La contraseña debe incluir al menos un número';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(email, password);
      onRegisterSuccess(result.verificationToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg viewBox="0 0 120 120" fill="none" width="56" height="56">
              <rect width="120" height="120" rx="22" fill="#FFFFFF"/>
              <rect width="120" height="120" rx="22" fill="none" stroke="#E0E0E0" strokeWidth="1"/>
              <path d="M60 28 L95 52 L95 92 L25 92 L25 52 Z" fill="#2196F3"/>
              <path d="M14 54 L60 18 L106 54 L95 60 L60 28 L25 60 Z" fill="#1565C0"/>
              <rect x="49" y="65" width="22" height="27" rx="3" fill="white"/>
              <circle cx="85" cy="34" r="18" fill="#FFC107"/>
              <path d="M75 34 L82 41 L96 27" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <h1 className="auth-title">Crear Cuenta</h1>
          <p className="auth-subtitle">Únete a Dommuss Agenda</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            disabled={isLoading}
          />

          <Input
            type="password"
            label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
          />
          <p className="auth-input-help">Mínimo 6 caracteres, 1 mayúscula, 1 número</p>

          <Input
            type="password"
            label="Confirmar Contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
          />

          {error && <div className="auth-error">{error}</div>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={!email || !password || !confirmPassword}
          >
            Crear Cuenta
          </Button>
        </form>

        <div className="auth-footer">
          <div className="auth-divider">
            <span>¿Ya tienes cuenta?</span>
          </div>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={onSwitchToLogin}
            type="button"
          >
            Iniciar Sesión
          </Button>
        </div>

        <div className="auth-terms">
          <p>
            Al crear una cuenta, aceptas nuestros{' '}
            <a href="#" className="auth-link">Términos de Servicio</a> y{' '}
            <a href="#" className="auth-link">Política de Privacidad</a>
          </p>
        </div>
      </div>
    </div>
  );
}
