import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EventsProvider, useEvents } from './contexts/EventsContext';
import { TopAppBar } from './components/TopAppBar';
import { BottomNav } from './components/BottomNav';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { DayView } from './components/DayView';
import { ConfirmDialog } from './components/Modal';
import { SplashScreen } from './components/SplashScreen';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ReloadPrompt } from './components/ReloadPrompt';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';
import { apiFetch } from './config/api';

const TurnosGrid = lazy(() =>
  import('./components/TurnosGrid').then((m) => ({ default: m.TurnosGrid }))
);
const EventForm = lazy(() =>
  import('./components/EventForm').then((m) => ({ default: m.EventForm }))
);
const EventDetail = lazy(() =>
  import('./components/EventDetail').then((m) => ({ default: m.EventDetail }))
);
const ProfileSelector = lazy(() =>
  import('./components/ProfileSelector').then((m) => ({ default: m.ProfileSelector }))
);
const AddProfileModal = lazy(() =>
  import('./components/ProfileSelector').then((m) => ({ default: m.AddProfileModal }))
);
const Onboarding = lazy(() =>
  import('./components/Onboarding').then((m) => ({ default: m.Onboarding }))
);
const UserAuthModal = lazy(() =>
  import('./components/UserAuth').then((m) => ({ default: m.UserAuthModal }))
);
const UserSettingsModal = lazy(() =>
  import('./components/UserSettings').then((m) => ({ default: m.UserSettingsModal }))
);
const ListsView = lazy(() =>
  import('./components/ListsView').then((m) => ({ default: m.ListsView }))
);
const MenuView = lazy(() =>
  import('./components/MenuView').then((m) => ({ default: m.MenuView }))
);
const ContactsView = lazy(() =>
  import('./components/ContactsView').then((m) => ({ default: m.ContactsView }))
);
const NotesView = lazy(() =>
  import('./components/NotesView').then((m) => ({ default: m.NotesView }))
);
const Login = lazy(() => import('./components/Auth/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() =>
  import('./components/Auth/Register').then((m) => ({ default: m.Register }))
);
const VerifyEmail = lazy(() =>
  import('./components/Auth/VerifyEmail').then((m) => ({ default: m.VerifyEmail }))
);
const PasswordReset = lazy(() =>
  import('./components/Auth/PasswordReset').then((m) => ({ default: m.PasswordReset }))
);
const NewPassword = lazy(() =>
  import('./components/Auth/NewPassword').then((m) => ({ default: m.NewPassword }))
);
const PaymentModal = lazy(() =>
  import('./components/Payment/PaymentModal').then((m) => ({ default: m.PaymentModal }))
);
const EmailVerificationBanner = lazy(() =>
  import('./components/EmailVerificationBanner').then((m) => ({
    default: m.EmailVerificationBanner,
  }))
);
const UpdateModal = lazy(() =>
  import('./components/UpdateModal').then((m) => ({ default: m.UpdateModal }))
);
import { useTouchGestures } from './hooks/useTouchGestures';
import { useAppUpdates } from './hooks/useAppUpdates';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import type { CalendarView, ExpandedEvent, Event, DeleteScope, Profile } from './types';
import { formatMonthYear } from './utils/helpers';
import { saveUserSession, getEnvironment, saveEnvironment, clearAllEvents, saveEvent } from './services/database';
import { queueCloudFamilySync, loadFamilySnapshotByCode } from './services/cloudFamilySync';
import './styles/global.css';
import './styles/animations.css';
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
    verifyEmail,
    logout,
    closeFamily,
    darkMode,
    toggleDarkMode,
    refreshSubscription,
  } = useAuth();

  const {
    events: rawEvents,
    expandedEvents,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    viewDate,
    setViewDate,
    toasts,
    removeToast,
  } = useEvents();

  // App updates hook
  const {
    updateInfo,
    hasUpdate,
    isMandatory,
    initialized: updatesInitialized,
    dismissUpdate,
  } = useAppUpdates();

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
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [pendingPlanType, setPendingPlanType] = useState<string | null>(null);

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

  // Al volver del checkout de MP, refrescar suscripción
  useEffect(() => {
    const url = window.location.href;
    if (url.includes('/payment/success') || url.includes('payment_id=')) {
      refreshSubscription().then(() => {
        window.history.replaceState({}, '', '/');
      });
    }
  }, [refreshSubscription]);

  // Hide splash screen — esperar a que auth termine, con fallback mínimo de 800ms
  useEffect(() => {
    if (!isAuthLoading) {
      // Auth ya resolvió: mantener un mínimo de 800ms para no parpadear
      const splashTimer = setTimeout(() => {
        setShowSplash(false);
      }, 800);
      return () => clearTimeout(splashTimer);
    }
  }, [isAuthLoading]);

  // Failsafe: Si tarda más de 5 segundos en autenticar, asumimos modo OFFLINE
  useEffect(() => {
    if (isAuthLoading) {
      const offlineTimeout = setTimeout(() => {
        console.warn('Timeout de conexión: Iniciando en modo Offline');
        setIsOnline(false); // Forzamos modo offline visual
        setShowSplash(false); // Quitamos el splash
      }, 5000);
      return () => clearTimeout(offlineTimeout);
    }
  }, [isAuthLoading]);

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

  // Deep links: abrir app por enlaces de mail y resolver token si viene
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLink = async (url?: string) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const directToken = parsed.searchParams.get('token');
        const target = parsed.searchParams.get('target');
        const targetUrl = target ? new URL(target) : null;
        const targetToken = targetUrl?.searchParams.get('token');
        const token = directToken || targetToken;
        if (token) {
          await verifyEmail(token);
        }
      } catch {
        // ignore malformed urls
      }
    };

    let listener: Awaited<ReturnType<typeof CapacitorApp.addListener>> | null = null;
    CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      void handleDeepLink(url);
    }).then((l) => {
      listener = l;
    });

    CapacitorApp.getLaunchUrl()
      .then((launch) => void handleDeepLink(launch?.url))
      .catch(() => {});

    return () => {
      listener?.remove();
    };
  }, [verifyEmail]);

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

  // Sync near real-time de familia+eventos a nube (debounced)
  useEffect(() => {
    if (!isAuthenticated || !environment || !isOnline) return;
    queueCloudFamilySync(environment, rawEvents);
  }, [isAuthenticated, environment, rawEvents, isOnline]);

  // Set active profile if not set but environment has profiles
  useEffect(() => {
    if (!activeProfile && environment && environment.profiles.length > 0) {
      setActiveProfile(environment.profiles[0].id);
    }
  }, [environment, activeProfile, setActiveProfile]);

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
  const requirePremium = useCallback((feature: string, callback: () => void) => {
    if (!isPremium) {
      try {
        setShowPaymentModal(true);
      } catch (error) {
        console.error(`[Premium] Error showing payment modal for feature "${feature}":`, error);
        alert('Error al mostrar opciones de pago. Por favor intenta más tarde.');
      }
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

    if (!isPremium) {
      const dayStart = new Date(eventData.startDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const eventsInDay = rawEvents.filter((ev) => {
        const d = new Date(ev.startDate);
        return d >= dayStart && d <= dayEnd;
      }).length;
      if (eventsInDay >= 10) {
        alert('Límite del plan Gratis: máximo 10 eventos por día.');
        return;
      }
    }

    await createEvent(eventData);
  }, [createEvent, isPremium, rawEvents]);

  const handleUpdateEvent = useCallback(async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!selectedEvent) return;

    const fullEvent: Event = {
      ...eventData,
      id: selectedEvent.baseEventId,
      assignedProfileIds: eventData.assignedProfileIds.length > 0
        ? eventData.assignedProfileIds
        : selectedEvent.assignedProfileIds,
      createdAt: selectedEvent.startDate,
      updatedAt: new Date(),
    };
    await updateEvent(fullEvent, editScope);
  }, [selectedEvent, updateEvent, editScope]);

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

  const handleCloseFamily = useCallback(async () => {
    await closeFamily();
    // La vista vuelve a onboarding automáticamente porque `environment` queda en null.
    setShowUserSettings(false);
  }, [closeFamily]);

  // Onboarding handlers
  const handleOnboardingComplete = useCallback(async (data: {
    environmentName: string;
    pin?: string;
    profiles: Array<{ name: string; permissions: 'admin' | 'readonly' }>;
    planType: 'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY';
    familyCode?: string;
  }) => {
    try {
      const { environmentName, pin, profiles: profileList, planType, familyCode } = data;
      if (planType === 'FREE' && profileList.length > 3) {
        alert('Plan Gratis: máximo 3 perfiles por familia.');
        return;
      }

      // JOIN existente por código de familia (recuperación nube)
      if (!environmentName.trim() && familyCode) {
        const snapshot = await loadFamilySnapshotByCode(familyCode);
        await saveEnvironment(snapshot.environment);
        await clearAllEvents();
        for (const ev of snapshot.events) {
          await saveEvent(ev);
        }
        await loadEnvironment(snapshot.environment.id);
        if (currentUser) {
          await saveUserSession(currentUser.email, snapshot.environment.id);
        }
        return;
      }

      let createdFamilyCode: string | null = null;
      let createdEnvironmentName: string | null = null;
      
      if (environment && environment.profiles.length === 0 && profileList.length > 0) {
        for (const profileData of profileList) {
          await addProfile(profileData.name, currentUser?.email || '', profileData.permissions);
        }
      } else {
        const createdEnv = await createEnvironment(environmentName, pin, profileList);
        createdFamilyCode = createdEnv.familyCode;
        createdEnvironmentName = createdEnv.name;
      }

      // Enviar el código de familia al mail registrado (owner)
      if (createdFamilyCode && currentUser) {
        try {
          await apiFetch('/api/v1/app/send-family-code', {
            method: 'POST',
            auth: true,
            json: {
              familyCode: createdFamilyCode,
              familyName: createdEnvironmentName || environmentName,
              email: currentUser.email,
            },
          });
        } catch (emailErr) {
          console.error('[Onboarding] Error enviando código de familia:', emailErr);
          alert(`Se creó la familia, pero falló el envío del mail.\nCódigo: ${createdFamilyCode}`);
        }

        alert(`Código de familia creado: ${createdFamilyCode}\nGuardalo para compartirlo.`);
      }
      
      // Si eligió plan pago → redirigir a MP y bloquear entrada
      if (planType === 'PREMIUM_MONTHLY' || planType === 'PREMIUM_YEARLY') {
        setPendingPlanType(planType);
        setWaitingForPayment(true);
        try {
          const { redirectToCheckout } = await import('./services/paymentGatewayService');
          await redirectToCheckout(planType);
          // Si llegamos aquí, el window.location.href ya fue seteado — la app se redirige
        } catch (payErr) {
          console.error('[Onboarding] Error al redirigir a pago:', payErr);
          setWaitingForPayment(false);
          setPendingPlanType(null);
          alert('Error al conectar con Mercado Pago. Podés intentarlo desde Configuración > Suscripción.');
        }
      }
    } catch (error) {
      console.error('Error during onboarding:', error);
    }
  }, [createEnvironment, addProfile, environment, currentUser, loadEnvironment]);

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
      case 'contacts':
        return <ContactsView />;
      case 'notes':
        return <NotesView />;
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

  // Mostrar update modal ANTES del splash si hay actualización disponible
  if (hasUpdate && updateInfo) {
    return (
      <>
        <SplashScreen />
        <Suspense fallback={null}>
          <UpdateModal
            isOpen={true}
            update={updateInfo}
            onClose={() => {
              if (!isMandatory) dismissUpdate();
            }}
            onDismiss={() => dismissUpdate()}
          />
        </Suspense>
      </>
    );
  }

  // Bloquear avance hasta terminar el chequeo inicial de updates
  if (!updatesInitialized) {
    return <SplashScreen />;
  }

  // Show splash screen — también mientras auth sigue cargando
  if (showSplash || isAuthLoading) {
    return <SplashScreen />;
  }

  // Show auth flow
  if (authState === 'login') {
    return (
      <Suspense fallback={<RouteLoadingFallback label="Cargando acceso…" />}>
        <Login
          onSwitchToRegister={() => setAuthState('register')}
          onSwitchToReset={() => setAuthState('password-reset')}
          onLoginSuccess={handleLoginSuccess}
        />
      </Suspense>
    );
  }

  if (authState === 'register') {
    return (
      <Suspense fallback={<RouteLoadingFallback label="Cargando registro…" />}>
        <Register
          onSwitchToLogin={() => setAuthState('login')}
          onRegisterSuccess={handleRegisterSuccess}
        />
      </Suspense>
    );
  }

  if (authState === 'verify-email' && currentUser) {
    return (
      <Suspense fallback={<RouteLoadingFallback label="Cargando verificación…" />}>
        <VerifyEmail
          email={currentUser.email}
          token={pendingToken}
          onVerificationComplete={handleVerificationComplete}
          onSkip={() => setAuthState('authenticated')}
        />
      </Suspense>
    );
  }

  if (authState === 'password-reset') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <PasswordReset
          onSwitchToLogin={() => setAuthState('login')}
          onSwitchToNewPassword={() => {
            setAuthState('new-password');
          }}
        />
      </Suspense>
    );
  }

  if (authState === 'new-password') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <NewPassword
          onSuccess={handlePasswordResetSuccess}
          onBack={() => setAuthState('password-reset')}
        />
      </Suspense>
    );
  }

  // Check if we have environment and profile
  if (!environment) {
    return (
      <Suspense fallback={<RouteLoadingFallback label="Preparando tu espacio…" />}>
        <Onboarding onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  // Pantalla de espera mientras MP procesa el pago
  if (waitingForPayment) {
    return (
      <div className="payment-wait-screen">
        <div className="payment-wait-screen__icon" aria-hidden>
          🔄
        </div>
        <h2 className="payment-wait-screen__title">Completá el pago</h2>
        <p className="payment-wait-screen__text">
          Serás redirigido a Mercado Pago para confirmar tu suscripción{' '}
          <strong>{pendingPlanType === 'PREMIUM_YEARLY' ? 'Anual' : 'Mensual'}</strong>.
          <br />
          <br />
          Una vez confirmado el pago, tu cuenta quedará activa automáticamente.
        </p>
        <button
          type="button"
          className="payment-wait-screen__primary"
          onClick={async () => {
            const { getSubscriptionStatus } = await import('./services/paymentGatewayService');
            const status = await getSubscriptionStatus();
            if (status.isActive) {
              setWaitingForPayment(false);
              setPendingPlanType(null);
            } else {
              alert('El pago aún no fue confirmado. Si ya pagaste, esperá unos minutos y volvé a intentar.');
            }
          }}
        >
          Ya pagué — Verificar
        </button>
        <button
          type="button"
          className="payment-wait-screen__secondary"
          onClick={() => {
            setWaitingForPayment(false);
            setPendingPlanType(null);
          }}
        >
          Continuar gratis por ahora
        </button>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <Suspense fallback={<RouteLoadingFallback label="Preparando tu espacio…" />}>
        <Onboarding onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  if (environment.profiles.length === 0) {
    return (
      <Suspense fallback={<RouteLoadingFallback label="Preparando tu espacio…" />}>
        <Onboarding onComplete={handleOnboardingComplete} />
      </Suspense>
    );
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
      {!isEmailVerified && (
        <Suspense fallback={null}>
          <EmailVerificationBanner />
        </Suspense>
      )}

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
          <Suspense fallback={<RouteLoadingFallback />}>{renderView()}</Suspense>
        </div>
      </main>

      {(currentView === 'month' || currentView === 'day') && !isReadOnly && (
        <button
          className="btn-fab"
          onClick={() => {
            setSelectedEvent(null);
            setShowEventForm(true);
          }}
          aria-label="Crear evento"
          title="Crear turno/evento"
          type="button"
        >
          <span className="fab-emoji">➕</span>
        </button>
      )}

      <BottomNav
        currentView={currentView}
        onViewChange={handleViewChange}
      />

      <Suspense fallback={null}>
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
          onCloseFamily={handleCloseFamily}
        />
      </Suspense>

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
      {showPaymentModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PaymentModal
              isOpen={showPaymentModal}
              onClose={() => {
                setShowPaymentModal(false);
              }}
              onSuccess={() => {
                setShowPaymentModal(false);
              }}
            />
          </Suspense>
        </ErrorBoundary>
      )}
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
