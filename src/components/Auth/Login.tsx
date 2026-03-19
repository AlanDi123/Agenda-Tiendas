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
            <svg viewBox="0 0 120 120" fill="none" width="48" height="48">
              <rect width="120" height="120" rx="24" fill="#1565C0"/>
              <path d="M60 22 L98 48 L98 98 L22 98 L22 48 Z" fill="#1E88E5"/>
              <path d="M12 50 L60 16 L108 50 L98 57 L60 26 L22 57 Z" fill="#1565C0"/>
              <rect x="48" y="68" width="24" height="30" rx="4" fill="white"/>
              <path d="M32 58 L50 76 L86 44" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
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
