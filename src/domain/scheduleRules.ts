export const SCHEDULE_RULES = {
  START_HOUR: 6,
  END_HOUR: 22,
  STEP_MINUTES: 15,
} as const;

export function toMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function isWithinScheduleTime(date: Date): boolean {
  const m = toMinutes(date);
  const min = SCHEDULE_RULES.START_HOUR * 60;
  const max = SCHEDULE_RULES.END_HOUR * 60;
  return m >= min && m <= max;
}

export function isStepAligned(date: Date): boolean {
  return date.getMinutes() % SCHEDULE_RULES.STEP_MINUTES === 0;
}

