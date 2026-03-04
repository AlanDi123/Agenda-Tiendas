import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import './Auth.css';

interface VerifyEmailProps {
  email: string;
  token?: string;
  onVerificationComplete: () => void;
  onSkip: () => void;
}

export function VerifyEmail({ email, token, onVerificationComplete, onSkip }: VerifyEmailProps) {
  const { verifyEmail, resendVerificationEmail } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Auto-verify if token provided via URL
  useEffect(() => {
    if (token) {
      handleVerify(token);
    }
  }, [token]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async (verifyToken: string) => {
    setIsLoading(true);
    setError('');

    try {
      await verifyEmail(verifyToken);
      setSuccess(true);
      setTimeout(() => onVerificationComplete(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setIsLoading(true);
    setError('');

    try {
      await resendVerificationEmail(email);
      setCountdown(60); // 60 second cooldown
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reenviar email');
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
            <h1 className="auth-title">¡Email Verificado!</h1>
            <p className="auth-subtitle">Tu email ha sido verificado exitosamente</p>
          </div>
          <div className="auth-success-message">
            <p>Redirigiendo...</p>
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
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="auth-title">Verifica tu Email</h1>
          <p className="auth-subtitle">
            Hemos enviado un código de verificación a <strong>{email}</strong>
          </p>
        </div>

        <div className="verify-info">
          <p>
            Revisa tu bandeja de entrada (y spam) para encontrar el código de verificación.
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="verify-actions">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleResend}
            loading={isLoading}
            disabled={countdown > 0}
          >
            {countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar Código'}
          </Button>

          <Button
            variant="text"
            size="md"
            fullWidth
            onClick={onSkip}
            disabled={isLoading}
          >
            Omitir por ahora
          </Button>
        </div>

        <div className="verify-note">
          <p>
            ¿Ya tienes el código? Ingresa el token de verificación que recibiste por email.
          </p>
        </div>
      </div>
    </div>
  );
}
