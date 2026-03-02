import { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Avatar } from './Avatar';
import { getInitials, generateAvatarColor } from '../utils/helpers';
import './Onboarding.css';

interface OnboardingProps {
  onComplete: (environmentName: string, pin: string | undefined, profiles: Array<{ name: string; permissions: 'admin' | 'readonly' }>) => void;
  existingEnvName?: string;
}

type OnboardingStep = 'welcome' | 'environment' | 'profiles' | 'first-profile' | 'done';

export function Onboarding({ onComplete, existingEnvName }: OnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>(existingEnvName ? 'first-profile' : 'welcome');
  const [environmentName, setEnvironmentName] = useState(existingEnvName || '');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [profiles, setProfiles] = useState<Array<{ name: string; permissions: 'admin' | 'readonly' }>>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePermissions, setNewProfilePermissions] = useState<'admin' | 'readonly'>('admin');
  
  // Skip to profiles step if environment name already exists
  useEffect(() => {
    if (existingEnvName) {
      setStep('first-profile');
    }
  }, [existingEnvName]);
  
  const handleContinueFromWelcome = () => {
    setStep('environment');
  };
  
  const handleContinueFromEnvironment = () => {
    if (!environmentName.trim()) return;
    setStep('first-profile');
  };
  
  const handleAddProfile = () => {
    if (!newProfileName.trim()) return;
    
    setProfiles(prev => [...prev, {
      name: newProfileName.trim(),
      permissions: newProfilePermissions,
    }]);
    
    setNewProfileName('');
    setNewProfilePermissions('admin');
  };
  
  const handleContinueFromProfiles = () => {
    if (profiles.length === 0) return;
    onComplete(environmentName.trim(), showPin ? pin : undefined, profiles);
    setStep('done');
  };
  
  const removeProfile = (index: number) => {
    setProfiles(prev => prev.filter((_, i) => i !== index));
  };
  
  return (
    <div className="onboarding">
      <div className="onboarding-content">
        {step === 'welcome' && (
          <div className="onboarding-step">
            <div className="onboarding-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h1 className="onboarding-title">Bienvenido a Agenda</h1>
            <p className="onboarding-description">
              La app para organizarte en pareja y familia.
              Comparte calendario, turnos y eventos de forma sencilla.
            </p>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleContinueFromWelcome}
            >
              Comenzar
            </Button>
          </div>
        )}
        
        {step === 'environment' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">Configura tu entorno</h2>
            <p className="onboarding-step-description">
              ¿Cómo quieres llamar a este entorno? Esto te ayudará a identificarlo
              si compartes el dispositivo con otros.
            </p>
            
            <div className="onboarding-input-group">
              <Input
                label="Nombre del entorno"
                value={environmentName}
                onChange={(e) => setEnvironmentName(e.target.value)}
                placeholder="Ej. Familia, Turnos Tienda, Equipo..."
                autoFocus
              />
              
              <div className="onboarding-pin-toggle">
                <label className="toggle-label">Proteger con PIN (opcional)</label>
                <button
                  className={`pin-toggle-btn ${showPin ? 'active' : ''}`}
                  onClick={() => setShowPin(!showPin)}
                  type="button"
                >
                  {showPin ? 'Activado' : 'Desactivado'}
                </button>
              </div>
              
              {showPin && (
                <Input
                  label="PIN de acceso"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="4-6 dígitos"
                  maxLength={6}
                />
              )}
            </div>
            
            <div className="onboarding-actions">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleContinueFromEnvironment}
                disabled={!environmentName.trim()}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}
        
        {step === 'first-profile' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">Crea los perfiles</h2>
            <p className="onboarding-step-description">
              Agrega las personas que compartirán este calendario. Cada perfil
              tendrá su propio avatar y permisos.
            </p>
            
            <div className="onboarding-profiles-input">
              <Input
                label="Nombre del perfil"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Ej. Juan, María..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddProfile()}
              />
              
              <div className="onboarding-permissions">
                <button
                  className={`permission-btn ${newProfilePermissions === 'admin' ? 'active' : ''}`}
                  onClick={() => setNewProfilePermissions('admin')}
                  type="button"
                >
                  Administrador
                </button>
                <button
                  className={`permission-btn ${newProfilePermissions === 'readonly' ? 'active' : ''}`}
                  onClick={() => setNewProfilePermissions('readonly')}
                  type="button"
                >
                  Solo lectura
                </button>
              </div>
              
              <Button
                variant="secondary"
                onClick={handleAddProfile}
                disabled={!newProfileName.trim()}
                leftIcon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                }
              >
                Agregar
              </Button>
            </div>
            
            {profiles.length > 0 && (
              <div className="onboarding-profiles-list">
                {profiles.map((profile, index) => (
                  <div key={index} className="onboarding-profile-item">
                    <Avatar
                      name={profile.name}
                      initials={getInitials(profile.name)}
                      color={generateAvatarColor()}
                      size="md"
                    />
                    <span className="onboarding-profile-name">{profile.name}</span>
                    <span className="onboarding-profile-permission">
                      {profile.permissions === 'admin' ? 'Admin' : 'Lectura'}
                    </span>
                    <button
                      className="onboarding-profile-remove"
                      onClick={() => removeProfile(index)}
                      aria-label={`Eliminar ${profile.name}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="onboarding-actions">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleContinueFromProfiles}
                disabled={profiles.length === 0}
              >
                Finalizar configuración
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="onboarding-progress">
        <div className={`progress-dot ${step === 'welcome' ? 'active' : ''}`} />
        <div className={`progress-dot ${step === 'environment' ? 'active' : ''}`} />
        <div className={`progress-dot ${step === 'first-profile' ? 'active' : ''}`} />
      </div>
    </div>
  );
}
