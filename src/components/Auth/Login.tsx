import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Input } from '../Input';
import './Auth.css';
import AppLogo from '../../assets/logo/logo_principal.png';

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
            <img
              src={AppLogo}
              alt="Logotipo Principal"
              className="w-40 h-auto mx-auto mb-8 rounded-full shadow-lg border-4 border-white"
              onError={(e) => {
                console.error('Error loading PNG logo in login');
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
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
