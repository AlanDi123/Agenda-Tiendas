import { useState, useCallback } from 'react';
import type { Profile } from '../types';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { LogViewer } from './LogViewer';
import { SubscriptionStatus } from './Subscription/SubscriptionStatus';
import { SubscriptionModal } from './Subscription/SubscriptionModal';
import { useAuth } from '../contexts/AuthContext';
import './UserSettings.css';

interface UserSettingsModalProps {
  isOpen: boolean;
  profile: Profile | null;
  onClose: () => void;
  onUpdateProfile: (profile: Profile) => void;
  onLogout: () => void;
  onCloseFamily: () => void;
}

export function UserSettingsModal({
  isOpen,
  profile,
  onClose,
  onUpdateProfile,
  onLogout,
  onCloseFamily,
}: UserSettingsModalProps) {
  const { isPremium } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'subscription'>('profile');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState(profile?.recoveryEmail || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const colors = [
    '#1E88E5', '#43A047', '#FB8C00', '#8E24AA',
    '#E53935', '#00ACC1', '#5D4037', '#6D6D6D'
  ];

  const handleColorChange = useCallback((color: string) => {
    if (!profile) return;
    onUpdateProfile({ ...profile, avatarColor: color });
    setSuccess('Color actualizado');
    setTimeout(() => setSuccess(''), 2000);
  }, [profile, onUpdateProfile]);

  const handlePinChange = useCallback(() => {
    if (!profile) return;
    
    if (currentPin !== profile.pin) {
      setError('PIN actual incorrecto');
      return;
    }
    
    if (newPin.length !== 4) {
      setError('El nuevo PIN debe tener 4 dígitos');
      return;
    }
    
    if (newPin !== confirmPin) {
      setError('Los PINs no coinciden');
      return;
    }
    
    onUpdateProfile({ ...profile, pin: newPin });
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setSuccess('PIN actualizado');
    setTimeout(() => setSuccess(''), 2000);
    setError('');
  }, [profile, currentPin, newPin, confirmPin, onUpdateProfile]);

  const handleRecoveryEmailChange = useCallback(() => {
    if (!profile) return;
    
    onUpdateProfile({ ...profile, recoveryEmail });
    setSuccess('Email de recuperación actualizado');
    setTimeout(() => setSuccess(''), 2000);
  }, [profile, recoveryEmail, onUpdateProfile]);

  const handleClose = () => {
    setError('');
    setSuccess('');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    onClose();
  };

  if (!profile) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Configuración"
      showCloseButton={true}
    >
      <div className="user-settings">
        <div className="user-settings-header">
          <Avatar
            name={profile.name}
            initials={profile.initials}
            color={profile.avatarColor}
            size="xl"
          />
          <div className="user-settings-info">
            <h3 className="user-settings-name">{profile.name}</h3>
            <p className="user-settings-email">{profile.email}</p>
          </div>
        </div>

        <div className="user-settings-tabs">
          <button
            className={`user-settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            type="button"
          >
            Perfil
          </button>
          <button
            className={`user-settings-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
            type="button"
          >
            Seguridad
          </button>
          <button
            className={`user-settings-tab ${activeTab === 'subscription' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscription')}
            type="button"
          >
            {isPremium ? '⭐ Premium' : '🚀 Upgrade'}
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="user-settings-content">
            <div className="user-settings-section">
              <h4 className="user-settings-section-title">Tu color</h4>
              <div className="user-settings-colors">
                {colors.map((color) => (
                  <button
                    key={color}
                    className={`user-settings-color ${profile.avatarColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subscription' && (
          <div className="user-settings-content">
            <div className="user-settings-section">
              <h4 className="user-settings-section-title">Tu Plan</h4>
              
              <div className="subscription-summary-card">
                <div className="subscription-badge">
                  {isPremium ? (
                    <>
                      <span className="badge-icon">⭐</span>
                      <span className="badge-text">Premium</span>
                    </>
                  ) : (
                    <>
                      <span className="badge-icon">🆓</span>
                      <span className="badge-text">Gratis</span>
                    </>
                  )}
                </div>
                
                <p className="subscription-description">
                  {isPremium 
                    ? 'Tenés acceso a todas las funcionalidades premium.'
                    : 'Desbloqueá eventos recurrentes, alarmas y más.'}
                </p>
                
                {!isPremium && (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    Actualizar a Premium
                  </Button>
                )}
                
                {isPremium && (
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => setShowSubscription(true)}
                  >
                    Ver detalles de suscripción
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="user-settings-content">
            <div className="user-settings-section">
              <h4 className="user-settings-section-title">Cambiar PIN</h4>
              
              <Input
                label="PIN actual"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
              />
              
              <Input
                label="Nuevo PIN"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
              />
              
              <Input
                label="Confirmar nuevo PIN"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
              />
              
              <Button
                variant="primary"
                fullWidth
                onClick={handlePinChange}
                disabled={!currentPin || !newPin || !confirmPin}
              >
                Actualizar PIN
              </Button>
            </div>

            <div className="user-settings-section">
              <h4 className="user-settings-section-title">Email de recuperación</h4>
              
              <Input
                label="Email de recuperación"
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="otro@email.com"
              />
              
              <Button
                variant="secondary"
                fullWidth
                onClick={handleRecoveryEmailChange}
              >
                Guardar email
              </Button>
            </div>
          </div>
        )}

        {error && <p className="user-settings-error">{error}</p>}
        {success && <p className="user-settings-success">{success}</p>}

        <div className="user-settings-footer">
          <Button
            variant="text"
            fullWidth
            onClick={() => setShowLogViewer(true)}
            className="user-settings-logs"
          >
            🛠️ Ver Registro de Errores
          </Button>
          <Button
            variant="text"
            fullWidth
            onClick={onCloseFamily}
            className="user-settings-logout"
          >
            Cerrar familia
          </Button>
          <Button
            variant="text"
            fullWidth
            onClick={onLogout}
            className="user-settings-logout"
          >
            Cerrar sesión
          </Button>
        </div>
      </div>

      {/* Log Viewer Modal */}
      <LogViewer isOpen={showLogViewer} onClose={() => setShowLogViewer(false)} />
      
      {/* Subscription Status Modal */}
      <SubscriptionStatus
        isOpen={showSubscription}
        onClose={() => setShowSubscription(false)}
        onUpgrade={() => setShowUpgradeModal(true)}
      />
      
      {/* Subscription Upgrade Modal */}
      <SubscriptionModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={() => {
          setShowUpgradeModal(false);
          setShowSubscription(false);
        }}
      />
    </Modal>
  );
}
