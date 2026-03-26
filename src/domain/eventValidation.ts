import { isStepAligned, isWithinScheduleTime } from './scheduleRules';

export function validateEventTimeRange(start: Date, end: Date, allDay: boolean): string | null {
  if (end <= start) {
    return 'La fecha/hora de fin debe ser posterior al inicio';
  }
  if (allDay) return null;

  if (!isWithinScheduleTime(start)) {
    return 'La hora de inicio debe estar entre 06:00 y 22:00';
  }
  if (!isWithinScheduleTime(end)) {
    return 'La hora de fin debe estar entre 06:00 y 22:00';
  }
  if (!isStepAligned(start) || !isStepAligned(end)) {
    return 'Las horas deben estar en intervalos de 15 minutos';
  }
  return null;
}

