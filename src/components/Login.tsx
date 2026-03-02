import { useState } from 'react';
import type { Environment } from '../types';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { Input } from './Input';
import './Login.css';

interface LoginScreenProps {
  environments: Array<{ id: string; name: string; pin?: string }>;
  onSelectEnvironment: (env: { id: string; name: string; pin?: string }) => void;
  onCreateNew: () => void;
}

export function LoginScreen({ environments, onSelectEnvironment, onCreateNew }: LoginScreenProps) {
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  const handleSelectEnvironment = (env: { id: string; name: string; pin?: string }) => {
    if (env.pin) {
      setSelectedEnv(env as Environment);
    } else {
      onSelectEnvironment(env);
    }
  };
  
  const handlePinSubmit = () => {
    if (!selectedEnv) return;
    
    if (pin === selectedEnv.pin) {
      onSelectEnvironment(selectedEnv);
    } else {
      setError('PIN incorrecto');
      setPin('');
    }
  };
  
  const handleBack = () => {
    setSelectedEnv(null);
    setPin('');
    setError('');
  };
  
  if (selectedEnv) {
    return (
      <div className="login-screen">
        <div className="login-content">
          <button className="login-back-btn" onClick={handleBack} aria-label="Volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          
          <div className="login-pin-header">
            <Avatar
              name={selectedEnv.name}
              initials={selectedEnv.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              color="#1976d2"
              size="xl"
            />
            <h1 className="login-title">{selectedEnv.name}</h1>
            <p className="login-subtitle">Ingresa tu PIN para continuar</p>
          </div>
          
          <div className="login-pin-input">
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              autoFocus
            />
            {error && <span className="input-error-message">{error}</span>}
          </div>
          
          <div className="login-pin-dots">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
              />
            ))}
          </div>
          
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handlePinSubmit}
            disabled={pin.length === 0}
          >
            Continuar
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="login-screen">
      <div className="login-content">
        <div className="login-header">
          <div className="login-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h1 className="login-title">Agenda Tiendas</h1>
          <p className="login-subtitle">Selecciona un entorno o crea uno nuevo</p>
        </div>
        
        {environments.length > 0 ? (
          <div className="login-environments">
            {environments.map(env => (
              <button
                key={env.id}
                className="login-environment-item"
                onClick={() => handleSelectEnvironment(env)}
              >
                <Avatar
                  name={env.name}
                  initials={env.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  color="#1976d2"
                  size="md"
                />
                <span className="login-environment-name">{env.name}</span>
                {env.pin && (
                  <span className="login-environment-lock">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v7" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="login-empty">
            <p>No hay entornos configurados</p>
          </div>
        )}
        
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={onCreateNew}
          leftIcon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          Crear nuevo entorno
        </Button>
      </div>
    </div>
  );
}
