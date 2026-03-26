import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { Input } from '../Input';
import { canUseBiometric, isBiometricEnabled, loginWithBiometricPrompt, saveBiometricCredentials, setBiometricEnabled as persistBiometricEnabled } from '../../services/biometricAuth';
import './Auth.css';
import AppLogo from '../../assets/logo/logo_principal.png';

interface LoginProps {
  onSwitchToRegister: () => void;
  onSwitchToReset: () => void;
  onLoginSuccess: () => void;
}

export function Login({ onSwitchToRegister, onSwitchToReset, onLoginSuccess }: LoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [canBiometric, setCanBiometric] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(isBiometricEnabled());

  useEffect(() => {
    canUseBiometric().then(setCanBiometric).catch(() => setCanBiometric(false));
  }, []);

  useEffect(() => {
    persistBiometricEnabled(biometricEnabled);
  }, [biometricEnabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password, rememberSession);
      if (rememberSession && biometricEnabled && canBiometric) {
        await saveBiometricCredentials(email, password).catch(() => {});
      }
      onLoginSuccess();
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
      await login(creds.email, creds.password, true);
      onLoginSuccess();
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

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={rememberSession}
              onChange={(e) => setRememberSession(e.target.checked)}
            />
            Mantener sesión iniciada en este dispositivo
          </label>

          {canBiometric && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={biometricEnabled}
                onChange={(e) => setBiometricEnabled(e.target.checked)}
              />
              Permitir ingreso biométrico (huella/rostro)
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

          {canBiometric && biometricEnabled && (
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
