import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveNote, getAllNotes, deleteNote } from '../services/database';
import { generateId } from '../utils/helpers';
import { Button } from './Button';
import { Modal } from './Modal';
import type { SharedNote } from '../types';

type NoteWithEnv = SharedNote & { environmentId: string };

const NOTE_COLORS = ['#FFF9C4','#C8E6C9','#BBDEFB','#FFCCBC','#E1BEE7','#F8BBD9'];

export function NotesView() {
  const { environment, activeProfile } = useAuth();
  const [notes, setNotes] = useState<NoteWithEnv[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteWithEnv | null>(null);
  const [form, setForm] = useState({ title: '', content: '', color: NOTE_COLORS[0] });

  const load = useCallback(async () => {
    if (!environment) return;
    const data = await getAllNotes(environment.id);
    setNotes(data.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
  }, [environment]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.title.trim() || !environment || !activeProfile) return;
    const note: NoteWithEnv = {
      id: editingNote?.id || generateId(),
      environmentId: environment.id,
      title: form.title.trim(),
      content: form.content.trim(),
      color: form.color,
      pinned: editingNote?.pinned || false,
      createdBy: editingNote?.createdBy || activeProfile.id,
      createdByName: editingNote?.createdByName || activeProfile.name,
      createdAt: editingNote?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    await saveNote(note);
    await load();
    setShowForm(false);
    setEditingNote(null);
    setForm({ title: '', content: '', color: NOTE_COLORS[0] });
  };

  const togglePin = async (note: NoteWithEnv) => {
    await saveNote({ ...note, pinned: !note.pinned, updatedAt: new Date() });
    await load();
  };

  const handleEdit = (n: NoteWithEnv) => {
    setEditingNote(n);
    setForm({ title: n.title, content: n.content, color: n.color });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    await load();
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingNote(null);
    setForm({ title: '', content: '', color: NOTE_COLORS[0] });
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Notas</h2>
        <Button variant="primary" onClick={() => setShowForm(true)} size="sm">+ Nueva nota</Button>
      </div>

      {notes.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <p>No hay notas guardadas</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {notes.map(note => (
            <div key={note.id} style={{
              background: note.color, borderRadius: 12, padding: '14px 14px 10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'relative',
              border: note.pinned ? '2px solid #1E88E5' : '2px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 14, color: '#333', flex: 1, wordBreak: 'break-word' }}>{note.title}</strong>
                <button onClick={() => togglePin(note)} title="Fijar"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0, marginLeft: 4 }}>
                  {note.pinned ? '📌' : '📍'}
                </button>
              </div>
              {note.content && (
                <p style={{ fontSize: 13, color: '#555', margin: '0 0 10px', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {note.content.length > 120 ? note.content.slice(0, 120) + '…' : note.content}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#888' }}>Por {note.createdByName}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleEdit(note)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✏️</button>
                  <button onClick={() => handleDelete(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={handleClose} title={editingNote ? 'Editar nota' : 'Nueva nota'} showCloseButton>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="input-label">Título *</label>
            <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título de la nota" />
          </div>
          <div>
            <label className="input-label">Contenido</label>
            <textarea className="input" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              placeholder="Escribe tu nota aquí..." rows={5} style={{ resize: 'vertical' }} />
          </div>
          <div>
            <label className="input-label">Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {NOTE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                    boxShadow: form.color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none' }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" fullWidth onClick={handleClose}>Cancelar</Button>
            <Button variant="primary" fullWidth onClick={handleSave} disabled={!form.title.trim()}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
