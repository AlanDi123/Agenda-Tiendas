import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Input } from '../Input';
import './Auth.css';

interface PasswordResetProps {
  onSwitchToLogin: () => void;
  onSwitchToNewPassword: (email: string) => void;
}

export function PasswordReset({ onSwitchToLogin, onSwitchToNewPassword }: PasswordResetProps) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setSuccess(true);
      // In production, user would receive email with reset link
      // For demo, we'll show the token in console and allow manual entry
      console.log('Password reset requested. Check console for token.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al solicitar reset');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-success-icon">✓</div>
            <h1 className="auth-title">Reset Solicitado</h1>
            <p className="auth-subtitle">
              Si existe una cuenta con {email}, recibirás un email con instrucciones.
            </p>
          </div>

          <div className="reset-demo-note">
            <p><strong>Modo Demo:</strong> El token se ha mostrado en la consola del navegador.</p>
            <p>Para propósitos de desarrollo, revisa la consola (F12) para ver el token.</p>
          </div>

          <div className="auth-footer">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => onSwitchToNewPassword(email)}
            >
              Ingresar Token Manualmente
            </Button>
            <Button
              variant="text"
              size="md"
              fullWidth
              onClick={onSwitchToLogin}
            >
              Volver al Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h1 className="auth-title">Recuperar Contraseña</h1>
          <p className="auth-subtitle">Ingresa tu email para resetear tu contraseña</p>
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

          {error && <div className="auth-error">{error}</div>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={!email}
          >
            Enviar Instrucciones
          </Button>
        </form>

        <div className="auth-footer">
          <Button
            variant="text"
            size="md"
            fullWidth
            onClick={onSwitchToLogin}
            type="button"
          >
            Volver al Login
          </Button>
        </div>
      </div>
    </div>
  );
}
