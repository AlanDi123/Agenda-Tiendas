import { useState, useCallback } from 'react';
import './ListsView.css';

interface ListItem {
  id: string;
  text: string;
  checked: boolean;
}

export function ListsView() {
  const [items, setItems] = useState<ListItem[]>([
    { id: '1', text: 'Leche', checked: false },
    { id: '2', text: 'Pan', checked: false },
    { id: '3', text: 'Huevos', checked: true },
    { id: '4', text: 'Frutas', checked: false },
  ]);
  const [newItemText, setNewItemText] = useState('');

  const toggleItem = useCallback((id: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  }, []);

  const addItem = useCallback(() => {
    if (!newItemText.trim()) return;

    const newItem: ListItem = {
      id: Date.now().toString(),
      text: newItemText.trim(),
      checked: false,
    };

    setItems(prev => [...prev, newItem]);
    setNewItemText('');
  }, [newItemText]);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addItem();
    }
  }, [addItem]);

  return (
    <div className="lists-view">
      <div className="lists-header">
        <h2 className="lists-title">Lista de Compras</h2>
        <span className="lists-count">{items.filter(i => !i.checked).length} pendientes</span>
      </div>

      <div className="lists-container">
        {items.length === 0 ? (
          <div className="lists-empty">
            <span className="lists-empty-icon">🛒</span>
            <p>Tu lista está vacía</p>
            <span className="lists-empty-hint">Agrega items para comenzar</span>
          </div>
        ) : (
          <ul className="lists-items">
            {items.map(item => (
              <li
                key={item.id}
                className={`lists-item ${item.checked ? 'checked' : ''}`}
              >
                <button
                  className={`lists-item-checkbox ${item.checked ? 'checked' : ''}`}
                  onClick={() => toggleItem(item.id)}
                  aria-label={item.checked ? 'Marcar como pendiente' : 'Marcar como completado'}
                >
                  {item.checked && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className={`lists-item-text ${item.checked ? 'checked' : ''}`}>
                  {item.text}
                </span>
                <button
                  className="lists-item-delete"
                  onClick={() => deleteItem(item.id)}
                  aria-label="Eliminar item"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lists-add-container">
        <input
          type="text"
          className="lists-add-input"
          placeholder="Añadir nuevo ítem..."
          value={newItemText}
          onChange={e => setNewItemText(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button
          className="lists-add-button"
          onClick={addItem}
          disabled={!newItemText.trim()}
          aria-label="Añadir item"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
