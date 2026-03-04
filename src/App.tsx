import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EventsProvider, useEvents } from './contexts/EventsContext';
import { TopAppBar } from './components/TopAppBar';
import { BottomNav } from './components/BottomNav';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { DayView } from './components/DayView';
import { TurnosGrid } from './components/TurnosGrid';
import { EventForm } from './components/EventForm';
import { EventDetail } from './components/EventDetail';
import { ProfileSelector, AddProfileModal } from './components/ProfileSelector';
import { Onboarding } from './components/Onboarding';
import { ConfirmDialog } from './components/Modal';
import { Button } from './components/Button';
import { UserAuthModal } from './components/UserAuth';
import { UserSettingsModal } from './components/UserSettings';
import { SplashScreen } from './components/SplashScreen';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ReloadPrompt } from './components/ReloadPrompt';
import { ListsView } from './components/ListsView';
import { MenuView } from './components/MenuView';
import { Login } from './components/Auth/Login';
import { Register } from './components/Auth/Register';
import { VerifyEmail } from './components/Auth/VerifyEmail';
import { PasswordReset } from './components/Auth/PasswordReset';
import { NewPassword } from './components/Auth/NewPassword';
import { PaymentModal } from './components/Payment/PaymentModal';
import { EmailVerificationBanner } from './components/EmailVerificationBanner';
import { useTouchGestures } from './hooks/useTouchGestures';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import type { CalendarView, ExpandedEvent, Event, DeleteScope, Profile } from './types';
import { formatMonthYear } from './utils/helpers';
import { saveUserSession, getEnvironment } from './services/database';
import './styles/global.css';
import './App.css';

// Auth flow states
type AuthState = 'loading' | 'login' | 'register' | 'verify-email' | 'password-reset' | 'new-password' | 'authenticated';

