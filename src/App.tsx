import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EventsProvider, useEvents } from './contexts/EventsContext';
import { ToastProvider, useToastsState, useToastActions } from './contexts/ToastContext';
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
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from './stores/uiStore';
import { useNetworkStatus } from './hooks/useNetworkStatus';

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
import { initializeNotifications } from './services/notificationService';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  watchOsThemeForStatusBar,
  setupKeyboardScroll,
  setupDeepLinkListener,
  lockOrientationPortrait,
} from './services/nativeService';
import type { CalendarView, ExpandedEvent, Event, Profile } from './types';
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
  } = useEvents();

  const { toasts } = useToastsState();
  const { removeToast } = useToastActions();

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
  const [showSplash, setShowSplash] = useState(true);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');

  const networkReachable = useNetworkStatus();
  const [authStallOffline, setAuthStallOffline] = useState(false);
  const isOnline = networkReachable && !authStallOffline;

  const {
    currentView,
    showEventForm,
    selectedEvent,
    showEventDetail,
    showProfileSelector,
    showAddProfile,
    showDeleteConfirm,
    deleteScope,
    filterProfileId,
    showUserAuth,
    showUserSettings,
    pendingEnvironmentId,
    showEditScopeDialog,
    editScope,
    showPaymentModal,
    waitingForPayment,
    pendingPlanType,
    setCurrentView,
    cycleCalendarView,
    setShowEventForm,
    setSelectedEvent,
    setShowEventDetail,
    setShowProfileSelector,
    setShowAddProfile,
    setShowDeleteConfirm,
    setDeleteScope,
    setFilterProfileId,
    setShowUserAuth,
    setShowUserSettings,
    setPendingEnvironmentId,
    setShowEditScopeDialog,
    setEditScope,
    setShowPaymentModal,
    setWaitingForPayment,
    setPendingPlanType,
    closeEventEditing,
  } = useUiStore(
    useShallow((s) => ({
      currentView: s.currentView,
      showEventForm: s.showEventForm,
      selectedEvent: s.selectedEvent,
      showEventDetail: s.showEventDetail,
      showProfileSelector: s.showProfileSelector,
      showAddProfile: s.showAddProfile,
      showDeleteConfirm: s.showDeleteConfirm,
      deleteScope: s.deleteScope,
      filterProfileId: s.filterProfileId,
      showUserAuth: s.showUserAuth,
      showUserSettings: s.showUserSettings,
      pendingEnvironmentId: s.pendingEnvironmentId,
      showEditScopeDialog: s.showEditScopeDialog,
      editScope: s.editScope,
      showPaymentModal: s.showPaymentModal,
      waitingForPayment: s.waitingForPayment,
      pendingPlanType: s.pendingPlanType,
      setCurrentView: s.setCurrentView,
      cycleCalendarView: s.cycleCalendarView,
      setShowEventForm: s.setShowEventForm,
      setSelectedEvent: s.setSelectedEvent,
      setShowEventDetail: s.setShowEventDetail,
      setShowProfileSelector: s.setShowProfileSelector,
      setShowAddProfile: s.setShowAddProfile,
      setShowDeleteConfirm: s.setShowDeleteConfirm,
      setDeleteScope: s.setDeleteScope,
      setFilterProfileId: s.setFilterProfileId,
      setShowUserAuth: s.setShowUserAuth,
      setShowUserSettings: s.setShowUserSettings,
      setPendingEnvironmentId: s.setPendingEnvironmentId,
      setShowEditScopeDialog: s.setShowEditScopeDialog,
      setEditScope: s.setEditScope,
      setShowPaymentModal: s.setShowPaymentModal,
      setWaitingForPayment: s.setWaitingForPayment,
      setPendingPlanType: s.setPendingPlanType,
      closeEventEditing: s.closeEventEditing,
    }))
  );

  // StatusBar dinámica que sigue el OS theme + Keyboard scroll + Orientation
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const cleanupTheme = watchOsThemeForStatusBar();
    void setupKeyboardScroll();
    void lockOrientationPortrait();
    return cleanupTheme;
  }, []);

  // Deep link handler
  useEffect(() => {
    const cleanup = setupDeepLinkListener((path, params) => {
      if (path === '/join' || path === 'join') {
        const code = params.code;
        if (code) {
          // Navegar a la pantalla de unirse con el código
          console.log('[DeepLink] Unirse con código:', code);
        }
      }
    });
    return cleanup;
  }, []);

  // Handle auth state changes
  useEffect(() => {
    if (isAuthLoading) return;

    if (isAuthenticated && currentUser && !currentUser.emailVerified) {
      setAuthState('verify-email');
      return;
    }

    if (isAuthenticated) {
      setAuthState('authenticated');
    } else {
      setAuthState('login');
    }
  }, [isAuthenticated, isAuthLoading, currentUser]);

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

  // Failsafe: auth lento → banner tipo offline + quitar splash (sin bloquear IndexedDB)
  useEffect(() => {
    if (!isAuthLoading) {
      setAuthStallOffline(false);
      return;
    }
    const offlineTimeout = setTimeout(() => {
      console.warn('Timeout de conexión: mostrando aviso tipo sin conexión');
      setAuthStallOffline(true);
      setShowSplash(false);
    }, 5000);
    return () => clearTimeout(offlineTimeout);
  }, [isAuthLoading]);

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

  // Android back button handler (lee estado fresco desde uiStore)
  useEffect(() => {
    const isCapacitor = () =>
      typeof window !== 'undefined' &&
      Reflect.get(window, 'Capacitor') != null;
    if (!isCapacitor()) return;

    let backButtonListener: Awaited<ReturnType<typeof CapacitorApp.addListener>> | null = null;

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const s = useUiStore.getState();
      const hasOpenModals =
        s.showEventForm ||
        s.showEventDetail ||
        s.showUserSettings ||
        s.showProfileSelector ||
        s.showAddProfile ||
        s.showDeleteConfirm ||
        s.showEditScopeDialog;

      if (hasOpenModals) {
        if (s.showEditScopeDialog) s.setShowEditScopeDialog(false);
        if (s.showDeleteConfirm) s.setShowDeleteConfirm(false);
        if (s.showAddProfile) s.setShowAddProfile(false);
        if (s.showProfileSelector) s.setShowProfileSelector(false);
        if (s.showUserSettings) s.setShowUserSettings(false);
        if (s.showEventDetail) {
          s.setShowEventDetail(false);
          s.setSelectedEvent(null);
          return;
        }
        if (s.showEventForm) {
          s.setShowEventForm(false);
          s.setSelectedEvent(null);
          return;
        }
        return;
      }

      if (s.currentView === 'lists' || s.currentView === 'menu') {
        s.setCurrentView('month');
        return;
      }

      if (canGoBack) {
        window.history.back();
      }
    }).then((listener) => {
      backButtonListener = listener;
    });

    return () => {
      backButtonListener?.remove();
    };
  }, []);

  // Sync near real-time de familia+eventos a nube (debounced)
  useEffect(() => {
    if (!isAuthenticated || !environment || !isOnline) return;
    queueCloudFamilySync(environment, rawEvents);
  }, [isAuthenticated, environment, rawEvents, isOnline]);

  // Crear canales de notificación de Android al autenticarse
  useEffect(() => {
    if (isAuthenticated && Capacitor.isNativePlatform()) {
      initializeNotifications().catch(err =>
        console.error('Error al inicializar notificaciones:', err)
      );
    }
  }, [isAuthenticated]);

  // Rastrea qué familyCodes ya fueron sincronizados en esta sesión
  // para no borrar y re-descargar eventos en cada re-render.
  const syncedFamilyCodes = useRef<Set<string>>(new Set());

  // Al cambiar de familia, refrescar eventos desde snapshot cloud UNA SOLA VEZ por sesión.
  useEffect(() => {
    if (!isAuthenticated || !environment?.familyCode) return;
    const familyCode = environment.familyCode;
    if (syncedFamilyCodes.current.has(familyCode)) return; // ya sincronizado
    syncedFamilyCodes.current.add(familyCode);

    let cancelled = false;
    (async () => {
      try {
        const snapshot = await loadFamilySnapshotByCode(familyCode);
        if (cancelled) return;

        // Solo reemplazar eventos locales si el servidor devolvió datos.
        // Esto protege contra el caso donde la familia aún no fue sincronizada
        // al servidor (primer uso o datos aún no subidos).
        if (snapshot.events.length > 0) {
          await clearAllEvents();
          for (const ev of snapshot.events) {
            await saveEvent(ev);
          }
          await loadEvents();
        } else {
          // El servidor no tiene eventos — mantener los locales e intentar cargarlos
          await loadEvents();
        }
      } catch {
        // Fallback silencioso: red caída o familia no encontrada en nube.
        // Se mantiene el estado local sin tocar nada.
        await loadEvents().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  // loadEvents es estable (useCallback), familyCode es string primitivo — sin loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, environment?.familyCode]);

  // Set active profile if not set but environment has profiles — prefer matching email
  useEffect(() => {
    if (!activeProfile && environment && environment.profiles.length > 0) {
      const byEmail = environment.profiles.find(
        (p: Profile) => p.email?.toLowerCase() === currentUser?.email?.toLowerCase()
      );
      setActiveProfile((byEmail || environment.profiles[0]).id);
    }
  }, [environment, activeProfile, setActiveProfile, currentUser]);

  // Navigation handlers
  const handleViewChange = useCallback((view: CalendarView) => {
    setCurrentView(view);
  }, [setCurrentView]);

  const handleViewToggle = useCallback(() => {
    cycleCalendarView();
  }, [cycleCalendarView]);

  const handleDayClick = useCallback((date: Date) => {
    setViewDate(date);
    setCurrentView('day');
  }, [setViewDate, setCurrentView]);

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
  }, [setSelectedEvent, setShowEventDetail]);

  const handleTurnoSlotClick = useCallback((time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(viewDate);
    newDate.setHours(hours, minutes, 0, 0);
    setViewDate(newDate);
    setSelectedEvent(null);
    setShowEventForm(true);
  }, [viewDate, setViewDate, setSelectedEvent, setShowEventForm]);

  const handleTurnoEventClick = useCallback((event: ExpandedEvent) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  }, [setSelectedEvent, setShowEventDetail]);

  // Check premium before allowing advanced features
  const requirePremium = useCallback((feature: string, callback: () => void) => {
    if (!isPremium) {
      try {
        setShowPaymentModal(true);
      } catch (error: unknown) {
        console.error(`[Premium] Error showing payment modal for feature "${feature}":`, error);
        alert('Error al mostrar opciones de pago. Por favor intenta más tarde.');
      }
    } else {
      callback();
    }
  }, [isPremium, setShowPaymentModal]);

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
  }, [
    selectedEvent,
    expandedEvents,
    requirePremium,
    setShowEditScopeDialog,
    setShowEventDetail,
    setShowEventForm,
  ]);

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
        if (ev.deletedAt) return false;
        const d = new Date(ev.startDate);
        return d >= dayStart && d <= dayEnd;
      }).length;
      if (eventsInDay >= 10) {
        alert('Límite del plan Gratis: máximo 10 eventos por día.');
        return;
      }
    }

    await createEvent(eventData);
  }, [createEvent, isPremium, rawEvents, setShowPaymentModal]);

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
  }, [selectedEvent, requirePremium, setShowDeleteConfirm, setDeleteScope]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedEvent) return;

    await deleteEvent(selectedEvent.baseEventId, deleteScope);
    setShowDeleteConfirm(false);
    closeEventEditing();
  }, [selectedEvent, deleteScope, deleteEvent, setShowDeleteConfirm, closeEventEditing]);

  // Auth handlers
  const handleLoginSuccess = useCallback((emailVerified?: boolean) => {
    if (emailVerified === false) {
      if (currentUser?.email) setPendingVerifyEmail(currentUser.email);
      setAuthState('verify-email');
      return;
    }
    setAuthState('authenticated');
  }, [currentUser, setAuthState, setPendingVerifyEmail]);

  const handleRegisterSuccess = useCallback((token: string, email: string) => {
    void token;
    setPendingVerifyEmail(email);
    setAuthState('verify-email');
  }, [setPendingVerifyEmail, setAuthState]);

  const handleVerificationComplete = useCallback(() => {
    setPendingVerifyEmail('');
    setAuthState('authenticated');
  }, [setPendingVerifyEmail, setAuthState]);

  const handlePasswordResetSuccess = useCallback(() => {
    setAuthState('login');
  }, [setAuthState]);

  const handleLogout = useCallback(async () => {
    await logout();
    setPendingVerifyEmail('');
    setAuthState('login');
  }, [logout, setPendingVerifyEmail, setAuthState]);

  const handleCloseFamily = useCallback(async () => {
    await closeFamily();
    // La vista vuelve a onboarding automáticamente porque `environment` queda en null.
    setShowUserSettings(false);
  }, [closeFamily, setShowUserSettings]);

  // Onboarding handlers
  const handleOnboardingComplete = useCallback(async (data: {
    environmentName: string;
    pin?: string;
    profiles: Array<{ name: string; permissions: 'admin' | 'readonly'; color?: string }>;
    planType: 'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY';
    familyCode?: string;
  }) => {
    try {
      const { environmentName, pin, profiles: profileList, planType, familyCode } = data;
      const currentUserProfile = profileList[0];

      // 1. LÓGICA PARA UNIRSE A UNA FAMILIA EXISTENTE
      if (!environmentName.trim() && familyCode) {
        const snapshot = await loadFamilySnapshotByCode(familyCode);
        await saveEnvironment(snapshot.environment);
        await loadEnvironment(snapshot.environment.id);

        // Registrar a la nueva persona en esta familia con SU propio correo y color
        if (currentUser?.email && currentUserProfile) {
          const existing = snapshot.environment.profiles.find(
            (p: { email?: string }) => p.email === currentUser.email
          );
          if (!existing) {
            await addProfile(
              currentUserProfile.name,
              currentUser.email,
              'admin',
              undefined,
              undefined,
              currentUserProfile.color || '#FF6B35'
            );
            // Persist new member to backend so it survives re-sync
            apiFetch('/api/v1/families/join', {
              method: 'POST',
              auth: true,
              json: { familyCode, name: currentUserProfile.name, color: currentUserProfile.color },
            }).catch(err => console.warn('[Onboarding] join backend failed, will sync later:', err));
          }
        }

        await clearAllEvents();
        for (const ev of snapshot.events) { await saveEvent(ev); }
        if (currentUser) { await saveUserSession(currentUser.email, snapshot.environment.id); }
        return;
      }

      // 2. LÓGICA PARA CREAR UNA FAMILIA NUEVA
      let createdFamilyCode: string | null = null;
      let createdEnvironmentName: string | null = null;

      await clearAllEvents();
      const createdEnv = await createEnvironment(environmentName, pin, [], familyCode);
      createdFamilyCode = createdEnv.familyCode;
      createdEnvironmentName = createdEnv.name;

      // Agregar al creador explícitamente con su correo y color
      if (currentUser?.email && currentUserProfile) {
        await addProfile(
          currentUserProfile.name,
          currentUser.email,
          'admin',
          undefined,
          undefined,
          currentUserProfile.color || '#FF6B35'
        );
      }

      // Enviar el código de familia al mail registrado
      if (createdFamilyCode && currentUser) {
        try {
          await apiFetch('/api/v1/app/send-family-code', {
            method: 'POST',
            auth: true,
            json: { familyCode: createdFamilyCode, familyName: createdEnvironmentName, email: currentUser.email },
          });
        } catch (emailErr) {
          console.error('[Onboarding] Error enviando código de familia:', emailErr);
        }
      }

      // Si eligió plan pago → redirigir a MP y bloquear entrada
      if (planType === 'PREMIUM_MONTHLY' || planType === 'PREMIUM_YEARLY') {
        setPendingPlanType(planType);
        setWaitingForPayment(true);
        try {
          const { redirectToCheckout } = await import('./services/paymentGatewayService');
          await redirectToCheckout(planType);
        } catch (payErr) {
          console.error('[Onboarding] Error al redirigir a pago:', payErr);
          setWaitingForPayment(false);
          setPendingPlanType(null);
        }
      }
    } catch (error: unknown) {
      console.error('Error during onboarding:', error);
    }
  }, [
    createEnvironment,
    addProfile,
    currentUser,
    loadEnvironment,
    setPendingPlanType,
    setWaitingForPayment,
  ]);

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
    } catch (error: unknown) {
      console.error('Error in user auth:', error);
    }
  }, [
    pendingEnvironmentId,
    addProfile,
    loadEnvironment,
    setShowUserAuth,
    setPendingEnvironmentId,
  ]);

  const handleAddProfile = useCallback(async (name: string, permissions: 'admin' | 'readonly') => {
    await addProfile(name, '', permissions);
    setShowAddProfile(false);
  }, [addProfile, setShowAddProfile]);

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

  if (authState === 'verify-email') {
    const verifyEmailTarget = currentUser?.email || pendingVerifyEmail;
    if (!verifyEmailTarget) {
      return <SplashScreen />;
    }
    return (
      <Suspense fallback={<RouteLoadingFallback label="Cargando verificación…" />}>
        <VerifyEmail
          email={verifyEmailTarget}
          onVerificationComplete={handleVerificationComplete}
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
          event={selectedEvent ? {
            id: selectedEvent.baseEventId,
            title: selectedEvent.title,
            phone: selectedEvent.phone,
            location: selectedEvent.location,
            allDay: selectedEvent.allDay,
            startDate: selectedEvent.startDate,
            endDate: selectedEvent.endDate,
            notes: selectedEvent.notes,
            assignedProfileIds: selectedEvent.assignedProfileIds,
            color: selectedEvent.color,
            category: selectedEvent.category,
            createdAt: new Date(),
            updatedAt: new Date(),
            alarms: selectedEvent.alarms,
          } : undefined}
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
      <ToastProvider>
        <EventsProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </EventsProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
