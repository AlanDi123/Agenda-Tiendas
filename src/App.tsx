import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EventsProvider, useEvents } from './contexts/EventsContext';
import { TopAppBar } from './components/TopAppBar';
import { BottomNav } from './components/BottomNav';
import { MonthView } from './components/MonthView';
import { DayView } from './components/DayView';
import { TurnosGrid } from './components/TurnosGrid';
import { EventForm } from './components/EventForm';
import { EventDetail } from './components/EventDetail';
import { ProfileSelector, AddProfileModal } from './components/ProfileSelector';
import { Onboarding } from './components/Onboarding';
import { LoginScreen } from './components/Login';
import { ConfirmDialog } from './components/Modal';
import { Button } from './components/Button';
import { UserAuthModal } from './components/UserAuth';
import { UserSettingsModal } from './components/UserSettings';
import { SplashScreen } from './components/SplashScreen';
import { useTouchGestures } from './hooks/useTouchGestures';
import type { CalendarView, ExpandedEvent, Event, DeleteScope, Profile } from './types';
import { formatMonthYear } from './utils/helpers';
import { getAllEnvironments, saveUserSession, getAllUserSessions, getEnvironment } from './services/database';
import './styles/global.css';
import './App.css';

function AppContent() {
  const {
    environment,
    activeProfile,
    isAuthenticated,
    createEnvironment,
    loadEnvironment,
    addProfile,
    updateProfile,
    setActiveProfile,
    logout,
    darkMode,
    toggleDarkMode,
  } = useAuth();

  const {
    expandedEvents,
    loadEvents,
    createEvent,
    deleteEvent,
    viewDate,
    setViewDate,
  } = useEvents();

  // UI State
  const [currentView, setCurrentView] = useState<CalendarView>('month');
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ExpandedEvent | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteScope, setDeleteScope] = useState<DeleteScope>('single');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string; pin?: string }>>([]);
  
  // User auth state
  const [showUserAuth, setShowUserAuth] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [pendingEnvironmentId, setPendingEnvironmentId] = useState('');

  // Edit scope for recurring events
  const [editScope, setEditScope] = useState<'single' | 'future' | 'all'>('single');
  const [showEditScopeDialog, setShowEditScopeDialog] = useState(false);

  // Navigation handlers (defined early for gesture hooks)
  const handlePrev = useCallback(() => {
    if (currentView === 'month') {
      const newDate = new Date(viewDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setViewDate(newDate);
    } else if (currentView === 'week') {
      const newDate = new Date(viewDate);
      newDate.setDate(newDate.getDate() - 7);
      setViewDate(newDate);
    } else {
      const newDate = new Date(viewDate);
      newDate.setDate(newDate.getDate() - 1);
      setViewDate(newDate);
    }
  }, [currentView, viewDate, setViewDate]);
  
  const handleNext = useCallback(() => {
    if (currentView === 'month') {
      const newDate = new Date(viewDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setViewDate(newDate);
    } else if (currentView === 'week') {
      const newDate = new Date(viewDate);
      newDate.setDate(newDate.getDate() + 7);
      setViewDate(newDate);
    } else {
      const newDate = new Date(viewDate);
      newDate.setDate(newDate.getDate() + 1);
      setViewDate(newDate);
    }
  }, [currentView, viewDate, setViewDate]);
  
  const handleToday = useCallback(() => {
    setViewDate(new Date());
  }, [setViewDate]);

  // Touch gestures for calendar navigation
  const handleSwipeLeft = useCallback(() => {
    handleNext();
  }, [handleNext]);

  const handleSwipeRight = useCallback(() => {
    handlePrev();
  }, [handlePrev]);

  const { onTouchStart, onTouchMove, onTouchEnd } = useTouchGestures({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
  });

  // Load environments on mount
  useEffect(() => {
    const loadEnvs = async () => {
      const envs = await getAllEnvironments();
      setEnvironments(envs.map(e => ({ id: e.id, name: e.name, pin: e.pin })));

      if (envs.length === 0) {
        setShowOnboarding(true);
      } else {
        setShowLogin(true);
      }
    };
    loadEnvs();

    // Hide splash screen after delay
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(splashTimer);
  }, []);

  // Load events when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadEvents();
    }
  }, [isAuthenticated, loadEvents]);

  // Debug: Log environment changes
  // useEffect(() => {
  //   if (environment) {
  //     console.log('Environment loaded:', environment.name, 'Profiles:', environment.profiles.length, 'Active:', activeProfile?.name);
  //   }
  // }, [environment, activeProfile]);

  // Navigation handlers
  const handleViewChange = useCallback((view: CalendarView) => {
    setCurrentView(view);
  }, []);

  // Vista toggle - Solo vista mensual (Dommuss Agenda)
  const handleViewToggle = useCallback(() => {
    // No-op: Solo vista mensual disponible
  }, []);

  const handleDayClick = useCallback((date: Date) => {
    setViewDate(date);
    setCurrentView('day');
  }, [setViewDate]);

  // Event handlers
  const handleEventClick = useCallback((event: ExpandedEvent) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  }, []);

  // Turnos grid handlers
  const handleTurnoSlotClick = useCallback((time: string) => {
    // Crear evento con la hora seleccionada
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(viewDate);
    newDate.setHours(hours, minutes, 0, 0);
    setViewDate(newDate);
    setShowEventForm(true);
  }, [viewDate, setViewDate]);

  const handleTurnoEventClick = useCallback((event: ExpandedEvent) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  }, []);
  
  const handleCreateEvent = useCallback(async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => {
    await createEvent(eventData);
  }, [createEvent]);
  
  const handleEditEvent = useCallback(() => {
    if (!selectedEvent) return;
    
    // Check if it's a recurring event
    const baseEvent = expandedEvents.find(e => e.baseEventId === selectedEvent.baseEventId);
    if (baseEvent?.isRecurring) {
      setShowEditScopeDialog(true);
      return;
    }
    
    setShowEventDetail(false);
    setShowEventForm(true);
  }, [selectedEvent, expandedEvents]);
  
  const handleEditScopeSelect = (scope: 'single' | 'future' | 'all') => {
    setEditScope(scope);
    setShowEditScopeDialog(false);
    setShowEventDetail(false);
    setShowEventForm(true);
  };
  
  const handleUpdateEvent = useCallback(async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!selectedEvent) return;
    
    await createEvent({
      ...eventData,
      assignedProfileIds: eventData.assignedProfileIds.length > 0 ? eventData.assignedProfileIds : selectedEvent.assignedProfileIds,
    });
  }, [selectedEvent, createEvent]);
  
  const handleDeleteClick = useCallback(() => {
    if (!selectedEvent) return;
    
    if (selectedEvent.isRecurring) {
      setShowDeleteConfirm(true);
    } else {
      setDeleteScope('single');
      setShowDeleteConfirm(true);
    }
  }, [selectedEvent]);
  
  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedEvent) return;
    
    await deleteEvent(selectedEvent.baseEventId, deleteScope);
    setShowDeleteConfirm(false);
    setShowEventDetail(false);
    setSelectedEvent(null);
  }, [selectedEvent, deleteScope, deleteEvent]);
  
  // Onboarding complete
  const handleOnboardingComplete = useCallback(async (
    environmentName: string,
    pin: string | undefined,
    profileList: Array<{ name: string; permissions: 'admin' | 'readonly' }>
  ) => {
    try {
      // If environment already exists, just add profiles to it
      if (environment && environment.profiles.length === 0 && profileList.length > 0) {
        // Add profiles to existing environment
        for (const profileData of profileList) {
          await addProfile(profileData.name, '', profileData.permissions);
        }
      } else {
        // Create new environment with profiles
        await createEnvironment(environmentName, pin, profileList);
      }
      setShowOnboarding(false);
      setShowLogin(false);
    } catch (error) {
      console.error('Error during onboarding:', error);
    }
  }, [createEnvironment, addProfile, environment]);
  
  // Login handlers
  const handleSelectEnvironment = useCallback(async (selectedEnv: { id: string; name: string; pin?: string }) => {
    try {
      // Load the environment first to check its profiles
      const env = await getEnvironment(selectedEnv.id);
      if (!env) {
        console.error('Environment not found');
        return;
      }
      
      // Check if environment has profiles
      if (env.profiles && env.profiles.length > 0) {
        // Check for existing user session (auto-login with email)
        const sessions = await getAllUserSessions();
        const userWithEmail = Object.keys(sessions).find(email => sessions[email] === selectedEnv.id);
        
        if (userWithEmail) {
          const profile = env.profiles.find(p => p.email.toLowerCase() === userWithEmail.toLowerCase());
          if (profile) {
            await loadEnvironment(selectedEnv.id);
            await saveUserSession(userWithEmail, selectedEnv.id);
            setShowLogin(false);
            return;
          }
        }
        
        // No email session found - check if profiles have no email (legacy mode)
        const hasProfilesWithEmail = env.profiles.some(p => p.email);
        if (!hasProfilesWithEmail) {
          // Legacy environment - load directly with first profile
          await loadEnvironment(selectedEnv.id);
          setShowLogin(false);
          return;
        }
      }
      
      // Show user auth modal for email-based login/registration
      setPendingEnvironmentId(selectedEnv.id);
      setShowUserAuth(true);
    } catch (error) {
      console.error('Error selecting environment:', error);
      // Fallback: try to load environment anyway
      setPendingEnvironmentId(selectedEnv.id);
      setShowUserAuth(true);
    }
  }, [loadEnvironment]);
  
  const handleCreateNewEnvironment = useCallback(() => {
    setShowLogin(false);
    setShowOnboarding(true);
  }, []);

  // User auth complete handler
  const handleUserAuthComplete = useCallback(async (userData: {
    name: string;
    email: string;
    pin: string;
    recoveryEmail: string;
    avatarColor: string;
    permissions: 'admin' | 'readonly';
  }) => {
    try {
      if (!pendingEnvironmentId) return;
      
      const env = await getEnvironment(pendingEnvironmentId);
      if (!env) return;
      
      // Check if user already exists
      const existingProfile = env.profiles.find(p => p.email.toLowerCase() === userData.email.toLowerCase());
      
      if (existingProfile) {
        // Existing user - verify PIN
        if (existingProfile.pin === userData.pin) {
          await loadEnvironment(pendingEnvironmentId);
          await saveUserSession(userData.email, pendingEnvironmentId);
          setShowUserAuth(false);
          setShowLogin(false);
          setPendingEnvironmentId('');
        } else {
          alert('PIN incorrecto');
          return;
        }
      } else {
        // New user - add profile
        await addProfile(userData.name, userData.email, userData.permissions, userData.pin, userData.recoveryEmail, userData.avatarColor);
        await saveUserSession(userData.email, pendingEnvironmentId);
        setShowUserAuth(false);
        setShowLogin(false);
        setPendingEnvironmentId('');
      }
    } catch (error) {
      console.error('Error in user auth:', error);
    }
  }, [pendingEnvironmentId, addProfile, loadEnvironment]);
  
  // Add profile handler
  const handleAddProfile = useCallback(async (name: string, permissions: 'admin' | 'readonly') => {
    await addProfile(name, '', permissions);
    setShowAddProfile(false);
  }, [addProfile]);

  // Update profile handler (for user settings)
  const handleUpdateProfile = useCallback(async (profile: Profile) => {
    await updateProfile(profile);
  }, [updateProfile]);
  
  // Swipe gestures for navigation
  useEffect(() => {
    let touchStartX = 0;
    let touchEndX = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.targetTouches[0].clientX;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      touchEndX = e.targetTouches[0].clientX;
    };
    
    const handleTouchEnd = () => {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;
      
      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleNext, handlePrev]);
  
  // Keyboard navigation - Solo vista mensual
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showEventForm || showEventDetail || showProfileSelector || showAddProfile) return;

      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 't') {
        handleToday();
      }
      // Solo permite vista mensual (tecla 1)
      if (e.key === '1') {
        setCurrentView('month');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, handleToday, showEventForm, showEventDetail, showProfileSelector, showAddProfile]);
  
  // Render views - Dommuss Agenda (principalmente vista mensual)
  const renderView = () => {
    switch (currentView) {
      case 'month':
        return (
          <MonthView
            currentDate={viewDate}
            events={expandedEvents}
            onDayClick={handleDayClick}
          />
        );
      case 'day':
        // Vista diaria solo cuando se hace click en un día específico
        return (
          <DayView
            currentDate={viewDate}
            events={expandedEvents}
            profiles={environment?.profiles || []}
            onEventClick={handleEventClick}
          />
        );
      default:
        // Por defecto, vista mensual
        return (
          <MonthView
            currentDate={viewDate}
            events={expandedEvents}
            onDayClick={handleDayClick}
          />
        );
    }
  };

  // Show splash screen
  if (showSplash) {
    return <SplashScreen />;
  }

  // Show onboarding
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} existingEnvName={environment?.name} />;
  }
  
  // Show login screen
  if (showLogin) {
    return (
      <LoginScreen
        environments={environments}
        onSelectEnvironment={handleSelectEnvironment}
        onCreateNew={handleCreateNewEnvironment}
      />
    );
  }
  
  // Check if we have profiles
  if (!environment) {
    console.log('No environment yet');
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }
  
  if (!activeProfile) {
    console.log('No active profile, but environment exists:', environment.name, 'with', environment.profiles.length, 'profiles');
    // If environment has profiles but no active profile is set, set the first one
    if (environment.profiles.length > 0) {
      setActiveProfile(environment.profiles[0].id);
      return null; // Allow re-render
    }
    // Environment exists but has no profiles - show onboarding to add profiles
    console.log('Showing onboarding to add profiles to existing environment');
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }
  
  if (environment.profiles.length === 0) {
    console.log('Environment has no profiles');
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }
  
  const isReadOnly = activeProfile.permissions === 'readonly';

  return (
    <div 
      className="app"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <TopAppBar
        title={environment?.name || 'Mi Familia'}
        subtitle={formatMonthYear(viewDate)}
        onViewToggle={handleViewToggle}
        currentView={currentView}
        profileName={activeProfile.name}
        profileColor={activeProfile.avatarColor}
        profileInitials={activeProfile.initials}
        onProfileClick={() => setShowUserSettings(true)}
        onDarkModeToggle={toggleDarkMode}
        darkMode={darkMode}
      />
      
      <main className="app-main">
        <div className="app-calendar-nav">
          <button className="app-nav-btn" onClick={handlePrev} aria-label="Anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="app-nav-btn app-nav-today" onClick={handleToday}>
            Hoy
          </button>
          <button className="app-nav-btn" onClick={handleNext} aria-label="Siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="app-scroll-container">
          {renderView()}
          
          {/* Grilla de Turnos Diarios */}
          <TurnosGrid
            currentDate={viewDate}
            events={expandedEvents}
            profiles={environment?.profiles || []}
            onSlotClick={handleTurnoSlotClick}
            onEventClick={handleTurnoEventClick}
          />
        </div>
      </main>
      
      {!isReadOnly && (
        <Button
          className="btn-fab"
          onClick={() => {
            setSelectedEvent(null);
            setShowEventForm(true);
          }}
          aria-label="Crear evento"
          title="Crear turno/evento"
        >
          <span className="fab-emoji">➕</span>
        </Button>
      )}
      
      <BottomNav
        currentView={currentView}
        onViewChange={handleViewChange}
        onProfilesClick={() => setShowUserSettings(true)}
      />
      
      {/* Event Form Modal */}
      <EventForm
        isOpen={showEventForm}
        onClose={() => {
          setShowEventForm(false);
          setSelectedEvent(null);
        }}
        onSave={selectedEvent ? handleUpdateEvent : handleCreateEvent}
        profiles={environment.profiles}
        initialDate={viewDate}
      />
      
      {/* Event Detail Modal */}
      <EventDetail
        isOpen={showEventDetail}
        event={selectedEvent}
        profiles={environment.profiles}
        onEdit={handleEditEvent}
        onDelete={handleDeleteClick}
        onClose={() => {
          setShowEventDetail(false);
          setSelectedEvent(null);
        }}
      />
      
      {/* Profile Selector Modal */}
      <ProfileSelector
        isOpen={showProfileSelector}
        profiles={environment.profiles}
        activeProfileId={activeProfile.id}
        onSelectProfile={setActiveProfile}
        onAddProfile={() => setShowAddProfile(true)}
        onClose={() => setShowProfileSelector(false)}
      />
      
      {/* Add Profile Modal */}
      <AddProfileModal
        isOpen={showAddProfile}
        onClose={() => setShowAddProfile(false)}
        onAdd={handleAddProfile}
      />

      {/* User Auth Modal */}
      <UserAuthModal
        isOpen={showUserAuth}
        onClose={() => {
          setShowUserAuth(false);
          setPendingEnvironmentId('');
        }}
        onAuthComplete={handleUserAuthComplete}
        existingProfiles={environment?.profiles || []}
      />

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={showUserSettings}
        profile={activeProfile}
        onClose={() => setShowUserSettings(false)}
        onUpdateProfile={handleUpdateProfile}
        onLogout={() => {
          logout();
          setShowUserSettings(false);
          setShowLogin(true);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Eliminar evento"
        message={
          selectedEvent?.isRecurring
            ? "Este es un evento recurrente. ¿Qué quieres eliminar?"
            : "¿Está seguro de eliminar este evento?"
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      
      {/* Edit Scope Dialog for Recurring Events */}
      <ConfirmDialog
        isOpen={showEditScopeDialog}
        title="Editar evento recurrente"
        message="¿Qué eventos quieres editar?"
        confirmText="Continuar"
        cancelText="Cancelar"
        variant="info"
        onConfirm={() => handleEditScopeSelect(editScope)}
        onCancel={() => setShowEditScopeDialog(false)}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <EventsProvider>
        <AppContent />
      </EventsProvider>
    </AuthProvider>
  );
}

export default App;