function AppContent() {
  const {
    currentUser,
    isAuthenticated,
    isEmailVerified,
    isPremium,
    isLoading: isAuthLoading,
    environment,
    activeProfile,
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
    toasts,
    removeToast,
  } = useEvents();

  // Auth flow state
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [pendingToken, setPendingToken] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // UI State
  const [currentView, setCurrentView] = useState<CalendarView>('month');
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ExpandedEvent | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteScope, setDeleteScope] = useState<DeleteScope>('single');
  const [showSplash, setShowSplash] = useState(true);
  const [filterProfileId, setFilterProfileId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // User auth modal state
  const [showUserAuth, setShowUserAuth] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [pendingEnvironmentId, setPendingEnvironmentId] = useState('');

  // Edit scope for recurring events
  const [editScope, setEditScope] = useState<'single' | 'future' | 'all'>('single');
  const [showEditScopeDialog, setShowEditScopeDialog] = useState(false);

  // Status Bar dinámica para nativo
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Dark });
      StatusBar.setBackgroundColor({ color: '#2D3E50' });
    }
  }, []);

  // Handle auth state changes
  useEffect(() => {
    if (isAuthLoading) return;
    
    if (isAuthenticated) {
      setAuthState('authenticated');
    } else {
      setAuthState('login');
    }
  }, [isAuthenticated, isAuthLoading]);

  // Hide splash screen
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);
    return () => clearTimeout(splashTimer);
  }, []);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Android back button handler
  useEffect(() => {
    const isCapacitor = () => !!(window as any).Capacitor;
    if (!isCapacitor()) return;

    const hasOpenModals = () => {
      return showEventForm || showEventDetail || showUserSettings ||
             showProfileSelector || showAddProfile || showDeleteConfirm ||
             showEditScopeDialog;
    };

    let backButtonListener: Awaited<ReturnType<typeof CapacitorApp.addListener>> | null = null;

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (hasOpenModals()) {
        if (showEditScopeDialog) setShowEditScopeDialog(false);
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        if (showAddProfile) setShowAddProfile(false);
        if (showProfileSelector) setShowProfileSelector(false);
        if (showUserSettings) setShowUserSettings(false);
        if (showEventDetail) {
          setShowEventDetail(false);
          setSelectedEvent(null);
          return;
        }
        if (showEventForm) {
          setShowEventForm(false);
          setSelectedEvent(null);
          return;
        }
        return;
      }

      if (currentView === 'lists' || currentView === 'menu') {
        setCurrentView('month');
        return;
      }

      if (canGoBack) {
        window.history.back();
      }
    }).then(listener => {
      backButtonListener = listener;
    });

    return () => {
      backButtonListener?.remove();
    };
  }, [
    showEventForm, showEventDetail, showUserSettings,
    showProfileSelector, showAddProfile, showDeleteConfirm,
    showEditScopeDialog, currentView
  ]);

  // Load events when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadEvents();
    }
  }, [isAuthenticated, loadEvents]);

  // Navigation handlers
  const handleViewChange = useCallback((view: CalendarView) => {
    setCurrentView(view);
  }, []);

  const handleViewToggle = useCallback(() => {
    // Cycle through month -> week -> day -> month
    setCurrentView(prev => {
      if (prev === 'month') return 'week';
      if (prev === 'week') return 'day';
      return 'month';
    });
  }, []);

  const handleDayClick = useCallback((date: Date) => {
    setViewDate(date);
    setCurrentView('day');
  }, [setViewDate]);

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

  // Touch gestures
  const { onTouchStart, onTouchMove, onTouchEnd } = useTouchGestures({
    onSwipeLeft: currentView === 'month' ? () => handleNext() : undefined,
    onSwipeRight: currentView === 'month' ? () => handlePrev() : undefined,
    threshold: 80,
  });

  // Event handlers
  const handleEventClick = useCallback((event: ExpandedEvent) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  }, []);

  const handleTurnoSlotClick = useCallback((time: string) => {
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

  // Check premium before allowing advanced features
  const requirePremium = useCallback((_feature: string, callback: () => void) => {
    if (!isPremium) {
      setShowPaymentModal(true);
    } else {
      callback();
    }
  }, [isPremium]);

  const handleEditEvent = useCallback(() => {
    if (!selectedEvent) return;

    const baseEvent = expandedEvents.find(e => e.baseEventId === selectedEvent.baseEventId);
    if (baseEvent?.isRecurring) {
      requirePremium('Edición de eventos recurrentes', () => {
        setShowEditScopeDialog(true);
      });
      return;
    }

    setShowEventDetail(false);
    setShowEventForm(true);
  }, [selectedEvent, expandedEvents, requirePremium]);

  const handleEditScopeSelect = (scope: 'single' | 'future' | 'all') => {
    if (scope !== 'single') {
      requirePremium('Edición de múltiples eventos', () => {
        setEditScope(scope);
        setShowEditScopeDialog(false);
        setShowEventDetail(false);
        setShowEventForm(true);
      });
    } else {
      setEditScope(scope);
      setShowEditScopeDialog(false);
      setShowEventDetail(false);
      setShowEventForm(true);
    }
  };

  const handleCreateEvent = useCallback(async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Check for recurring events
    if (eventData.rrule && !isPremium) {
      setShowPaymentModal(true);
      return;
    }
    
    // Check for alarms
    if (eventData.alarms && eventData.alarms.length > 0 && !isPremium) {
      setShowPaymentModal(true);
      return;
    }

    await createEvent(eventData);
  }, [createEvent, isPremium]);

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
      requirePremium('Eliminación de eventos recurrentes', () => {
        setShowDeleteConfirm(true);
      });
    } else {
      setDeleteScope('single');
      setShowDeleteConfirm(true);
    }
  }, [selectedEvent, requirePremium]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedEvent) return;

    await deleteEvent(selectedEvent.baseEventId, deleteScope);
    setShowDeleteConfirm(false);
    setShowEventDetail(false);
    setSelectedEvent(null);
  }, [selectedEvent, deleteScope, deleteEvent]);

  // Auth handlers
  const handleLoginSuccess = useCallback(() => {
    setAuthState('authenticated');
  }, []);

  const handleRegisterSuccess = useCallback((token: string) => {
    if (currentUser) {
      setPendingToken(token);
      setAuthState('verify-email');
    }
  }, [currentUser]);

  const handleVerificationComplete = useCallback(() => {
    setAuthState('authenticated');
  }, []);

  const handlePasswordResetSuccess = useCallback(() => {
    setAuthState('login');
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setAuthState('login');
  }, [logout]);

  // Onboarding handlers
  const handleOnboardingComplete = useCallback(async (
    environmentName: string,
    pin: string | undefined,
    profileList: Array<{ name: string; permissions: 'admin' | 'readonly' }>
  ) => {
    try {
      if (environment && environment.profiles.length === 0 && profileList.length > 0) {
        for (const profileData of profileList) {
          await addProfile(profileData.name, currentUser?.email || '', profileData.permissions);
        }
      } else {
        await createEnvironment(environmentName, pin, profileList);
      }
    } catch (error) {
      console.error('Error during onboarding:', error);
    }
  }, [createEnvironment, addProfile, environment, currentUser]);

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

      const existingProfile = env.profiles.find(p => p.email.toLowerCase() === userData.email.toLowerCase());

      if (existingProfile) {
        if (existingProfile.pin === userData.pin) {
          await loadEnvironment(pendingEnvironmentId);
          await saveUserSession(userData.email, pendingEnvironmentId);
          setShowUserAuth(false);
          setPendingEnvironmentId('');
        } else {
          alert('PIN incorrecto');
          return;
        }
      } else {
        await addProfile(userData.name, userData.email, userData.permissions, userData.pin, userData.recoveryEmail, userData.avatarColor);
        await saveUserSession(userData.email, pendingEnvironmentId);
        setShowUserAuth(false);
        setPendingEnvironmentId('');
      }
    } catch (error) {
      console.error('Error in user auth:', error);
    }
  }, [pendingEnvironmentId, addProfile, loadEnvironment]);

  const handleAddProfile = useCallback(async (name: string, permissions: 'admin' | 'readonly') => {
    await addProfile(name, '', permissions);
    setShowAddProfile(false);
  }, [addProfile]);

  const handleUpdateProfile = useCallback(async (profile: Profile) => {
    await updateProfile(profile);
  }, [updateProfile]);

  // Render views
  const renderView = () => {
    switch (currentView) {
      case 'month':
        return (
          <MonthView
            currentDate={viewDate}
            events={expandedEvents}
            onDayClick={handleDayClick}
            filterProfileId={filterProfileId}
          />
        );
      case 'week':
        return (
          <WeekView
            currentDate={viewDate}
            events={expandedEvents}
            onEventClick={handleEventClick}
            onDayClick={handleDayClick}
          />
        );
      case 'day':
        return (
          <>
            <DayView
              currentDate={viewDate}
              events={expandedEvents}
              profiles={environment?.profiles || []}
              onEventClick={handleEventClick}
            />
            <TurnosGrid
              currentDate={viewDate}
              events={expandedEvents}
              profiles={environment?.profiles || []}
              onSlotClick={handleTurnoSlotClick}
              onEventClick={handleTurnoEventClick}
            />
          </>
        );
      case 'lists':
        return <ListsView />;
      case 'menu':
        return <MenuView />;
      default:
        return (
          <MonthView
            currentDate={viewDate}
            events={expandedEvents}
            onDayClick={handleDayClick}
            filterProfileId={filterProfileId}
          />
        );
    }
  };

  // Show splash screen
  if (showSplash) {
    return <SplashScreen />;
  }

  // Show auth flow
  if (authState === 'login') {
    return (
      <Login
        onSwitchToRegister={() => setAuthState('register')}
        onSwitchToReset={() => setAuthState('password-reset')}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (authState === 'register') {
    return (
      <Register
        onSwitchToLogin={() => setAuthState('login')}
        onRegisterSuccess={handleRegisterSuccess}
      />
    );
  }

  if (authState === 'verify-email' && currentUser) {
    return (
      <VerifyEmail
        email={currentUser.email}
        token={pendingToken}
        onVerificationComplete={handleVerificationComplete}
        onSkip={() => setAuthState('authenticated')}
      />
    );
  }

  if (authState === 'password-reset') {
    return (
      <PasswordReset
        onSwitchToLogin={() => setAuthState('login')}
        onSwitchToNewPassword={() => {
          setAuthState('new-password');
        }}
      />
    );
  }

  if (authState === 'new-password') {
    return (
      <NewPassword
        onSuccess={handlePasswordResetSuccess}
        onBack={() => setAuthState('password-reset')}
      />
    );
  }

  // Check if we have environment and profile
  if (!environment) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (!activeProfile) {
    if (environment.profiles.length > 0) {
      setActiveProfile(environment.profiles[0].id);
      return null;
    }
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (environment.profiles.length === 0) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const isReadOnly = activeProfile.permissions === 'readonly';

  return (
    <div
      className="app"
      onTouchStart={currentView === 'month' ? onTouchStart : undefined}
      onTouchMove={currentView === 'month' ? onTouchMove : undefined}
      onTouchEnd={currentView === 'month' ? onTouchEnd : undefined}
    >
      <TopAppBar
        title={environment?.name || 'Mi Familia'}
        subtitle={currentView === 'lists' ? 'Lista de compras' : currentView === 'menu' ? 'Menú semanal' : formatMonthYear(viewDate)}
        onViewToggle={handleViewToggle}
        currentView={currentView}
        profileName={activeProfile.name}
        profileColor={activeProfile.avatarColor}
        profileInitials={activeProfile.initials}
        onProfileClick={() => setShowUserSettings(true)}
        onDarkModeToggle={toggleDarkMode}
        darkMode={darkMode}
        profiles={environment?.profiles || []}
        filterProfileId={filterProfileId}
        onFilterChange={setFilterProfileId}
      />

      {/* Email Verification Banner */}
      {!isEmailVerified && <EmailVerificationBanner />}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="offline-banner">
          <span className="offline-banner-icon">📡</span>
          <span className="offline-banner-text">
            Sin conexión. Los cambios se guardarán localmente.
          </span>
        </div>
      )}

      <main className="app-main">
        {(currentView === 'month' || currentView === 'week' || currentView === 'day') && (
          <>
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
          </>
        )}

        <div className="app-scroll-container">
          {renderView()}
        </div>
      </main>

      {(currentView === 'month' || currentView === 'day') && !isReadOnly && (
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
        onLogout={handleLogout}
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

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* PWA Reload Prompt */}
      <ReloadPrompt />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
        }}
        onSuccess={() => {
          setShowPaymentModal(false);
        }}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <EventsProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </EventsProvider>
    </AuthProvider>
  );
}

export default App;
