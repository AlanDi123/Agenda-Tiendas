import { useState, useCallback, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { useAuth } from '../contexts/AuthContext';
import './EmailVerificationModal.css';

interface EmailVerificationModalProps {
  isOpen: boolean;
  email: string;
  onSendCode: () => Promise<void>;
  onVerifyCode: (code: string) => Promise<boolean>;
  onClose: () => void;
  onSkip?: () => void;
  isRequired?: boolean;
}

export function EmailVerificationModal({
  isOpen,
  email,
  onSendCode,
  onVerifyCode,
  onClose,
  onSkip,
  isRequired = false,
}: EmailVerificationModalProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [resendTimer, setResendTimer] = useState(0);

  // Handle resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleSendCode = async () => {
    setIsSending(true);
    setError(null);

    try {
      await onSendCode();
      setCanResend(false);
      setResendTimer(60); // 60 seconds cooldown
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar código');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    const codeString = code.join('');

    if (codeString.length !== 6) {
      setError('Ingresa los 6 dígitos');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const success = await onVerifyCode(codeString);

      if (success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError('Código inválido');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar código');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(0, 1);

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleClose = () => {
    if (!isRequired) {
      onClose();
    }
  };

  if (success) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        variant="modal"
        showCloseButton={!isRequired}
        title="✅ Email Verificado"
      >
        <div className="email-verification-success">
          <p>¡Tu email ha sido verificado exitosamente!</p>
          <p className="success-subtitle">Redirigiendo...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant="modal"
      showCloseButton={!isRequired}
      title="📧 Verifica tu Email"
    >
      <div className="email-verification-modal">
        <div className="verification-info">
          <p>Hemos enviado un código de 6 dígitos a:</p>
          <p className="verification-email">{email}</p>
          <p className="verification-hint">
            Revisa tu bandeja de entrada (y spam) para encontrar el código.
          </p>
        </div>

        {/* Code Input */}
        <div className="verification-code-inputs">
          {code.map((digit, index) => (
            <input
              key={index}
              id={`code-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className="verification-code-input"
              value={digit}
              onChange={e => handleCodeChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              disabled={isVerifying}
              autoFocus={index === 0}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="verification-error">
            <span className="verification-error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Resend Code */}
        <div className="verification-resend">
          <p>¿No recibiste el código?</p>
          <Button
            variant="text"
            size="sm"
            onClick={handleSendCode}
            disabled={!canResend || isSending}
            type="button"
          >
            {isSending ? 'Enviando...' : canResend ? 'Reenviar' : `Reenviar en ${resendTimer}s`}
          </Button>
        </div>

        {/* Actions */}
        <div className="verification-actions">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleVerify}
            loading={isVerifying}
            disabled={code.some(d => !d)}
          >
            {isVerifying ? 'Verificando...' : 'Verificar Email'}
          </Button>

          {!isRequired && onSkip && (
            <Button
              variant="text"
              size="md"
              fullWidth
              onClick={onSkip}
              disabled={isVerifying}
            >
              Omitir por ahora
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
