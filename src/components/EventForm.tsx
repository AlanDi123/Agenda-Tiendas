import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import type { Event, Profile, EventCategory } from '../types';
import { Modal } from './Modal';
import { Input, Textarea, Toggle } from './Input';
import { PhoneInput } from './PhoneInput';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { SCHEDULE_RULES } from '../domain/scheduleRules';
import { validateEventTimeRange } from '../domain/eventValidation';
import './EventForm.css';

interface EventFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  event?: Event;
  profiles: Profile[];
  initialDate?: Date;
}

// Categorías con iconos y colores
const CATEGORIES: { value: EventCategory; label: string; icon: string; color: string }[] = [
  { value: 'invitada', label: 'Invitada', icon: '💌', color: '#F06292' },
  { value: 'mama_xv', label: 'Mamá de XV', icon: '👑', color: '#AB47BC' },
  { value: 'mama_novios', label: 'Mamá de Novios', icon: '💍', color: '#7E57C2' },
  { value: 'madrina', label: 'Madrina', icon: '🌸', color: '#26C6DA' },
  { value: 'dama_honor', label: 'Dama de Honor', icon: '💐', color: '#66BB6A' },
  { value: 'otro', label: 'Otro', icon: '📌', color: '#9E9E9E' },
];

export function EventForm({
  isOpen,
  onClose,
  onSave,
  event,
  profiles,
  initialDate,
}: EventFormProps) {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  // Form state
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(formatDateForInput(initialDate || now));
  const [startTime, setStartTime] = useState(formatTimeForInput(initialDate || now));
  const [endDate, setEndDate] = useState(formatDateForInput(initialDate || now));
  const [endTime, setEndTime] = useState(formatTimeForInput(oneHourLater));
  const [notes, setNotes] = useState('');
  const [assignedProfileIds, setAssignedProfileIds] = useState<string[]>([]);
  const [category, setCategory] = useState<EventCategory>('otro');

  const [titleError, setTitleError] = useState('');
  const [dateError, setDateError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Refs para validación con focus
  const titleRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);
  
  const isEditing = !!event;
  
  // Load event data when editing
  useEffect(() => {
    if (event && isOpen) {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);

      setTitle(event.title);
      setPhone(event.phone || '');
      setLocation(event.location || '');
      setAllDay(event.allDay);
      setStartDate(formatDateForInput(start));
      setStartTime(formatTimeForInput(start));
      setEndDate(formatDateForInput(end));
      setEndTime(formatTimeForInput(end));
      setNotes(event.notes || '');
      setAssignedProfileIds(event.assignedProfileIds);
      setCategory(event.category || 'otro');
      setTitleError('');
      setDateError('');
    } else if (isOpen) {
      // Reset form for new event
      resetForm();
    }
  }, [event, isOpen]);

  function resetForm() {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    setTitle('');
    setPhone('');
    setLocation('');
    setAllDay(false);
    setStartDate(formatDateForInput(initialDate || now));
    setStartTime(formatTimeForInput(initialDate || now));
    setEndDate(formatDateForInput(initialDate || now));
    setEndTime(formatTimeForInput(oneHourLater));
    setNotes('');
    setAssignedProfileIds([]);
    setCategory('otro');
    setTitleError('');
    setDateError('');
  }
  
  function formatDateForInput(date: Date): string {
    return format(date, 'yyyy-MM-dd');
  }
  
  function formatTimeForInput(date: Date): string {
    return format(date, 'HH:mm');
  }

  const toggleProfileAssignment = (profileId: string) => {
    setAssignedProfileIds(prev =>
      prev.includes(profileId)
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };
  
  const handleStartTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setStartTime(newTime);
    
    // Auto-complete end time (+1 hour)
    if (newTime && startDate) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const startDateTime = new Date(startDate);
      startDateTime.setHours(hours, minutes);
      
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      setEndTime(format(endDateTime, 'HH:mm'));
    }
  }, [startDate]);

  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setStartDate(newDate);

    // Auto-update end date to match start date
    if (newDate) {
      setEndDate(newDate);
    }
  }, []);

  const handleSave = useCallback(async () => {
    // Reset errors
    setTitleError('');
    setDateError('');

    // Validate title
    if (!title.trim()) {
      setTitleError('El título es obligatorio');
      titleRef.current?.focus();
      return;
    }

    // Validate start date
    if (!startDate) {
      alert('⚠️ La fecha de inicio es obligatoria');
      startDateRef.current?.focus();
      return;
    }

    // Validate start time if not all day
    if (!allDay && !startTime) {
      alert('⚠️ La hora de inicio es obligatoria');
      startTimeRef.current?.focus();
      return;
    }

    // Validate end date
    if (!endDate) {
      alert('⚠️ La fecha de fin es obligatoria');
      endDateRef.current?.focus();
      return;
    }

    // Validate end time if not all day
    if (!allDay && !endTime) {
      alert('⚠️ La hora de fin es obligatoria');
      endTimeRef.current?.focus();
      return;
    }

    // Validate end >= start
    const startDateTime = allDay
      ? new Date(`${startDate}T00:00:00`)
      : new Date(`${startDate}T${startTime}`);

    const endDateTime = allDay
      ? new Date(`${endDate}T23:59:59`)
      : new Date(`${endDate}T${endTime}`);

    const timeError = validateEventTimeRange(startDateTime, endDateTime, allDay);
    if (timeError) {
      setDateError(timeError);
      endDateRef.current?.focus();
      return;
    }

    setIsSaving(true);

    try {
      // Get color: priority to assigned profile, then category
      const categoryColor = CATEGORIES.find(c => c.value === category)?.color || '#9E9E9E';
      const eventColor = assignedProfileIds.length > 0
        ? profiles.find(p => p.id === assignedProfileIds[0])?.avatarColor || categoryColor
        : categoryColor;

      const eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        allDay,
        startDate: startDateTime,
        endDate: endDateTime,
        notes: notes.trim() || undefined,
        assignedProfileIds,
        color: eventColor,
        category,
      };

      await onSave(eventData);
      handleClose();
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      setIsSaving(false);
    }
  }, [title, phone, location, allDay, startDate, startTime, endDate, endTime, notes, assignedProfileIds, profiles, onSave]);
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant="bottom-sheet"
      showHandle={true}
      showCloseButton={false}
    >
      <div className="event-form">
        <div className="event-form-header">
          <h2 className="event-form-title">{isEditing ? 'Editar evento' : 'Nuevo evento'}</h2>
        </div>
        <Input
          label="📝 Título *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre del evento o turno"
          error={titleError}
          autoFocus
          ref={titleRef}
        />

        <PhoneInput
          label="📱 Teléfono (opcional)"
          value={phone}
          onChange={setPhone}
        />

        <Input
          label="📍 Ubicación (opcional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Dirección, enlace de Zoom, etc."
        />

        {dateError && (
          <div className="event-form-error">
            <span className="event-form-error-icon">⚠️</span>
            {dateError}
          </div>
        )}

        <Toggle
          label="🌞 Todo el día"
          checked={allDay}
          onChange={setAllDay}
        />

        <div className="event-form-datetime">
          <Input
            label="🚀 Inicio"
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            ref={startDateRef}
          />
          {!allDay && (
            <Input
              label="🕐 Hora inicio"
              type="time"
              value={startTime}
              onChange={handleStartTimeChange}
              min="06:00"
              max="22:00"
              step={SCHEDULE_RULES.STEP_MINUTES * 60}
              ref={startTimeRef}
            />
          )}
        </div>

        <div className="event-form-datetime">
          <Input
            label="🏁 Fin"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            ref={endDateRef}
          />
          {!allDay && (
            <Input
              label="🕐 Hora fin"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              min="06:00"
              max="22:00"
              step={SCHEDULE_RULES.STEP_MINUTES * 60}
              ref={endTimeRef}
            />
          )}
        </div>

        <Textarea
          label="📄 Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Descripción adicional, instrucciones, etc."
          expandable
          rows={4}
        />

        <div className="event-form-section">
          <label className="event-form-label">🏷️ Categoría:</label>
          <div className="event-form-categories-grid">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                className={`event-form-category-circle ${category === cat.value ? 'selected' : ''}`}
                onClick={() => setCategory(cat.value)}
                type="button"
                style={{
                  borderColor: category === cat.value ? cat.color : 'var(--color-divider)',
                  backgroundColor: category === cat.value ? `${cat.color}15` : 'transparent',
                }}
              >
                <span className="event-form-category-circle-icon">{cat.icon}</span>
                <span className="event-form-category-circle-label">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="event-form-section">
          <label className="event-form-label">👥 Asignar a:</label>
          <div className="event-form-profiles">
            {profiles.map(profile => (
              <div
                key={profile.id}
                className="event-form-profile-item"
                onClick={() => toggleProfileAssignment(profile.id)}
              >
                <Avatar
                  name={profile.name}
                  initials={profile.initials}
                  color={profile.avatarColor}
                  size="md"
                  isSelected={assignedProfileIds.includes(profile.id)}
                  showCheck
                />
                <span className="event-form-profile-name">{profile.name}</span>
              </div>
            ))}
          </div>
          <p className="event-form-hint">
            💡 El color del turno será el del primer perfil asignado.
          </p>
        </div>

        <div className="event-form-actions">
          <Button variant="secondary" onClick={handleClose} type="button">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isSaving}
            type="button"
          >
            {isEditing ? 'Guardar cambios' : 'Crear evento'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
