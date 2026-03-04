/**
 * Agenda Routes (v1)
 * Handles appointments, availability, and scheduling
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as agendaService from '../services/agendaService';
import { logApiError, logAgendaConflict } from '../services/errorLogger';
import { createError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const createAppointmentSchema = z.object({
  locationId: z.string().uuid(),
  staffId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  serviceType: z.string().min(1),
  notes: z.string().optional(),
  clientNotes: z.string().optional(),
  color: z.string().optional(),
});

const rescheduleAppointmentSchema = z.object({
  newStartTime: z.string().datetime(),
  newEndTime: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  reason: z.string().optional(),
});

const cancelAppointmentSchema = z.object({
  reason: z.string().optional(),
});

const availabilitySchema = z.object({
  staffId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  slotDuration: z.number().int().positive().optional(),
});

// ============================================
// MIDDLEWARE
// ============================================

// All agenda routes require authentication
router.use(authMiddleware);

// ============================================
// APPOINTMENTS
// ============================================

/**
 * POST /api/v1/agenda/appointments
 * Create new appointment
 */
router.post('/appointments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const data = createAppointmentSchema.parse(req.body);

    const appointment = await agendaService.createAppointment({
      ...data,
      userId: user.id,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : undefined,
    });

    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid request data', 400, 'VALIDATION_ERROR'));
    }

    if ((error as any).code === 'TIME_CONFLICT') {
      await logAgendaConflict(
        '/api/v1/agenda/appointments',
        'POST',
        'Time slot conflict',
        {
          userId: (req as any).user?.id,
          startTime: new Date(req.body.startTime),
          device: req.headers['user-agent'],
        }
      );
    } else {
      await logApiError(
        '/api/v1/agenda/appointments',
        'POST',
        (error as any).code || 'CREATE_APPOINTMENT_ERROR',
        (error as any).message,
        {
          userId: (req as any).user?.id,
          device: req.headers['user-agent'],
          requestBody: req.body,
        }
      );
    }
    next(error);
  }
});

/**
 * GET /api/v1/agenda/appointments/:id
 * Get appointment by ID
 */
router.get('/appointments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await agendaService.getAppointment(id);

    if (!appointment) {
      throw createError('Appointment not found', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/agenda/appointments/:id/reschedule
 * Reschedule appointment
 */
router.post('/appointments/:id/reschedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const data = rescheduleAppointmentSchema.parse(req.body);

    const appointment = await agendaService.rescheduleAppointment(id, {
      ...data,
      newStartTime: new Date(data.newStartTime),
      newEndTime: data.newEndTime ? new Date(data.newEndTime) : undefined,
      rescheduledBy: user.id,
    });

    res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    if ((error as any).code === 'TIME_CONFLICT') {
      await logAgendaConflict(
        `/api/v1/agenda/appointments/${req.params.id}/reschedule`,
        'POST',
        'Reschedule conflict',
        {
          userId: (req as any).user?.id,
          appointmentId: req.params.id,
          startTime: new Date(req.body.newStartTime),
          device: req.headers['user-agent'],
        }
      );
    }
    next(error);
  }
});

/**
 * POST /api/v1/agenda/appointments/:id/cancel
 * Cancel appointment
 */
router.post('/appointments/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { reason } = cancelAppointmentSchema.parse(req.body);

    const appointment = await agendaService.cancelAppointment(id, user.id, reason);

    res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/agenda/appointments/:id/status
 * Update appointment status
 */
router.put('/appointments/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'cancelled', 'no_show', 'completed'].includes(status)) {
      throw createError('Invalid status', 400, 'INVALID_STATUS');
    }

    const appointment = await agendaService.updateAppointmentStatus(id, status);

    res.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// AVAILABILITY
// ============================================

/**
 * GET /api/v1/agenda/availability
 * Get available slots for date range
 */
router.get('/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { staffId, startDate, endDate, slotDuration } = availabilitySchema.parse(req.query);

    // Get staff's default location or use first active location
    const slots = await agendaService.getAvailableSlots(
      staffId,
      user.locationId, // Would need to be passed or determined
      new Date(startDate),
      new Date(endDate),
      slotDuration
    );

    res.json({
      success: true,
      data: slots,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid query parameters', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

// ============================================
// APPOINTMENT LISTS
// ============================================

/**
 * GET /api/v1/agenda/appointments
 * Get appointments by date range
 */
router.get('/appointments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate, staffId, locationId, status } = z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      staffId: z.string().uuid().optional(),
      locationId: z.string().uuid().optional(),
      status: z.string().optional().transform(s => s ? s.split(',') : undefined),
    }).parse(req.query);

    let appointments;

    if (staffId) {
      appointments = await agendaService.getAppointmentsByRange(
        staffId,
        new Date(startDate),
        new Date(endDate),
        status as any
      );
    } else if (locationId) {
      appointments = await agendaService.getAppointmentsByLocation(
        locationId,
        new Date(startDate),
        new Date(endDate)
      );
    } else {
      // Get user's own appointments
      appointments = await agendaService.getAppointmentsByRange(
        user.id,
        new Date(startDate),
        new Date(endDate),
        status as any
      );
    }

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid query parameters', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

/**
 * GET /api/v1/agenda/staff/:staffId/statistics
 * Get staff appointment statistics
 */
router.get('/staff/:staffId/statistics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate } = z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }).parse(req.query);

    const stats = await agendaService.getStaffStatistics(
      staffId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid query parameters', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});

export { router as agendaRoutes };
