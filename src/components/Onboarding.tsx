import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Avatar } from './Avatar';
import { getInitials, generateFamilyCode } from '../utils/helpers';
import './Onboarding.css';

const PLANS = [
  { id: 'FREE', name: 'Gratis', price: '$0', desc: 'Hasta 3 perfiles · 10 eventos/día' },
  { id: 'PREMIUM_MONTHLY', name: 'Mensual', price: '$35.000 ARS/mes', desc: 'Sin límites · Todas las features' },
  { id: 'PREMIUM_YEARLY', name: 'Anual', price: '$336.000 ARS/año', desc: '1er mes gratis · 20% de descuento', popular: true },
];

interface OnboardingProps {
  onComplete: (data: {
    environmentName: string;
    pin?: string;
    profiles: Array<{ name: string; permissions: 'admin' | 'readonly' }>;
    planType: 'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY';
    familyCode?: string;
  }) => void;
  existingEnvName?: string;
}

type Step = 'welcome' | 'choice' | 'join' | 'environment' | 'first-profile' | 'plan' | 'family-code' | 'done';

export function Onboarding({ onComplete, existingEnvName }: OnboardingProps) {
  const [step, setStep] = useState<Step>(existingEnvName ? 'first-profile' : 'welcome');
  const [environmentName, setEnvironmentName] = useState(existingEnvName || '');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [profiles, setProfiles] = useState<Array<{ name: string; permissions: 'admin' | 'readonly' }>>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePermissions] = useState<'admin' | 'readonly'>('admin');
  const [selectedPlan, setSelectedPlan] = useState<'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY'>('FREE');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const handleAddProfile = () => {
    if (!newProfileName.trim()) return;
    setProfiles(prev => [...prev, { name: newProfileName.trim(), permissions: newProfilePermissions }]);
    setNewProfileName('');
    setNewProfilePermissions('admin');
  };

  const removeProfile = (index: number) => setProfiles(prev => prev.filter((_, i) => i !== index));

  const handleJoinFamily = () => {
    if (joinCode.trim().length !== 8) { setJoinError('El código debe tener 8 caracteres'); return; }
    onComplete({ environmentName: '', profiles: [], planType: 'FREE', familyCode: joinCode.trim().toUpperCase() });
  };

  const handleFinish = () => {
    const code = generateFamilyCode();
    setGeneratedCode(code);
    onComplete({ environmentName: environmentName.trim(), pin: showPin ? pin : undefined, profiles, planType: selectedPlan, familyCode: code });
    setStep('family-code');
  };

  return (
    <div className="onboarding">
      <div className="onboarding-content">

        {step === 'welcome' && (
          <div className="onboarding-step">
            <div className="onboarding-icon">
              <svg viewBox="0 0 120 120" fill="none" width="80" height="80">
                <rect width="120" height="120" rx="22" fill="#FFFFFF"/>
                <rect width="120" height="120" rx="22" fill="none" stroke="#E0E0E0" strokeWidth="1"/>
                <path d="M60 28 L95 52 L95 92 L25 92 L25 52 Z" fill="#2196F3"/>
                <path d="M14 54 L60 18 L106 54 L95 60 L60 28 L25 60 Z" fill="#1565C0"/>
                <rect x="49" y="65" width="22" height="27" rx="3" fill="white"/>
                <circle cx="85" cy="34" r="18" fill="#FFC107"/>
                <path d="M75 34 L82 41 L96 27" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <h1 className="onboarding-title">Bienvenido a Dommuss</h1>
            <p className="onboarding-description">La app para organizarte con tu familia. Agenda, turnos y eventos siempre sincronizados.</p>
            <Button variant="primary" size="lg" fullWidth onClick={() => setStep('choice')}>Comenzar</Button>
          </div>
        )}

        {step === 'choice' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">¿Qué querés hacer?</h2>
            <p className="onboarding-step-description">Creá una nueva familia o ingresá a una ya existente.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
              <Button variant="primary" size="lg" fullWidth onClick={() => setStep('environment')}>
                Crear nueva familia
              </Button>
              <Button variant="secondary" size="lg" fullWidth onClick={() => setStep('join')}>
                Unirme a una familia existente
              </Button>
            </div>
          </div>
        )}

        {step === 'join' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">Ingresar a una familia</h2>
            <p className="onboarding-step-description">
              Ingresá el código de 8 caracteres que recibiste por email cuando se creó la familia.
            </p>
            <div style={{ marginTop: 24 }}>
              <input
                type="text"
                className="input"
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); setJoinError(''); }}
                placeholder="Ej: DOMMX7K2"
                maxLength={8}
                style={{ textAlign: 'center', fontSize: 24, fontWeight: 700, letterSpacing: '0.3em', width: '100%' }}
              />
              {joinError && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 8 }}>{joinError}</p>}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <Button variant="secondary" fullWidth onClick={() => setStep('choice')}>Volver</Button>
              <Button variant="primary" fullWidth onClick={handleJoinFamily} disabled={joinCode.length !== 8}>
                Ingresar
              </Button>
            </div>
          </div>
        )}

        {step === 'environment' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">Nombre de tu familia</h2>
            <p className="onboarding-step-description">¿Cómo quieres llamar a este entorno? Esto te ayudará a identificarlo si compartes el dispositivo con otros.</p>
            <div className="onboarding-input-group">
              <Input
                label="Nombre"
                value={environmentName}
                onChange={e => setEnvironmentName(e.target.value)}
                placeholder="Ej. Familia García, Turnos Tienda..."
                autoFocus
              />
              <div className="onboarding-pin-toggle">
                <label className="toggle-label">Proteger con PIN (opcional)</label>
                <button className={`pin-toggle-btn ${showPin ? 'active' : ''}`} onClick={() => setShowPin(!showPin)} type="button">
                  {showPin ? 'Activado' : 'Desactivado'}
                </button>
              </div>
              {showPin && (
                <Input
                  label="PIN de acceso" type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="4-6 dígitos" maxLength={6}
                />
              )}
            </div>
            <div className="onboarding-actions">
              <Button variant="primary" size="lg" fullWidth onClick={() => setStep('first-profile')} disabled={!environmentName.trim()}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 'first-profile' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">Crea los perfiles</h2>
            <p className="onboarding-step-description">Agregá las personas que compartirán este calendario.</p>
            <div className="onboarding-profiles-input">
              <Input
                label="Nombre del perfil" value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                placeholder="Ej. Juan, María..."
                onKeyDown={e => e.key === 'Enter' && handleAddProfile()}
              />
              {/* Todos los perfiles tienen acceso completo — sin modo lectura */}
              <Button variant="secondary" onClick={handleAddProfile} disabled={!newProfileName.trim()}
                leftIcon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
                Agregar
              </Button>
            </div>
            {profiles.length > 0 && (
              <div className="onboarding-profiles-list">
                {profiles.map((p, i) => (
                  <div key={i} className="onboarding-profile-item">
                    <Avatar name={p.name} initials={getInitials(p.name)} color="#1E88E5" size="md"/>
                    <span className="onboarding-profile-name">{p.name}</span>
                    <button className="onboarding-profile-remove" onClick={() => removeProfile(i)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="onboarding-actions">
              <Button variant="primary" size="lg" fullWidth onClick={() => setStep('plan')} disabled={profiles.length === 0}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 'plan' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">Elegí tu plan</h2>
            <p className="onboarding-step-description">Comenzá gratis o activá Premium para acceso completo.</p>
            {PLANS.map(plan => (
              <button
                key={plan.id} type="button"
                onClick={() => setSelectedPlan(plan.id as typeof selectedPlan)}
                style={{
                  width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: 10,
                  border: `2px solid ${selectedPlan === plan.id ? '#1E88E5' : 'var(--color-border)'}`,
                  borderRadius: 12, background: selectedPlan === plan.id ? '#E3F2FD' : 'var(--color-surface)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 15 }}>{plan.name}</strong>
                  {plan.popular && <span style={{ fontSize: 10, background: '#1E88E5', color: 'white', padding: '2px 8px', borderRadius: 20 }}>Recomendado</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E88E5', marginTop: 2 }}>{plan.price}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{plan.desc}</div>
              </button>
            ))}
            <Button variant="primary" size="lg" fullWidth onClick={handleFinish} style={{ marginTop: 8 }}>
              {selectedPlan === 'FREE' ? 'Comenzar gratis' : 'Continuar y pagar'}
            </Button>
          </div>
        )}

        {step === 'family-code' && generatedCode && (
          <div className="onboarding-step">
            <div className="onboarding-icon">🏠</div>
            <h2 className="onboarding-step-title">¡Tu familia está lista!</h2>
            <p className="onboarding-step-description">
              Este es el código único de tu familia. <strong>Guardalo bien</strong> — cada persona que quiera unirse deberá ingresarlo.
            </p>
            <div style={{
              background: 'var(--color-background-secondary)',
              border: '2px dashed var(--color-border-primary)',
              borderRadius: 12,
              padding: '20px 24px',
              margin: '20px 0',
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '0.2em',
              fontFamily: 'monospace',
              textAlign: 'center',
            }}>
              {generatedCode}
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              📧 También te lo enviamos al mail registrado.
            </p>
            <Button variant="primary" size="lg" fullWidth onClick={() => setStep('done')}>
              Entendido, comenzar
            </Button>
          </div>
        )}

      </div>

      {step !== 'done' && (
        <div className="onboarding-progress">
          {(['welcome', 'choice', 'environment', 'first-profile', 'plan'] as Step[]).map(s => (
            <div key={s} className={`progress-dot ${step === s ? 'active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
