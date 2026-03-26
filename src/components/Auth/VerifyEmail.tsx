import { useState, useEffect, useRef } from 'react';
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
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [info, setInfo] = useState('');
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (token) handleVerify(token);
  }, [token]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleVerify = async (verifyToken: string) => {
    setIsLoading(true);
    setError('');
    try {
      await verifyEmail(verifyToken);
      setSuccess(true);
      setTimeout(() => onVerificationComplete(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido o expirado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newCode.every(d => d !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      handleVerify(pasted);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setIsLoading(true);
    setError('');
    setInfo('');
    try {
      await resendVerificationEmail(email);
      setCountdown(60);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setInfo('Código reenviado. Revisá tu email y spam.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reenviar');
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
            <p className="auth-subtitle">Redirigiendo...</p>
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
          <h1 className="auth-title">Verificá tu Email</h1>
          <p className="auth-subtitle">
            Ingresá el código de 6 dígitos enviado a<br/><strong>{email}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '24px 0' }}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleCodeChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              style={{
                width: 44, height: 52, textAlign: 'center', fontSize: 24,
                fontWeight: 700, border: '2px solid var(--color-border)',
                borderRadius: 8, background: 'var(--color-surface)',
                color: 'var(--color-text-primary)', outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          ))}
        </div>

        {error && <div className="auth-error">{error}</div>}
        {!error && info && (
          <div className="auth-success" style={{ marginTop: 8 }}>
            {info}
          </div>
        )}

        {isLoading && <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>Verificando...</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button variant="text" size="md" fullWidth onClick={handleResend} disabled={countdown > 0 || isLoading}>
            {countdown > 0 ? `Reenviar código en ${countdown}s` : 'Reenviar código'}
          </Button>
          <Button variant="text" size="md" fullWidth onClick={onSkip} disabled={isLoading}>
            Omitir por ahora
          </Button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 16 }}>
          Revisá tu bandeja de entrada y la carpeta spam.
        </p>
      </div>
    </div>
  );
}
