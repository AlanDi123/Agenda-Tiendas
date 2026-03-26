import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import './EmailVerificationBanner.css';

export function EmailVerificationBanner() {
  const { currentUser, resendVerificationEmail, isEmailVerified, verifyEmail } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (isEmailVerified || isDismissed || !currentUser) return null;

  const handleResend = async () => {
    setIsSending(true);
    try {
      await resendVerificationEmail(currentUser.email);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error resending verification:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleVerifyCode = async () => {
    if (!currentUser || code.trim().length !== 6) return;
    setIsVerifying(true);
    try {
      await verifyEmail(code.trim(), currentUser.email);
      setShowCodeInput(false);
      setCode('');
    } catch (error) {
      console.error('Error verifying code:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="email-verification-banner">
      <div className="evb-content">
        <span className="evb-icon">📧</span>
        <div className="evb-text">
          <strong>Verifica tu email</strong>
          <span>
            {showSuccess 
              ? '¡Email de verificación reenviado!' 
              : `Hemos enviado un código de verificación a ${currentUser.email}`}
          </span>
        </div>
      </div>
      <div className="evb-actions">
        <Button
          variant="text"
          size="sm"
          onClick={handleResend}
          loading={isSending}
          disabled={showSuccess}
        >
          {showSuccess ? '¡Enviado!' : 'Reenviar'}
        </Button>
        <Button
          variant="text"
          size="sm"
          onClick={() => setShowCodeInput((v) => !v)}
          disabled={isVerifying}
        >
          {showCodeInput ? 'Ocultar código' : 'Poner código'}
        </Button>
        <Button
          variant="text"
          size="sm"
          onClick={handleDismiss}
        >
          ✕
        </Button>
      </div>
      {showCodeInput && (
        <div className="evb-actions" style={{ marginTop: 8 }}>
          <input
            type="text"
            value={code}
            inputMode="numeric"
            maxLength={6}
            placeholder="Código de 6 dígitos"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Button variant="text" size="sm" onClick={handleVerifyCode} loading={isVerifying} disabled={code.length !== 6}>
            Verificar
          </Button>
        </div>
      )}
    </div>
  );
}
