import { useState, useCallback, useEffect } from 'react';
import './MenuView.css';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

interface MealPlan { lunch: string; dinner: string; }
interface WeeklyMenu { [key: string]: MealPlan; }

const STORAGE_KEY = 'dommuss_menu_semanal';
const DEFAULT_MENU: WeeklyMenu = {
  monday: { lunch: '', dinner: '' },
  tuesday: { lunch: '', dinner: '' },
  wednesday: { lunch: '', dinner: '' },
  thursday: { lunch: '', dinner: '' },
  friday: { lunch: '', dinner: '' },
  saturday: { lunch: '', dinner: '' },
  sunday: { lunch: '', dinner: '' },
};

function loadMenu(): WeeklyMenu {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_MENU, ...JSON.parse(stored) };
  } catch (_) {}
  return DEFAULT_MENU;
}

export function MenuView() {
  const [selectedDay, setSelectedDay] = useState<string>('monday');
  const [menu, setMenu] = useState<WeeklyMenu>(loadMenu);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(menu)); } catch (_) {}
  }, [menu]);

  const updateMeal = useCallback((day: string, mealType: 'lunch' | 'dinner', value: string) => {
    setMenu(prev => ({ ...prev, [day]: { ...prev[day], [mealType]: value } }));
  }, []);

  const selectedDayLabel = DAYS_OF_WEEK.find(d => d.key === selectedDay)?.label;

  return (
    <div className="menu-view">
      <div className="menu-header">
        <h2 className="menu-title">Menú Semanal</h2>
      </div>
      <div className="menu-days-container">
        <div className="menu-days-scroll">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.key}
              className={`menu-day-tab ${selectedDay === day.key ? 'active' : ''}`}
              onClick={() => setSelectedDay(day.key)}
            >
              {day.label.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div className="menu-content">
        <div className="menu-day-header">
          <span className="menu-day-icon">📅</span>
          <h3 className="menu-day-title">{selectedDayLabel}</h3>
        </div>
        <div className="menu-meals">
          <div className="menu-meal-card">
            <div className="menu-meal-header">
              <span className="menu-meal-icon">🍽️</span>
              <label className="menu-meal-label">Comida</label>
            </div>
            <textarea
              className="menu-meal-input"
              placeholder="¿Qué vas a comer?"
              value={menu[selectedDay].lunch}
              onChange={(e) => updateMeal(selectedDay, 'lunch', e.target.value)}
              rows={3}
            />
          </div>
          <div className="menu-meal-card">
            <div className="menu-meal-header">
              <span className="menu-meal-icon">🌙</span>
              <label className="menu-meal-label">Cena</label>
            </div>
            <textarea
              className="menu-meal-input"
              placeholder="¿Qué vas a cenar?"
              value={menu[selectedDay].dinner}
              onChange={(e) => updateMeal(selectedDay, 'dinner', e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <div className="menu-tips">
          <span className="menu-tips-icon">💡</span>
          <p className="menu-tips-text">Planifica tus comidas con anticipación para ahorrar tiempo y dinero.</p>
        </div>
      </div>
    </div>
  );
}
