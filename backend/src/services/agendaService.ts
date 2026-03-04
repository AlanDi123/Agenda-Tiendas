/**
 * Agenda Service
 * Core business logic for appointments, availability, and scheduling
 * 
 * SECURITY HARDENED:
 * - Transaction-wrapped appointment creation
 * - Database unique constraint handling
 * - Proper conflict detection
 */

import prisma from '../lib/prisma';
import { AppointmentStatus, Appointment } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

// ============================================
// TYPES
// ============================================

export interface CreateAppointmentData {
  locationId: string;
  staffId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // minutes (if endTime not provided)
  serviceType: string;
  notes?: string;
  clientNotes?: string;
  color?: string;
}

export interface RescheduleAppointmentData {
  newStartTime: Date;
  newEndTime?: Date;
  duration?: number;
  reason?: string;
  rescheduledBy: string;
}

export interface AvailabilitySlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
}

// ============================================
// CONFLICT DETECTION
// ============================================

/**
 * Check if time slot conflicts with existing appointments
 * Optional transaction parameter for use within transactions
 */
export async function hasTimeConflict(
  locationId: string,
  staffId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string,
  tx?: any // Optional Prisma transaction client
): Promise<boolean> {
  const db = tx || prisma;
  
  const conflicts = await db.appointment.findMany({
    where: {
      locationId,
      staffId,
      status: {
        notIn: [AppointmentStatus.cancelled, AppointmentStatus.no_show],
      },
      ...(excludeAppointmentId && {
        id: { not: excludeAppointmentId },
      }),
      OR: [
        {
          startTime: { lte: startTime },
          endTime: { gt: startTime },
        },
        {
          startTime: { lt: endTime },
          endTime: { gte: endTime },
        },
        {
          startTime: { gte: startTime },
          endTime: { lte: endTime },
        },
      ],
    },
  });

  return conflicts.length > 0;
}

/**
 * Check if time is within staff availability
 */
export async function isWithinAvailability(
  staffId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const dayOfWeek = startTime.getDay();
  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
  const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();

  const availability = await prisma.availability.findFirst({
    where: {
      staffId,
      dayOfWeek,
      active: true,
      startTime: { lte: startMinutes },
      endTime: { gte: endMinutes },
    },
  });

  return !!availability;
}

/**
 * Check if date is not blocked (unavailable dates)
 */
export async function isDateAvailable(
  locationId: string,
  date: Date
): Promise<boolean> {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const unavailable = await prisma.unavailableDate.findFirst({
    where: {
      locationId,
      date: dateOnly,
    },
  });

  return !unavailable;
}

// ============================================
// APPOINTMENT CRUD
// ============================================

/**
 * Create a new appointment
 * 
 * SECURITY: Wrapped in transaction with conflict handling
 */
