import { useState, useCallback } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { getInitials, generateAvatarColor } from '../utils/helpers';
import './UserAuth.css';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthComplete: (userData: {
    name: string;
    email: string;
    pin: string;
    recoveryEmail: string;
    avatarColor: string;
    permissions: 'admin' | 'readonly';
  }) => void;
  existingProfiles: Array<{ id: string; name: string; email: string; avatarColor: string }>;
}

type AuthStep = 'email' | 'register' | 'pin';

export function UserAuthModal({
  isOpen,
  onClose,
  onAuthComplete,
  existingProfiles,
}: UserAuthModalProps) {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [avatarColor, setAvatarColor] = useState(generateAvatarColor());
  const [error, setError] = useState('');

  const colors = [
    '#1E88E5', '#43A047', '#FB8C00', '#8E24AA',
    '#E53935', '#00ACC1', '#5D4037', '#6D6D6D'
  ];

  // Check if email exists
  const handleEmailSubmit = useCallback(() => {
    const normalizedEmail = email.toLowerCase().trim();
    const existingProfile = existingProfiles.find(
      p => p.email.toLowerCase() === normalizedEmail
    );

    if (existingProfile) {
      // Existing user - go to PIN entry
      setStep('pin');
    } else {
      // New user - go to registration
      setStep('register');
    }
  }, [email, existingProfiles]);

  const handleRegister = useCallback(() => {
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!email.trim()) {
      setError('El email es obligatorio');
      return;
    }
    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }
    if (pin !== confirmPin) {
      setError('Los PINs no coinciden');
      return;
    }

    onAuthComplete({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      pin,
      recoveryEmail: recoveryEmail.toLowerCase().trim(),
      avatarColor,
      permissions: 'admin' as const,
    });
  }, [name, email, pin, confirmPin, recoveryEmail, avatarColor, onAuthComplete]);

  const handlePinSubmit = useCallback(() => {
    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }

    onAuthComplete({
      name: '',
      email: email.toLowerCase().trim(),
      pin,
      recoveryEmail: '',
      avatarColor: '',
      permissions: 'admin',
    });
  }, [email, pin, onAuthComplete]);

  const handleClose = () => {
    setEmail('');
    setName('');
    setPin('');
    setConfirmPin('');
    setRecoveryEmail('');
    setAvatarColor(generateAvatarColor());
    setError('');
    setStep('email');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'email' ? 'Ingresar' : step === 'register' ? 'Crear Perfil' : 'Ingresa tu PIN'}
      showCloseButton={true}
    >
      <div className="user-auth">
        {step === 'email' && (
          <div className="user-auth-step">
            <div className="user-auth-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <p className="user-auth-description">
              Ingresa tu email para continuar
            </p>

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoFocus
            />

            <Button
              variant="primary"
              fullWidth
              onClick={handleEmailSubmit}
              disabled={!email.trim()}
            >
              Continuar
            </Button>
          </div>
        )}

        {step === 'register' && (
          <div className="user-auth-step">
            <div className="user-auth-avatar-preview">
              <Avatar
                name={name || 'Nombre'}
                initials={name ? getInitials(name) : '??'}
                color={avatarColor}
                size="xl"
              />
            </div>

            <Input
              label="Nombre *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
            />

            <Input
              label="Email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              disabled
            />

            <Input
              label="PIN (4 dígitos) *"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />

            <Input
              label="Confirmar PIN *"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />

            <Input
              label="Email de recuperación (opcional)"
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="otro@email.com"
            />

            <div className="user-auth-section">
              <label className="user-auth-label">Tu color:</label>
              <div className="user-auth-colors">
                {colors.map((color) => (
                  <button
                    key={color}
                    className={`user-auth-color ${avatarColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setAvatarColor(color)}
                    type="button"
                  />
                ))}
              </div>
            </div>

            {error && <p className="user-auth-error">{error}</p>}

            <div className="user-auth-actions">
              <Button variant="secondary" onClick={handleClose}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleRegister}>
                Crear Perfil
              </Button>
            </div>
          </div>
        )}

        {step === 'pin' && (
          <div className="user-auth-step">
            <div className="user-auth-pin-display">
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
                />
              ))}
            </div>

            <div className="user-auth-pin-pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  className="user-auth-pin-btn"
                  onClick={() => setPin(prev => (prev.length < 4 ? prev + num : prev))}
                  type="button"
                >
                  {num}
                </button>
              ))}
              <button
                className="user-auth-pin-btn"
                onClick={() => setPin('')}
                type="button"
              >
                C
              </button>
              <button
                className="user-auth-pin-btn"
                onClick={() => setPin(prev => prev.slice(0, -1))}
                type="button"
              >
                ⌫
              </button>
              <button
                className="user-auth-pin-btn"
                onClick={() => setPin(prev => (prev.length < 4 ? prev + '0' : prev))}
                type="button"
              >
                0
              </button>
            </div>

            {error && <p className="user-auth-error">{error}</p>}

            <Button
              variant="primary"
              fullWidth
              onClick={handlePinSubmit}
              disabled={pin.length !== 4}
              className="user-auth-submit"
            >
              Ingresar
            </Button>

            <button
              className="user-auth-forgot-pin"
              onClick={() => {/* TODO: Implement PIN recovery */}}
              type="button"
            >
              ¿Olvidaste tu PIN?
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
