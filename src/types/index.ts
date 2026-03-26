// Tipos principales de la aplicación

export type EventCategory = 'invitada' | 'mama_xv' | 'mama_novios' | 'madrina' | 'dama_honor' | 'otro';

export interface EventAlarm {
  id: string;
  minutesBefore: number;
  triggered: boolean;
  triggeredAt?: Date;
}

export interface EventComment {
  profileId: string;
  profileName: string;
  profileAvatarColor: string;
  text: string;
  timestamp: Date;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  initials: string;
  permissions: 'admin' | 'readonly';
  pin?: string;
  recoveryEmail?: string;
  createdAt: Date;
}

export interface Environment {
  id: string;
  name: string;
  pin?: string;
  profiles: Profile[];
  activeProfileId?: string;
  familyCode: string;
  planType: 'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY';
  planExpiresAt?: Date;
  createdAt: Date;
}

export interface Event {
  id: string;
  title: string;
  phone?: string;
  allDay: boolean;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  assignedProfileIds: string[];
  color: string;
  category?: EventCategory;
  rrule?: string;
  alarms?: EventAlarm[];
  createdAt: Date;
  updatedAt: Date;
  version?: number;
  deletedAt?: Date;
  createdBy?: string;
  lastModifiedBy?: string;
  attachments?: string[];
  comments?: EventComment[];
}

export interface ExpandedEvent {
  id: string;
  baseEventId: string;
  title: string;
  phone?: string;
  allDay: boolean;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  assignedProfileIds: string[];
  color: string;
  category?: EventCategory;
  isRecurring: boolean;
  originalDate?: Date;
  alarms?: EventAlarm[];
  createdBy?: string;
  lastModifiedBy?: string;
  attachments?: string[];
  comments?: EventComment[];
}

export type CalendarView = 'month' | 'week' | 'day' | 'lists' | 'menu' | 'contacts' | 'notes';

export interface SharedContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  avatarColor: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedNote {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type DeleteScope = 'single' | 'future' | 'all';

export type EditScope = 'single' | 'future' | 'all';

export interface AppState {
  environment: Environment | null;
  isAuthenticated: boolean;
  darkMode: boolean;
  currentView: CalendarView;
  currentDate: Date;
}