export async function createAppointment(
  data: CreateAppointmentData
): Promise<Appointment> {
  const {
    locationId,
    staffId,
    userId,
    startTime,
    endTime,
    duration,
    serviceType,
    notes,
    clientNotes,
    color,
  } = data;

  // Calculate end time if duration provided
  const calculatedEndTime = endTime || new Date(startTime.getTime() + (duration || 30) * 60000);

  // Use transaction for atomic creation with conflict handling
  try {
    const appointment = await prisma.$transaction(async (tx) => {
      // Validate: Check for conflicts (application-level)
      const hasConflict = await hasTimeConflict(
        locationId,
        staffId,
        startTime,
        calculatedEndTime,
        undefined,
        tx
      );

      if (hasConflict) {
        throw createError('Time slot conflicts with existing appointment', 409, 'TIME_CONFLICT');
      }

      // Validate: Check staff availability
      const withinAvailability = await isWithinAvailability(staffId, startTime, calculatedEndTime);
      if (!withinAvailability) {
        throw createError('Requested time is outside staff availability', 400, 'OUTSIDE_AVAILABILITY');
      }

      // Validate: Check location unavailable dates
      const dateAvailable = await isDateAvailable(locationId, startTime);
      if (!dateAvailable) {
        throw createError('Location is unavailable on this date', 400, 'LOCATION_UNAVAILABLE');
      }

      // Create appointment (database unique constraint provides final protection)
      return tx.appointment.create({
        data: {
          locationId,
          staffId,
          userId,
          startTime,
          endTime: calculatedEndTime,
          duration: duration || Math.round((calculatedEndTime.getTime() - startTime.getTime()) / 60000),
          serviceType,
          notes,
          clientNotes,
          color,
          status: AppointmentStatus.pending,
          rescheduleCount: 0,
        },
        include: {
          location: true,
          staff: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    });

    return appointment;
  } catch (error: any) {
    // Handle unique constraint violation (database-level protection)
    if (error.code === 'P2002') {
      throw createError('Time slot is no longer available. Please select another time.', 409, 'TIME_CONFLICT');
    }
    throw error;
  }
}

/**
 * Get appointment by ID
 */
export async function getAppointment(appointmentId: string): Promise<Appointment | null> {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      location: true,
      staff: {
        include: {
          user: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
      rescheduleHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
  userId?: string
): Promise<Appointment> {
  const updateData: any = { status };

  if (status === AppointmentStatus.cancelled) {
    updateData.cancelledAt = new Date();
    updateData.cancelledBy = userId;
  }

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: updateData,
  });
}

/**
 * Cancel appointment
 */
export async function cancelAppointment(
  appointmentId: string,
  userId: string,
  reason?: string
): Promise<Appointment> {
  return prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: AppointmentStatus.cancelled,
      cancelledAt: new Date(),
      cancelledBy: userId,
      cancelReason: reason,
    },
  });
}

// ============================================
// RESCHEDULE LOGIC
// ============================================

/**
 * Reschedule appointment with history tracking
 */
export async function rescheduleAppointment(
  appointmentId: string,
  data: RescheduleAppointmentData
): Promise<Appointment> {
  const { newStartTime, newEndTime, duration, reason, rescheduledBy } = data;

  // Get current appointment
  const appointment = await getAppointment(appointmentId);
  if (!appointment) {
    throw createError('Appointment not found', 404, 'NOT_FOUND');
  }

  // Cannot reschedule cancelled appointments
  if (appointment.status === AppointmentStatus.cancelled) {
    throw createError('Cannot reschedule cancelled appointment', 400, 'CANCELLED_APPOINTMENT');
  }

  const calculatedEndTime = newEndTime || new Date(newStartTime.getTime() + (duration || appointment.duration) * 60000);

  // Use transaction for atomic reschedule
  try {
    return await prisma.$transaction(async (tx) => {
      // Check for conflicts (excluding current appointment)
      const hasConflict = await hasTimeConflict(
        appointment.locationId,
        appointment.staffId,
        newStartTime,
        calculatedEndTime,
        appointmentId,
        tx
      );

      if (hasConflict) {
        throw createError('New time slot conflicts with existing appointment', 409, 'TIME_CONFLICT');
      }

      // Create reschedule history
      await tx.appointmentReschedule.create({
        data: {
          appointmentId,
          previousStartTime: appointment.startTime,
          previousEndTime: appointment.endTime,
          newStartTime,
          newEndTime: calculatedEndTime,
          reason,
          rescheduledBy,
        },
      });

      // Update appointment
      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          startTime: newStartTime,
          endTime: calculatedEndTime,
          rescheduleCount: { increment: 1 },
          previousStartTime: appointment.startTime,
          previousEndTime: appointment.endTime,
        },
        include: {
          rescheduleHistory: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });
    });
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      throw createError('New time slot is no longer available', 409, 'TIME_CONFLICT');
    }
    throw error;
  }
}

// ============================================
// AVAILABILITY QUERIES
// ============================================

/**
 * Get available slots for a date range
 * 
 * OPTIMIZED: Pre-fetches appointments and uses interval merging
 */
