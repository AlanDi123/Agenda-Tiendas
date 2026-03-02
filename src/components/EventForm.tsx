import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import type { Event, Profile, EventCategory } from '../types';
import { Modal } from './Modal';
import { Input, Textarea, Toggle } from './Input';
import { PhoneInput } from './PhoneInput';
import { Button } from './Button';
import { Avatar } from './Avatar';
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
  { value: 'salud', label: 'Salud', icon: '🏥', color: '#E57373' },
  { value: 'deporte', label: 'Deporte', icon: '⚽', color: '#81C784' },
  { value: 'comida', label: 'Comida', icon: '🍴', color: '#FFB74D' },
  { value: 'cumple', label: 'Cumple', icon: '🎂', color: '#BA68C8' },
  { value: 'colegio', label: 'Colegio', icon: '📚', color: '#64B5F6' },
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
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(formatDateForInput(initialDate || now));
  const [startTime, setStartTime] = useState(formatTimeForInput(initialDate || now));
  const [endDate, setEndDate] = useState(formatDateForInput(initialDate || now));
  const [endTime, setEndTime] = useState(formatTimeForInput(oneHourLater));
  const [notes, setNotes] = useState('');
  const [assignedProfileIds, setAssignedProfileIds] = useState<string[]>([]);
  const [category, setCategory] = useState<EventCategory>('otro');

  const [titleError, setTitleError] = useState('');
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
      setAllDay(event.allDay);
      setStartDate(formatDateForInput(start));
      setStartTime(formatTimeForInput(start));
      setEndDate(formatDateForInput(end));
      setEndTime(formatTimeForInput(end));
      setNotes(event.notes || '');
      setAssignedProfileIds(event.assignedProfileIds);
      setCategory(event.category || 'otro');
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
    setAllDay(false);
    setStartDate(formatDateForInput(initialDate || now));
    setStartTime(formatTimeForInput(initialDate || now));
    setEndDate(formatDateForInput(initialDate || now));
    setEndTime(formatTimeForInput(oneHourLater));
    setNotes('');
    setAssignedProfileIds([]);
    setCategory('otro');
    setTitleError('');
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
    // Validar título
    if (!title.trim()) {
      setTitleError('El título es obligatorio');
      titleRef.current?.focus();
      return;
    }

    // Validar fecha de inicio
    if (!startDate) {
      alert('⚠️ La fecha de inicio es obligatoria');
      startDateRef.current?.focus();
      return;
    }

    // Validar hora de inicio si no es todo el día
    if (!allDay && !startTime) {
      alert('⚠️ La hora de inicio es obligatoria');
      startTimeRef.current?.focus();
      return;
    }

    // Validar fecha de fin
    if (!endDate) {
      alert('⚠️ La fecha de fin es obligatoria');
      endDateRef.current?.focus();
      return;
    }

    // Validar hora de fin si no es todo el día
    if (!allDay && !endTime) {
      alert('⚠️ La hora de fin es obligatoria');
      endTimeRef.current?.focus();
      return;
    }

    setTitleError('');
    setIsSaving(true);

    try {
      const startDateTime = allDay
        ? new Date(`${startDate}T00:00:00`)
        : new Date(`${startDate}T${startTime}`);

      const endDateTime = allDay
        ? new Date(`${endDate}T23:59:59`)
        : new Date(`${endDate}T${endTime}`);

      // Obtener color: prioridad al perfil asignado, luego a la categoría
      const categoryColor = CATEGORIES.find(c => c.value === category)?.color || '#9E9E9E';
      const eventColor = assignedProfileIds.length > 0
        ? profiles.find(p => p.id === assignedProfileIds[0])?.avatarColor || categoryColor
        : categoryColor;

      const eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        phone: phone.trim() || undefined,
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
  }, [title, phone, allDay, startDate, startTime, endDate, endTime, location, notes, assignedProfileIds, profiles, onSave]);
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Editar evento' : 'Nuevo evento'}
      showCloseButton={true}
    >
      <div className="event-form">
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
          <div className="event-form-categories">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                className={`event-form-category ${category === cat.value ? 'selected' : ''}`}
                onClick={() => setCategory(cat.value)}
                type="button"
                style={{
                  borderColor: category === cat.value ? cat.color : 'var(--color-divider)',
                  backgroundColor: category === cat.value ? `${cat.color}20` : 'transparent',
                }}
              >
                <span className="event-form-category-icon">{cat.icon}</span>
                <span className="event-form-category-label">{cat.label}</span>
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
