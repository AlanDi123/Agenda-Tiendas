import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, isSameMonth, isToday, isSameDay, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Genera un color aleatorio para avatares (colores de miembros Dommuss-style)
 */
export function generateAvatarColor(): string {
  const colors = [
    '#1E88E5', '#43A047', '#FB8C00', '#8E24AA',
    '#E53935', '#00ACC1', '#5D4037', '#6D6D6D'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Genera las iniciales de un nombre
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Genera un ID único
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Formatea una fecha para mostrar en la Top App Bar
 */
export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: es });
}

/**
 * Formatea una fecha para mostrar en la vista diaria
 */
export function formatFullDate(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM yyyy", { locale: es });
}

/**
 * Formatea una hora
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm');
}

/**
 * Formatea una fecha corta
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM', { locale: es });
}

/**
 * Obtiene los días del mes para la vista mensual
 */
export function getDaysInMonth(date: Date): Date[] {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

/**
 * Obtiene los días de la semana para la vista semanal
 */
export function getDaysInWeek(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

/**
 * Navega al mes siguiente
 */
export function nextMonth(date: Date): Date {
  return addMonths(date, 1);
}

/**
 * Navega al mes anterior
 */
export function previousMonth(date: Date): Date {
  return subMonths(date, 1);
}

/**
 * Navega a la semana siguiente
 */
export function nextWeek(date: Date): Date {
  return addWeeks(date, 1);
}

/**
 * Navega a la semana anterior
 */
export function previousWeek(date: Date): Date {
  return subWeeks(date, 1);
}

/**
 * Verifica si dos fechas son el mismo día
 */
export { isSameDay, isToday, isSameMonth, startOfDay };

/**
 * Colores predefinidos para eventos (Dommuss-style)
 */
export const EVENT_COLORS = [
  { name: 'Azul', value: '#1E88E5' },
  { name: 'Verde', value: '#43A047' },
  { name: 'Naranja', value: '#FB8C00' },
  { name: 'Morado', value: '#8E24AA' },
  { name: 'Rojo', value: '#E53935' },
  { name: 'Turquesa', value: '#00ACC1' },
  { name: 'Marrón', value: '#5D4037' },
  { name: 'Gris', value: '#6D6D6D' },
];

/**
 * Patrones de recurrencia
 */
export const RECURRENCE_PATTERNS = [
  { value: 'none', label: 'No repetir' },
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensualmente' },
  { value: 'yearly', label: 'Anualmente' },
];

/**
 * Opciones de alarma
 */
export const ALARM_OPTIONS = [
  { value: 0, label: 'En el momento' },
  { value: 5, label: '5 minutos antes' },
  { value: 10, label: '10 minutos antes' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 1440, label: '1 día antes' },
];
