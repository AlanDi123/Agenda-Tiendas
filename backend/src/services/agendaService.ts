/**
 * Agenda Service
 * Core business logic for appointments, availability, and scheduling
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
 */
export async function hasTimeConflict(
  locationId: string,
  staffId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string
): Promise<boolean> {
  const conflicts = await prisma.appointment.findMany({
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

  // Validate: Check for conflicts
  const hasConflict = await hasTimeConflict(
    locationId,
    staffId,
    startTime,
    calculatedEndTime
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

  // Create appointment
  const appointment = await prisma.appointment.create({
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
              name: true,
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

  return appointment;
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

  // Check for conflicts (excluding current appointment)
  const hasConflict = await hasTimeConflict(
    appointment.locationId,
    appointment.staffId,
    newStartTime,
    calculatedEndTime,
    appointmentId
  );

  if (hasConflict) {
    throw createError('New time slot conflicts with existing appointment', 409, 'TIME_CONFLICT');
  }

  // Use transaction for atomic update
  return prisma.$transaction(async (tx) => {
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
}

// ============================================
// AVAILABILITY QUERIES
// ============================================

/**
 * Get available slots for a date range
 */
export async function getAvailableSlots(
  staffId: string,
  locationId: string,
  startDate: Date,
  endDate: Date,
  slotDuration: number = 30
): Promise<AvailabilitySlot[]> {
  const slots: AvailabilitySlot[] = [];
  const current = new Date(startDate);

  // Get location business hours
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: {
      businessStart: true,
      businessEnd: true,
      slotDuration: true,
    },
  });

  if (!location) {
    return slots;
  }

  const businessStartMinutes = location.businessStart * 60;
  const businessEndMinutes = location.businessEnd * 60;
  const duration = slotDuration || location.slotDuration;

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayStart = new Date(current);
    dayStart.setHours(Math.floor(businessStartMinutes / 60), businessStartMinutes % 60, 0, 0);

    // Get all appointments for this day
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(Math.floor(businessEndMinutes / 60), businessEndMinutes % 60, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        staffId,
        startTime: { gte: dayStart },
        endTime: { lte: dayEnd },
        status: {
          notIn: [AppointmentStatus.cancelled, AppointmentStatus.no_show],
        },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    // Generate slots
    let slotStart = new Date(dayStart);
    while (slotStart < dayEnd) {
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);

      if (slotEnd > dayEnd) break;

      // Check if slot conflicts with any appointment
      const hasConflict = appointments.some(apt =>
        slotStart < apt.endTime && slotEnd > apt.startTime
      );

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        available: !hasConflict,
      });

      slotStart = slotEnd;
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
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    noShow: appointments.filter(a => a.status === 'no_show').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    totalDuration: appointments.reduce((sum, a) => sum + a.duration, 0),
  };

  return stats;
}
