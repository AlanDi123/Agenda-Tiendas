import { create } from 'zustand';
import type { CalendarView, ExpandedEvent, DeleteScope } from '../types';

export interface UiState {
  currentView: CalendarView;
  showEventForm: boolean;
  selectedEvent: ExpandedEvent | null;
  showEventDetail: boolean;
  showProfileSelector: boolean;
  showAddProfile: boolean;
  showDeleteConfirm: boolean;
  deleteScope: DeleteScope;
  filterProfileId: string | null;
  showUserAuth: boolean;
  showUserSettings: boolean;
  pendingEnvironmentId: string;
  showEditScopeDialog: boolean;
  editScope: 'single' | 'future' | 'all';
  showPaymentModal: boolean;
  waitingForPayment: boolean;
  pendingPlanType: string | null;
}

type UiActions = {
  setCurrentView: (view: CalendarView | ((prev: CalendarView) => CalendarView)) => void;
  cycleCalendarView: () => void;
  setShowEventForm: (open: boolean) => void;
  setSelectedEvent: (event: ExpandedEvent | null) => void;
  setShowEventDetail: (open: boolean) => void;
  setShowProfileSelector: (open: boolean) => void;
  setShowAddProfile: (open: boolean) => void;
  setShowDeleteConfirm: (open: boolean) => void;
  setDeleteScope: (scope: DeleteScope) => void;
  setFilterProfileId: (id: string | null) => void;
  setShowUserAuth: (open: boolean) => void;
  setShowUserSettings: (open: boolean) => void;
  setPendingEnvironmentId: (id: string) => void;
  setShowEditScopeDialog: (open: boolean) => void;
  setEditScope: (scope: 'single' | 'future' | 'all') => void;
  setShowPaymentModal: (open: boolean) => void;
  setWaitingForPayment: (waiting: boolean) => void;
  setPendingPlanType: (plan: string | null) => void;
  closeEventEditing: () => void;
};

const initial: UiState = {
  currentView: 'month',
  showEventForm: false,
  selectedEvent: null,
  showEventDetail: false,
  showProfileSelector: false,
  showAddProfile: false,
  showDeleteConfirm: false,
  deleteScope: 'single',
  filterProfileId: null,
  showUserAuth: false,
  showUserSettings: false,
  pendingEnvironmentId: '',
  showEditScopeDialog: false,
  editScope: 'single',
  showPaymentModal: false,
  waitingForPayment: false,
  pendingPlanType: null,
};

export const useUiStore = create<UiState & UiActions>((set) => ({
  ...initial,

  setCurrentView: (view) =>
    set((s) => ({
      currentView: typeof view === 'function' ? view(s.currentView) : view,
    })),

  cycleCalendarView: () =>
    set((s) => {
      const prev = s.currentView;
      const next: CalendarView =
        prev === 'month' ? 'week' : prev === 'week' ? 'day' : 'month';
      return { currentView: next };
    }),

  setShowEventForm: (open) => set({ showEventForm: open }),
  setSelectedEvent: (event) => set({ selectedEvent: event }),
  setShowEventDetail: (open) => set({ showEventDetail: open }),
  setShowProfileSelector: (open) => set({ showProfileSelector: open }),
  setShowAddProfile: (open) => set({ showAddProfile: open }),
  setShowDeleteConfirm: (open) => set({ showDeleteConfirm: open }),
  setDeleteScope: (scope) => set({ deleteScope: scope }),
  setFilterProfileId: (id) => set({ filterProfileId: id }),
  setShowUserAuth: (open) => set({ showUserAuth: open }),
  setShowUserSettings: (open) => set({ showUserSettings: open }),
  setPendingEnvironmentId: (id) => set({ pendingEnvironmentId: id }),
  setShowEditScopeDialog: (open) => set({ showEditScopeDialog: open }),
  setEditScope: (scope) => set({ editScope: scope }),
  setShowPaymentModal: (open) => set({ showPaymentModal: open }),
  setWaitingForPayment: (waiting) => set({ waitingForPayment: waiting }),
  setPendingPlanType: (plan) => set({ pendingPlanType: plan }),

  closeEventEditing: () =>
    set({
      showEventForm: false,
      showEventDetail: false,
      selectedEvent: null,
    }),
}));
