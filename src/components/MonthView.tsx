import { format, isSameMonth, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ExpandedEvent } from '../types';
import './MonthView.css';

interface MonthViewProps {
  currentDate: Date;
  events: ExpandedEvent[];
  onDayClick: (date: Date) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function MonthView({
  currentDate,
  events,
  onDayClick,
}: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  
  // Ajustar para comenzar en lunes
  const startDay = firstDayOfMonth.getDay() || 7; // 0 (domingo) -> 7
  const daysBeforeMonth = startDay - 1;
  
  const firstDay = new Date(year, month, 1 - daysBeforeMonth);
  const totalDays = 42; // 6 semanas para cubrir todos los casos
  
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const day = new Date(firstDay);
    day.setDate(day.getDate() + i);
    days.push(day);
  }
  
  // Agrupar eventos por día
  const eventsByDay = events.reduce((acc, event) => {
    const dayKey = format(event.startDate, 'yyyy-MM-dd');
    if (!acc[dayKey]) {
      acc[dayKey] = [];
    }
    acc[dayKey].push(event);
    return acc;
  }, {} as Record<string, ExpandedEvent[]>);
  
  // Obtener colores únicos de eventos para un día
  const getUniqueColors = (dayEvents: ExpandedEvent[]) => {
    const colors = new Set(dayEvents.map(e => e.color));
    return Array.from(colors);
  };
  
  return (
    <div className="month-view">
      <div className="month-view-header">
        {WEEKDAYS.map(day => (
          <div key={day} className="month-weekday">
            {day}
          </div>
        ))}
      </div>
      
      <div className="month-view-grid">
        {days.map((day, index) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay[dayKey] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);
          const uniqueColors = getUniqueColors(dayEvents);
          
          return (
            <button
              key={index}
              className={`month-day ${!isCurrentMonth ? 'month-day-other' : ''} ${isTodayDate ? 'month-day-today' : ''}`}
              onClick={() => onDayClick(day)}
              aria-label={`${format(day, 'd MMMM yyyy', { locale: es })}, ${dayEvents.length} eventos`}
            >
              <span className={`month-day-number ${isTodayDate ? 'month-day-number-today' : ''}`}>
                {format(day, 'd')}
              </span>
              
              {uniqueColors.length > 0 && (
                <div className="month-day-dots">
                  {uniqueColors.slice(0, 4).map((color, i) => (
                    <span
                      key={i}
                      className="month-day-dot"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {uniqueColors.length > 4 && (
                    <span className="month-day-dot-more">
                      +{uniqueColors.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
