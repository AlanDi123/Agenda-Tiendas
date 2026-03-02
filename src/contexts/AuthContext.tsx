import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Environment, Profile } from '../types';
import {
  saveEnvironment,
  getEnvironment,
  getDarkMode,
  setDarkMode,
  saveUserSession,
} from '../services/database';
import { generateId, getInitials, generateAvatarColor } from '../utils/helpers';

interface AuthContextType {
  environment: Environment | null;
  activeProfile: Profile | null;
  isAuthenticated: boolean;
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
  logout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => Promise<void>;
  findProfileByEmail: (email: string) => Profile | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>();
  const [darkMode, setDarkModeState] = useState<boolean>(false);

  // Cargar modo oscuro al iniciar
  useEffect(() => {
    getDarkMode().then(setDarkModeState);
  }, []);

  // Aplicar modo oscuro al DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const activeProfile = environment?.profiles.find(p => p.id === activeProfileId) || null;

  const createEnvironment = useCallback(async (
    name: string,
    pin?: string,
    initialProfiles?: Array<{ name: string; permissions: 'admin' | 'readonly' }>
  ): Promise<Environment> => {
    const profiles: Profile[] = [];
    let activeProfileId: string | undefined;
    
    // Create initial profiles if provided
    if (initialProfiles && initialProfiles.length > 0) {
      for (const prof of initialProfiles) {
        const profile: Profile = {
          id: generateId(),
          name: prof.name,
          email: '',
          avatarColor: generateAvatarColor(),
          initials: getInitials(prof.name),
          permissions: prof.permissions,
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
      createdAt: new Date(),
    };
    await saveEnvironment(env);
    setEnvironment(env);
    if (activeProfileId) {
      setActiveProfileId(activeProfileId);
    }
    return env;
  }, []);

  const loadEnvironment = useCallback(async (id: string) => {
    const env = await getEnvironment(id);
    if (env) {
      console.log('Loading environment:', env.name, 'profiles:', env.profiles?.length, 'activeProfileId:', env.activeProfileId);
      setEnvironment(env);
      if (env.activeProfileId && env.profiles?.find(p => p.id === env.activeProfileId)) {
        setActiveProfileId(env.activeProfileId);
      } else if (env.profiles && env.profiles.length > 0) {
        setActiveProfileId(env.profiles[0].id);
      }
    }
  }, []);

  const addProfile = useCallback(async (
    name: string,
    email: string,
    permissions: 'admin' | 'readonly',
    pin?: string,
    recoveryEmail?: string,
    avatarColor?: string
  ): Promise<Profile> => {
    // Wait for environment to be available
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
    
    // Save user session for auto-login
    if (email) {
      await saveUserSession(email.toLowerCase(), updatedEnv.id);
    }

    return profile;
  }, [environment]);

  const updateProfile = useCallback(async (profile: Profile) => {
    if (!environment) throw new Error('No environment loaded');

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

  const logout = useCallback(() => {
    setEnvironment(null);
    setActiveProfileId(undefined);
  }, []);

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
      environment,
      activeProfile,
      isAuthenticated: !!environment && !!activeProfile,
      createEnvironment,
      loadEnvironment,
      addProfile,
      updateProfile,
      deleteProfile,
      setActiveProfile,
      logout,
      darkMode,
      toggleDarkMode,
      findProfileByEmail,
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
