import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import './EmailVerificationBanner.css';

export function EmailVerificationBanner() {
  const { currentUser, resendVerificationEmail, isEmailVerified } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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
          onClick={handleDismiss}
        >
          ✕
        </Button>
      </div>
    </div>
  );
}
