import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Input } from '../Input';
import {
  canUseBiometric,
  hasBiometricCredentials,
  isBiometricEnabled,
  loginWithBiometricPrompt,
  saveBiometricCredentials,
  setBiometricEnabled as persistBiometricEnabled,
} from '../../services/biometricAuth';
import type { User } from '../../types/auth';
import './Auth.css';
import AppLogo from '../../assets/logo/logo_principal.png';

interface LoginProps {
  onSwitchToRegister: () => void;
  onSwitchToReset: () => void;
  onLoginSuccess: (emailVerified?: boolean, user?: User | null) => void;
}

export function Login({ onSwitchToRegister, onSwitchToReset, onLoginSuccess }: LoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [canBiometric, setCanBiometric] = useState(false);
  const [hasBioCreds, setHasBioCreds] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(isBiometricEnabled());

  useEffect(() => {
    canUseBiometric().then(setCanBiometric).catch(() => setCanBiometric(false));
  }, []);

  useEffect(() => {
    if (!canBiometric) {
      setHasBioCreds(false);
      return;
    }
    hasBiometricCredentials().then(setHasBioCreds).catch(() => setHasBioCreds(false));
  }, [canBiometric]);

  useEffect(() => {
    persistBiometricEnabled(biometricEnabled);
  }, [biometricEnabled]);

  useEffect(() => {
    // En mobile, priorizar acceso biométrico cuando está activo.
    if (!canBiometric || !biometricEnabled || !hasBioCreds || isLoading) return;
    const tried = sessionStorage.getItem('autoBiometricTried');
    if (tried === 'true') return;
    sessionStorage.setItem('autoBiometricTried', 'true');
    void handleBiometricLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canBiometric, biometricEnabled, hasBioCreds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(email, password, rememberSession);

      // Guardado biométrico con protección: timeout de 3s + captura silenciosa de errores
      if (biometricEnabled && canBiometric) {
        try {
          await Promise.race([
            saveBiometricCredentials(email, password),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Biometric timeout')), 3000)
            ),
          ]);
          setHasBioCreds(true);
        } catch (bioError) {
          console.warn('[Login] Biometría falló silenciosamente:', bioError);
        }
      }
      onLoginSuccess(user?.emailVerified, user || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const creds = await loginWithBiometricPrompt();
      setEmail(creds.email);
      setPassword(creds.password);
      const user = await login(creds.email, creds.password, true);
      onLoginSuccess(user?.emailVerified, user || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar con biometría');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <img
              src={AppLogo}
              alt="Importmania / Sol y Verde"
              className="w-48 h-auto mx-auto mb-8 rounded-2xl shadow-md object-cover"
            />
          </div>
          <h1 className="auth-title">Iniciar Sesión</h1>
          <p className="auth-subtitle">Accede a tu agenda Dommuss</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="on">
          <Input
            type="email"
            label="Email"
            name="username"
            autoComplete="username email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            disabled={isLoading}
          />

          <Input
            type="password"
            label="Contraseña"
            name="current-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isLoading}
          />

          <label className="auth-option-toggle">
            <input
              type="checkbox"
              checked={rememberSession}
              onChange={(e) => setRememberSession(e.target.checked)}
            />
            <span>Mantener sesión iniciada</span>
          </label>

          {canBiometric && (
            <label className="auth-option-toggle">
              <input
                type="checkbox"
                checked={biometricEnabled}
                onChange={(e) => setBiometricEnabled(e.target.checked)}
              />
              <span>Ingreso biométrico</span>
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={!email || !password}
          >
            Iniciar Sesión
          </Button>

          {canBiometric && biometricEnabled && hasBioCreds && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={handleBiometricLogin}
              disabled={isLoading}
            >
              Ingresar con biometría
            </Button>
          )}
        </form>

        <div className="auth-footer">
          <button
            className="auth-link"
            onClick={onSwitchToReset}
            type="button"
          >
            ¿Olvidaste tu contraseña?
          </button>
          <div className="auth-divider">
            <span>¿No tienes cuenta?</span>
          </div>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={onSwitchToRegister}
            type="button"
          >
            Crear cuenta nueva
          </Button>
        </div>
      </div>
    </div>
  );
}