export async function getAvailableSlots(
  staffId: string,
  locationId: string,
  startDate: Date,
  endDate: Date,
  slotDuration: number = 30
): Promise<AvailabilitySlot[]> {
  const slots: AvailabilitySlot[] = [];
  
  // Get location business hours
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: {
      businessStart: true,
      businessEnd: true,
      slotDuration: true,
      timezone: true,
    },
  });

  if (!location) {
    return slots;
  }

  const businessStartMinutes = location.businessStart * 60;
  const businessEndMinutes = location.businessEnd * 60;
  const duration = slotDuration || location.slotDuration;

  // Pre-fetch all appointments for the date range (single query)
  const appointments = await prisma.appointment.findMany({
    where: {
      staffId,
      startTime: { gte: startDate },
      endTime: { lte: endDate },
      status: {
        notIn: [AppointmentStatus.cancelled, AppointmentStatus.no_show],
      },
    },
    select: {
      startTime: true,
      endTime: true,
    },
  });

  // Create a map of appointments by date for O(1) lookup
  const appointmentsByDate = new Map<string, Array<{ start: number; end: number }>>();
  for (const apt of appointments) {
    const dateKey = apt.startTime.toISOString().split('T')[0];
    const startMinutes = apt.startTime.getHours() * 60 + apt.startTime.getMinutes();
    const endMinutes = apt.endTime.getHours() * 60 + apt.endTime.getMinutes();
    
    if (!appointmentsByDate.has(dateKey)) {
      appointmentsByDate.set(dateKey, []);
    }
    appointmentsByDate.get(dateKey)!.push({ start: startMinutes, end: endMinutes });
  }

  // Generate slots for each day
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0];
    const dayAppointments = appointmentsByDate.get(dateKey) || [];
    
    // Sort appointments by start time for efficient merging
    dayAppointments.sort((a, b) => a.start - b.start);
    
    // Merge overlapping appointments
    const mergedAppointments: Array<{ start: number; end: number }> = [];
    for (const apt of dayAppointments) {
      if (mergedAppointments.length === 0 || apt.start > mergedAppointments[mergedAppointments.length - 1].end) {
        mergedAppointments.push(apt);
      } else {
        mergedAppointments[mergedAppointments.length - 1].end = Math.max(
          mergedAppointments[mergedAppointments.length - 1].end,
          apt.end
        );
      }
    }

    // Generate slots
    let slotStart = businessStartMinutes;
    while (slotStart + duration <= businessEndMinutes) {
      const slotEnd = slotStart + duration;
      
      // Check if slot conflicts with any merged appointment
      const hasConflict = mergedAppointments.some(apt =>
        slotStart < apt.end && slotEnd > apt.start
      );

      const slotDate = new Date(current);
      slotDate.setHours(Math.floor(slotStart / 60), slotStart % 60, 0, 0);
      const slotEndDate = new Date(slotDate);
      slotEndDate.setMinutes(slotEndDate.getMinutes() + duration);

      slots.push({
        startTime: slotDate,
        endTime: slotEndDate,
        available: !hasConflict,
      });

      slotStart += duration;
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return slots;
}

/**
 * Get appointments for date range
 */
export async function getAppointmentsByRange(
  staffId: string,
  startDate: Date,
  endDate: Date,
  status?: AppointmentStatus[]
): Promise<Appointment[]> {
  return prisma.appointment.findMany({
    where: {
      staffId,
      startTime: {
        gte: startDate,
        lte: endDate,
      },
      ...(status && status.length > 0 && {
        status: { in: status },
      }),
    },
    include: {
      location: true,
      staff: {
        include: {
          user: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });
}

/**
 * Get appointments by location
 */
export async function getAppointmentsByLocation(
  locationId: string,
  startDate: Date,
  endDate: Date
): Promise<Appointment[]> {
  return prisma.appointment.findMany({
    where: {
      locationId,
      startTime: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      staff: {
        include: {
          user: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get appointment statistics for staff
 */
export async function getStaffStatistics(
  staffId: string,
  startDate: Date,
  endDate: Date
) {
  const appointments = await prisma.appointment.findMany({
    where: {
      staffId,
      startTime: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      status: true,
      duration: true,
    },
  });

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter((a: any) => a.status === 'confirmed').length,
    cancelled: appointments.filter((a: any) => a.status === 'cancelled').length,
    noShow: appointments.filter((a: any) => a.status === 'no_show').length,
    completed: appointments.filter((a: any) => a.status === 'completed').length,
    totalDuration: appointments.reduce((sum: number, a: any) => sum + a.duration, 0),
  };

  return stats;
}
