import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Input } from '../Input';
import './Auth.css';

interface LoginProps {
  onSwitchToRegister: () => void;
  onSwitchToReset: () => void;
  onLoginSuccess: () => void;
}

export function Login({ onSwitchToRegister, onSwitchToReset, onLoginSuccess }: LoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
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
          <h1 className="auth-title">Iniciar Sesión</h1>
          <p className="auth-subtitle">Accede a tu agenda Dommuss</p>
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

          {error && <div className="auth-error">{error}</div>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={!email || !password}
          >
            Iniciar Sesión
          </Button>
        </form>

        <div className="auth-footer">
          <button
            className="auth-link"
            onClick={onSwitchToReset}
            type="button"
          >
            ¿Olvidaste tu contraseña?
          </button>
          <div className="auth-divider">
            <span>¿No tienes cuenta?</span>
          </div>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={onSwitchToRegister}
            type="button"
          >
            Crear cuenta nueva
          </Button>
        </div>
      </div>
    </div>
  );
}
