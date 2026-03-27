import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { generateFamilyCode } from '../utils/helpers';
import './Onboarding.css';

const PLANS = [
  { id: 'FREE', name: 'Gratis', price: '$0', desc: 'Hasta 3 perfiles · 10 eventos/día' },
  { id: 'PREMIUM_MONTHLY', name: 'Mensual', price: '$20.000 ARS/mes', desc: 'Sin límites · Todas las features' },
  { id: 'PREMIUM_YEARLY', name: 'Anual', price: '$220.000 ARS/año', desc: '1 mes gratis', popular: true },
];

interface OnboardingProps {
  onComplete: (data: {
    environmentName: string;
    pin?: string;
    profiles: Array<{ name: string; permissions: 'admin' | 'readonly'; color?: string }>;
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
  const [userName, setUserName] = useState('');
  const [userColor, setUserColor] = useState('#FF6B35');
  const [isJoining, setIsJoining] = useState(false);
  const AVATAR_COLORS = ['#FF6B35', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63', '#00BCD4', '#FFC107', '#795548'];
  const [selectedPlan, setSelectedPlan] = useState<'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY'>('FREE');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [pendingCompleteData, setPendingCompleteData] = useState<{
    environmentName: string;
    pin?: string;
    profiles: Array<{ name: string; permissions: 'admin' | 'readonly'; color?: string }>;
    planType: 'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY';
    familyCode?: string;
  } | null>(null);

  const handleJoinFamily = () => {
    if (joinCode.trim().length !== 8) { setJoinError('El código debe tener 8 caracteres'); return; }
    setIsJoining(true);
    setStep('first-profile');
  };

  const handleSubmit = () => {
    onComplete({
      environmentName: '',
      familyCode: joinCode.trim().toUpperCase(),
      profiles: [{ name: userName, permissions: 'admin', color: userColor }],
      planType: 'FREE',
    });
  };

  const handleFinish = () => {
    const code = generateFamilyCode();
    setGeneratedCode(code);
    setPendingCompleteData({
      environmentName: environmentName.trim(),
      pin: showPin ? pin : undefined,
      profiles: [{ name: userName, permissions: 'admin', color: userColor }],
      planType: selectedPlan,
      familyCode: code,
    });
    setStep('family-code');
  };

  const handleCopyFamilyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // no-op
    }
  };

  const handleConfirmFamilyCode = () => {
    if (!pendingCompleteData) return;
    onComplete(pendingCompleteData);
    setStep('done');
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
            <h2 className="onboarding-step-title">Tu Perfil en la Familia</h2>
            <p className="onboarding-step-description">¿Cómo quieres que te vean los demás?</p>

            <input
              type="text"
              className="input"
              placeholder="Tu Nombre"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              style={{ width: '100%', marginTop: 8 }}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setUserColor(color)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%', backgroundColor: color,
                    border: userColor === color ? '3px solid #333' : '2px solid transparent',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>

            <div className="onboarding-actions" style={{ marginTop: '20px' }}>
              {isJoining ? (
                <Button variant="primary" size="lg" fullWidth onClick={handleSubmit} disabled={!userName.trim()}>
                  Ingresar
                </Button>
              ) : (
                <Button variant="primary" size="lg" fullWidth onClick={() => setStep('plan')} disabled={!userName.trim()}>
                  Continuar
                </Button>
              )}
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
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              📧 También te lo enviamos al mail registrado.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button variant="secondary" size="md" fullWidth onClick={handleCopyFamilyCode}>
                {copiedCode ? 'Copiado' : 'Copiar código'}
              </Button>
              <Button variant="primary" size="lg" fullWidth onClick={handleConfirmFamilyCode}>
                Ya guardé el código
              </Button>
            </div>
            <Button variant="text" size="md" fullWidth onClick={handleConfirmFamilyCode} style={{ marginTop: 8 }}>
              Continuar sin copiar
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
