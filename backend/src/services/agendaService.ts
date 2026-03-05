/**
 * Agenda Service (Simplified)
 * Stub implementation without database dependency
 */

// ============================================
// TYPES
// ============================================

export interface Appointment {
  id: string;
  locationId: string;
  staffId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  serviceType: string;
  status: string;
  notes?: string;
  clientNotes?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Availability {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: number;
  endTime: number;
  active: boolean;
}

export interface Location {
  id: string;
  ownerId: string;
  name: string;
  address?: string;
  city?: string;
  timezone: string;
  slotDuration: number;
  businessStart: number;
  businessEnd: number;
  active: boolean;
}

// ============================================
// STUB FUNCTIONS
// ============================================

/**
 * Get appointments for a date range
 */
export async function getAppointments(
  _userId: string,
  _startDate: Date,
  _endDate: Date
): Promise<Appointment[]> {
  // Stub - returns empty array
  console.log('[AgendaService] getAppointments called');
  return [];
}

/**
 * Create a new appointment
 */
export async function createAppointment(data: {
  locationId: string;
  staffId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  serviceType: string;
  notes?: string;
  clientNotes?: string;
  color?: string;
}): Promise<Appointment> {
  // Stub - throws not implemented
  throw new Error('Appointment creation requires database configuration');
}

/**
 * Update an appointment
 */
export async function updateAppointment(
  appointmentId: string,
  data: Partial<Appointment>
): Promise<Appointment> {
  // Stub
  throw new Error('Appointment update requires database configuration');
}

/**
 * Delete an appointment
 */
export async function deleteAppointment(appointmentId: string): Promise<void> {
  // Stub
  throw new Error('Appointment deletion requires database configuration');
}

/**
 * Get availability for a staff member
 */
export async function getAvailability(staffId: string): Promise<Availability[]> {
  // Stub
  return [];
}

/**
 * Set availability for a staff member
 */
export async function setAvailability(
  staffId: string,
  availability: Omit<Availability, 'id'>[]
): Promise<Availability[]> {
  // Stub
  throw new Error('Availability setting requires database configuration');
}

/**
 * Get locations for a user
 */
export async function getLocations(userId: string): Promise<Location[]> {
  // Stub
  return [];
}

/**
 * Create a new location
 */
export async function createLocation(data: {
  ownerId: string;
  name: string;
  address?: string;
  city?: string;
  timezone?: string;
  slotDuration?: number;
  businessStart?: number;
  businessEnd?: number;
}): Promise<Location> {
  // Stub
  throw new Error('Location creation requires database configuration');
}

/**
 * Check for scheduling conflicts
 */
export async function checkConflicts(
  locationId: string,
  staffId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string
): Promise<boolean> {
  // Stub - no conflicts
  return false;
}

/**
 * Get appointments for a specific location
 */
export async function getLocationAppointments(
  locationId: string,
  startDate: Date,
  endDate: Date
): Promise<Appointment[]> {
  // Stub
  return [];
}

export default {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAvailability,
  setAvailability,
  getLocations,
  createLocation,
  checkConflicts,
  getLocationAppointments,
};
