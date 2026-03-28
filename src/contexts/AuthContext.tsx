import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Environment, Profile } from '../types';
import type { User } from '../types/auth';
import type { PlanType } from '../types/payment';
import {
  saveEnvironment,
  getEnvironment,
  getAllEnvironments,
  getDarkMode,
  setDarkMode,
  saveUserSession as saveEnvUserSession,
  getUserSession,
  clearUserSession,
  clearAllEvents,
} from '../services/database';
import {
  createUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  verifyEmail as verifyEmailService,
  resendVerificationEmail,
  requestPasswordReset as requestResetService,
  resetPassword as resetPasswordService,
  upgradeToPremium as upgradeService,
} from '../services/authService';
import { getUserPlan, initializeDiscountCodes } from '../services/subscriptionService';
import { generateId, getInitials, generateAvatarColor, generateFamilyCode } from '../utils/helpers';
import { getCreatedEnvironmentIdsForUser, registerCreatedEnvironment } from '../utils/familyLimits';
import { updateEventsColorForProfile } from '../services/database';

interface AuthContextType {
  // User auth
  currentUser: User | null;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isPremium: boolean;
  userPlan: PlanType;
  isLoading: boolean;

  // Auth actions
  register: (email: string, password: string) => Promise<User & { verificationToken: string }>;
  login: (email: string, password: string, rememberSession?: boolean) => Promise<User | null>;
  logout: () => Promise<void>;
  closeFamily: () => Promise<void>;
  verifyEmail: (token: string, email?: string) => Promise<boolean>;
  resendVerificationEmail: (email: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  upgradeToPremium: () => Promise<void>;
  refreshSubscription: () => Promise<void>;

  // Environment (legacy support)
  environment: Environment | null;
  activeProfile: Profile | null;
  createEnvironment: (
    name: string,
    pin?: string,
    initialProfiles?: Array<{ name: string; permissions: 'admin' | 'readonly' }>,
    familyCode?: string
  ) => Promise<Environment>;
  loadEnvironment: (id: string) => Promise<void>;
  addProfile: (name: string, email: string, permissions: 'admin' | 'readonly', pin?: string, recoveryEmail?: string, avatarColor?: string) => Promise<Profile>;
  updateProfile: (profile: Profile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setActiveProfile: (profileId: string) => void;
  findProfileByEmail: (email: string) => Profile | undefined;
  
  // Settings
  darkMode: boolean;
  toggleDarkMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<PlanType>('FREE');

  // Environment state (legacy)
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>();
  const [darkMode, setDarkModeState] = useState<boolean>(false);

  // Load current user on mount
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        await initializeDiscountCodes();
        
        const user = await getCurrentUser();
        if (!isMounted) return;
        setCurrentUser(user);

        if (user) {
          const plan = await getUserPlan(user.id);
          if (!isMounted) return;
          setUserPlan(plan);

          const envId = await getUserSession(user.email);
          if (!isMounted) return;
          if (envId) {
            let env = await getEnvironment(envId);
            if (!isMounted) return;

            // Si el envId guardado no corresponde a un ambiente válido,
            // intentar recuperar buscando todos los ambientes en IndexedDB
            // (puede ocurrir si la sesión apunta a un id obsoleto)
            if (!env) {
              const allEnvs = await getAllEnvironments();
              if (allEnvs.length > 0) {
                // Usar el más reciente como fallback
                env = allEnvs[allEnvs.length - 1];
                // Reparar la sesión apuntando al ambiente encontrado
                await saveEnvUserSession(user.email, env.id);
              } else {
                // No hay ningún ambiente: limpiar la sesión corrupta
                await clearUserSession(user.email);
              }
            }

            if (!isMounted) return;
            if (env) {
              setEnvironment(env);
              if (env.activeProfileId) {
                setActiveProfileId(env.activeProfileId);
              } else if (env.profiles?.length > 0) {
                setActiveProfileId(env.profiles[0].id);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Load dark mode
  useEffect(() => {
    getDarkMode().then(setDarkModeState);
  }, []);

  // Apply dark mode to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const activeProfile = environment?.profiles.find(p => p.id === activeProfileId) || null;
  const isEmailVerified = currentUser?.emailVerified ?? false;
  const isPremium = userPlan !== 'FREE';

  // Refresh subscription status
  const refreshSubscription = useCallback(async () => {
    if (!currentUser) return;
    try {
      const plan = await getUserPlan(currentUser.id);
      setUserPlan(plan);
    } catch (error) {
      console.error('Error refreshing subscription:', error);
    }
  }, [currentUser]);

  // Auth actions
  const register = useCallback(async (email: string, password: string) => {
    const result = await createUser(email, password);
    // createUser ya guardó el user en localStorage vía saveCurrentUser()
    // solo actualizar el estado local sin llamar getCurrentUser() de nuevo
    const { passwordHash: _ph, ...userForState } = result;
    setCurrentUser(userForState as User);
    return result;
  }, []);

  const login = useCallback(async (email: string, password: string, rememberSession = true) => {
    const user = await loginUser(email, password, rememberSession);
    if (user) setCurrentUser(user);

    // Load subscription status
    if (user) {
      const plan = await getUserPlan(user.id);
      setUserPlan(plan);
    }

    // Registrar device token FCM en el backend (sin bloquear)
    if (user) {
      void import('../services/pushRegistrationService')
        .then((m) => m.registerDeviceTokenAfterLogin())
        .catch(() => {});
    }

    // Load user's environment
    const envId = await getUserSession(email);
    if (envId) {
      let env = await getEnvironment(envId);

      // Fallback: si el envId no existe, recuperar cualquier ambiente guardado
      if (!env) {
        const allEnvs = await getAllEnvironments();
        if (allEnvs.length > 0) {
          env = allEnvs[allEnvs.length - 1];
          await saveEnvUserSession(email, env.id);
        } else {
          await clearUserSession(email);
        }
      }

      if (env) {
        setEnvironment(env);
        if (env.activeProfileId) {
          setActiveProfileId(env.activeProfileId);
        } else if (env.profiles?.length > 0) {
          setActiveProfileId(env.profiles[0].id);
        }
      }
    }

    return user;
  }, []);

  const logout = useCallback(async () => {
    const email = currentUser?.email;
    await logoutUser();

    if (email) {
      await clearUserSession(email);
    }

    await clearAllEvents();
    setCurrentUser(null);
    setEnvironment(null);
    setActiveProfileId(undefined);
  }, [currentUser]);

  // Cierra la "familia" (environment) actual sin desloguear.
  // Útil para que el usuario pueda entrar a otra familia.
  const closeFamily = useCallback(async () => {
    if (!currentUser) return;
    await clearUserSession(currentUser.email);
    await clearAllEvents();
    setEnvironment(null);
    setActiveProfileId(undefined);
  }, [currentUser]);

  const verifyEmail = useCallback(async (token: string, email?: string) => {
    const success = await verifyEmailService(token, email);
    if (success && currentUser) {
      setCurrentUser({ ...currentUser, emailVerified: true });
    }
    return success;
  }, [currentUser]);

  const handleResendVerificationEmail = useCallback(async (email: string) => {
    return resendVerificationEmail(email);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    return requestResetService(email);
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    return resetPasswordService(token, newPassword);
  }, []);

  const upgradeToPremium = useCallback(async () => {
    if (!currentUser) throw new Error('No user logged in');
    await upgradeService(currentUser.email);
    setCurrentUser(prev => prev ? { ...prev, planStatus: 'PREMIUM' } : null);
  }, [currentUser]);

  // Environment actions (legacy support)
  const createEnvironment = useCallback(async (
    name: string,
    pin?: string,
    initialProfiles?: Array<{ name: string; permissions: 'admin' | 'readonly' }>,
    familyCode?: string
  ): Promise<Environment> => {
    if (currentUser) {
      const created = getCreatedEnvironmentIdsForUser(currentUser.id);
      if (created.length >= 1 && !isPremium) {
        throw new Error(
          'Ya creaste una familia con esta cuenta. Para crear otra familía necesitás una suscripción Premium (mensual o anual).'
        );
      }
    }

    if (!isPremium && initialProfiles && initialProfiles.length > 3) {
      throw new Error('El plan Gratis permite hasta 3 perfiles por familia.');
    }

    const profiles: Profile[] = [];
    let activeProfileId: string | undefined;

    if (initialProfiles && initialProfiles.length > 0) {
      for (let i = 0; i < initialProfiles.length; i++) {
        const prof = initialProfiles[i];
        const profile: Profile = {
          id: generateId(),
          name: prof.name,
          email: (i === 0 ? (currentUser?.email || '').toLowerCase() : '') || '',
          avatarColor: generateAvatarColor(),
          initials: getInitials(prof.name),
          permissions: 'admin',
          createdAt: new Date(),
        };
        profiles.push(profile);
        activeProfileId = profile.id;
      }
    }

    const env: Environment = {
      id: generateId(),
      name,
      pin,
      profiles,
      activeProfileId,
      familyCode: familyCode || generateFamilyCode(),
      planType: 'FREE',
      createdAt: new Date(),
    };
    await saveEnvironment(env);
    setEnvironment(env);
    if (activeProfileId) {
      setActiveProfileId(activeProfileId);
    }
    
    // Save environment for current user
    if (currentUser) {
      await saveEnvUserSession(currentUser.email, env.id);
      registerCreatedEnvironment(currentUser.id, env.id);
    }
    
    return env;
  }, [currentUser, isPremium]);

  const loadEnvironment = useCallback(async (id: string) => {
    const env = await getEnvironment(id);
    if (env) {
      setEnvironment(env);
      if (env.activeProfileId && env.profiles?.find(p => p.id === env.activeProfileId)) {
        setActiveProfileId(env.activeProfileId);
      } else if (env.profiles && env.profiles.length > 0) {
        const byEmail = currentUser?.email
          ? env.profiles.find(p => p.email?.toLowerCase() === currentUser.email.toLowerCase())
          : undefined;
        setActiveProfileId((byEmail || env.profiles[0]).id);
      }
      
      // Save environment for current user
      if (currentUser) {
        await saveEnvUserSession(currentUser.email, id);
      }
    }
  }, [currentUser]);

  const addProfile = useCallback(async (
    name: string,
    email: string,
    permissions: 'admin' | 'readonly',
    pin?: string,
    recoveryEmail?: string,
    avatarColor?: string
  ): Promise<Profile> => {
    if (!environment) {
      throw new Error('No environment loaded');
    }

    if (!isPremium && environment.profiles.length >= 3) {
      throw new Error('Límite del plan Gratis: máximo 3 perfiles.');
    }

    // Verificar que el email no esté ya en esta familia
    const emailNorm = email.trim().toLowerCase();
    if (emailNorm) {
      const exists = environment.profiles.some(
        p => p.email.trim().toLowerCase() === emailNorm
      );
      if (exists) {
        throw new Error('Este email ya pertenece a un integrante de esta familia');
      }
    }

    const ownerEmail = currentUser?.email?.trim().toLowerCase();
    if (ownerEmail && emailNorm === ownerEmail) {
      const ownerAlready = environment.profiles.some(
        p => p.email.trim().toLowerCase() === ownerEmail
      );
      if (ownerAlready) {
        throw new Error('Solo puede haber un perfil asociado al email de tu cuenta en esta familia.');
      }
    }

    const profile: Profile = {
      id: generateId(),
      name,
      email: email.toLowerCase(),
      avatarColor: avatarColor || generateAvatarColor(),
      initials: getInitials(name),
      permissions,
      pin,
      recoveryEmail,
      createdAt: new Date(),
    };

    const updatedEnv = {
      ...environment,
      profiles: [...environment.profiles, profile],
      activeProfileId: profile.id,
    };

    await saveEnvironment(updatedEnv);
    setEnvironment(updatedEnv);
    setActiveProfileId(profile.id);

    if (email) {
      await saveEnvUserSession(email.toLowerCase(), updatedEnv.id);
    }

    return profile;
  }, [environment, currentUser, isPremium]);

  const updateProfile = useCallback(async (profile: Profile) => {
    if (!environment) throw new Error('No environment loaded');

    // El color se resuelve en tiempo de renderizado en la UI

    const updatedEnv = {
      ...environment,
      profiles: environment.profiles.map(p => p.id === profile.id ? profile : p),
    };

    await saveEnvironment(updatedEnv);
    setEnvironment(updatedEnv);
    await updateEventsColorForProfile(profile.id, profile.avatarColor);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agenda-reload-events'));
    }
  }, [environment]);

  const deleteProfile = useCallback(async (id: string) => {
    if (!environment) throw new Error('No environment loaded');

    const updatedEnv = {
      ...environment,
      profiles: environment.profiles.filter(p => p.id !== id),
    };

    if (activeProfileId === id) {
      updatedEnv.activeProfileId = updatedEnv.profiles[0]?.id;
      setActiveProfileId(updatedEnv.profiles[0]?.id);
    }

    await saveEnvironment(updatedEnv);
    setEnvironment(updatedEnv);
  }, [environment, activeProfileId]);

  const setActiveProfile = useCallback((profileId: string) => {
    setActiveProfileId(profileId);
    if (environment) {
      saveEnvironment({ ...environment, activeProfileId: profileId });
    }
  }, [environment]);

  const toggleDarkMode = useCallback(async () => {
    const newMode = !darkMode;
    setDarkModeState(newMode);
    await setDarkMode(newMode);
  }, [darkMode]);

  const findProfileByEmail = useCallback((email: string): Profile | undefined => {
    if (!environment) return undefined;
    return environment.profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
  }, [environment]);

  return (
    <AuthContext.Provider value={{
      // User auth
      currentUser,
      isAuthenticated: !!currentUser,
      isEmailVerified,
      isPremium,
      userPlan,
      isLoading,

      // Auth actions
      register,
      login,
      logout,
      closeFamily,
      verifyEmail,
      resendVerificationEmail: handleResendVerificationEmail,
      requestPasswordReset,
      resetPassword,
      upgradeToPremium,
      refreshSubscription,

      // Environment (legacy)
      environment,
      activeProfile,
      createEnvironment,
      loadEnvironment,
      addProfile,
      updateProfile,
      deleteProfile,
      setActiveProfile,
      findProfileByEmail,
      
      // Settings
      darkMode,
      toggleDarkMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
