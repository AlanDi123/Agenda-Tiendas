import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Environment, Profile } from '../types';
import type { User } from '../types/auth';
import type { PlanType } from '../types/payment';
import {
  saveEnvironment,
  getEnvironment,
  getDarkMode,
  setDarkMode,
  saveUserSession as saveEnvUserSession,
  getUserSession,
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
import { hasPremiumAccess as _hasPremiumAccess, getUserPlan, getUserSubscription as _getUserSubscription, initializeDiscountCodes } from '../services/subscriptionService';
import { generateId, getInitials, generateAvatarColor, generateFamilyCode } from '../utils/helpers';

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
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<boolean>;
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
    initialProfiles?: Array<{ name: string; permissions: 'admin' | 'readonly' }>
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
    const initAuth = async () => {
      try {
        // Initialize discount codes
        await initializeDiscountCodes();

        const user = await getCurrentUser();
        setCurrentUser(user);

        // Load subscription status
        if (user) {
          const plan = await getUserPlan(user.id);
          setUserPlan(plan);

          // Load environment for this user if exists
          const envId = await getUserSession(user.email);
          if (envId) {
            const env = await getEnvironment(envId);
            if (env) {
              setEnvironment(env);
              if (env.activeProfileId) {
                setActiveProfileId(env.activeProfileId);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
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

  const login = useCallback(async (email: string, password: string) => {
    const user = await loginUser(email, password);
    if (user) setCurrentUser(user);

    // Load subscription status
    if (user) {
      const plan = await getUserPlan(user.id);
      setUserPlan(plan);
    }

    // Load user's environment
    const envId = await getUserSession(email);
    if (envId) {
      const env = await getEnvironment(envId);
      if (env) {
        setEnvironment(env);
        if (env.activeProfileId) {
          setActiveProfileId(env.activeProfileId);
        }
      }
    }

    return user;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setCurrentUser(null);
    setEnvironment(null);
    setActiveProfileId(undefined);
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    const success = await verifyEmailService(token);
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
    initialProfiles?: Array<{ name: string; permissions: 'admin' | 'readonly' }>
  ): Promise<Environment> => {
    const profiles: Profile[] = [];
    let activeProfileId: string | undefined;

    if (initialProfiles && initialProfiles.length > 0) {
      for (const prof of initialProfiles) {
        const profile: Profile = {
          id: generateId(),
          name: prof.name,
          email: currentUser?.email || '',
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
      familyCode: generateFamilyCode(),
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
    }
    
    return env;
  }, [currentUser]);

  const loadEnvironment = useCallback(async (id: string) => {
    const env = await getEnvironment(id);
    if (env) {
      setEnvironment(env);
      if (env.activeProfileId && env.profiles?.find(p => p.id === env.activeProfileId)) {
        setActiveProfileId(env.activeProfileId);
      } else if (env.profiles && env.profiles.length > 0) {
        setActiveProfileId(env.profiles[0].id);
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
    let currentEnv = environment;
    let attempts = 0;
    while (!currentEnv && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      currentEnv = environment;
      attempts++;
    }

    if (!currentEnv) {
      throw new Error('No environment loaded');
    }

    // Solo 1 perfil por familia (el dueño de la cuenta)
    if (currentEnv.profiles.length >= 1) {
      throw new Error('Solo puede haber 1 perfil por familia. Cada miembro debe ingresar con su propio código de familia.');
    }

    // Verificar que el email no esté ya en esta familia
    const emailNorm = email.trim().toLowerCase();
    if (emailNorm) {
      const exists = currentEnv.profiles.some(
        p => p.email.trim().toLowerCase() === emailNorm
      );
      if (exists) {
        throw new Error('Este email ya pertenece a un integrante de esta familia');
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
      ...currentEnv,
      profiles: [...currentEnv.profiles, profile],
      activeProfileId: profile.id,
    };

    await saveEnvironment(updatedEnv);
    setEnvironment(updatedEnv);
    setActiveProfileId(profile.id);

    if (email) {
      await saveEnvUserSession(email.toLowerCase(), updatedEnv.id);
    }

    return profile;
  }, [environment]);

  const updateProfile = useCallback(async (profile: Profile) => {
    if (!environment) throw new Error('No environment loaded');

    // Propagar cambio de color a todos los eventos asignados a este perfil
    const { getAllEvents, saveEvent } = await import('../services/database');
    const oldProfile = environment.profiles.find(p => p.id === profile.id);
    if (oldProfile && oldProfile.avatarColor !== profile.avatarColor) {
      const allEvents = await getAllEvents();
      for (const event of allEvents) {
        if (event.assignedProfileIds.includes(profile.id)) {
          await saveEvent({ ...event, color: profile.avatarColor, updatedAt: new Date() });
        }
      }
    }

    const updatedEnv = {
      ...environment,
      profiles: environment.profiles.map(p => p.id === profile.id ? profile : p),
    };

    await saveEnvironment(updatedEnv);
    setEnvironment(updatedEnv);
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
