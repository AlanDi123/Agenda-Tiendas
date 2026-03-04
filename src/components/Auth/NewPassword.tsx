import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Input } from '../Input';
import './Auth.css';

interface NewPasswordProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function NewPassword({ onSuccess, onBack }: Omit<NewPasswordProps, 'email'>) {
  const { resetPassword } = useAuth();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
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

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(token, newPassword);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al resetear contraseña');
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="auth-title">Nueva Contraseña</h1>
          <p className="auth-subtitle">Ingresa el código y tu nueva contraseña</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <Input
            type="text"
            label="Código de Verificación"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Ingresa el código recibido"
            required
            disabled={isLoading}
          />
          <p className="auth-input-help">Revisa tu email o la consola del navegador (modo demo)</p>

          <Input
            type="password"
            label="Nueva Contraseña"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
          />
          <p className="auth-input-help">Mínimo 6 caracteres, 1 mayúscula, 1 número</p>

          <Input
            type="password"
            label="Confirmar Nueva Contraseña"
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
            disabled={!token || !newPassword || !confirmPassword}
          >
            Resetear Contraseña
          </Button>
        </form>

        <div className="auth-footer">
          <Button
            variant="text"
            size="md"
            fullWidth
            onClick={onBack}
            type="button"
            disabled={isLoading}
          >
            Volver
          </Button>
        </div>
      </div>
    </div>
  );
}
