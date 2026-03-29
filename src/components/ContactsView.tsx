import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveContact, getAllContacts, deleteContact } from '../services/database';
import { generateId, generateAvatarColor, getInitials } from '../utils/helpers';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Modal } from './Modal';
import type { SharedContact } from '../types';
import { useVirtualizer } from '@tanstack/react-virtual';

type ContactWithEnv = SharedContact & { environmentId: string };

export function ContactsView() {
  const { environment, activeProfile } = useAuth();
  const [contacts, setContacts] = useState<ContactWithEnv[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithEnv | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const parentRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!environment) return;
    const data = await getAllContacts(environment.id);
    setContacts(data);
  }, [environment]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim() || !environment || !activeProfile) return;
    const contact: ContactWithEnv = {
      id: editingContact?.id || generateId(),
      environmentId: environment.id,
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
      avatarColor: editingContact?.avatarColor || generateAvatarColor(),
      createdBy: editingContact?.createdBy || activeProfile.name,
      createdAt: editingContact?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    await saveContact(contact);
    await load();
    setShowForm(false);
    setEditingContact(null);
    setForm({ name: '', phone: '', email: '', notes: '' });
  };

  const handleEdit = (c: ContactWithEnv) => {
    setEditingContact(c);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', notes: c.notes || '' });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteContact(id);
    await load();
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingContact(null);
    setForm({ name: '', phone: '', email: '', notes: '' });
  };

  const filtered = useMemo(() => {
    return contacts.filter(
      c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    );
  }, [contacts, search]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 6,
  });

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Contactos</h2>
        <Button variant="primary" onClick={() => setShowForm(true)} size="sm">+ Agregar</Button>
      </div>

      <input
        type="text"
        className="input"
        placeholder="Buscar contactos..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <p>No hay contactos guardados</p>
        </div>
      ) : (
        <div
          ref={parentRef}
          style={{
            height: '70vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const c = filtered[virtualRow.index];
              return (
                <div
                  key={c.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      background: 'var(--color-surface)',
                      borderRadius: 12,
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <Avatar
                      name={c.name}
                      initials={getInitials(c.name)}
                      color={c.avatarColor}
                      size="md"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                      {c.phone && (
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>📱 {c.phone}</div>
                      )}
                      {c.email && (
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>✉️ {c.email}</div>
                      )}
                      {c.notes && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{c.notes}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleEdit(c)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal isOpen={showForm} onClose={handleClose} title={editingContact ? 'Editar contacto' : 'Nuevo contacto'} showCloseButton>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(['name', 'phone', 'email', 'notes'] as const).map(field => (
            <div key={field}>
              <label className="input-label" style={{ textTransform: 'capitalize' }}>
                {field === 'name' ? 'Nombre *' : field === 'phone' ? 'Teléfono' : field === 'email' ? 'Email' : 'Notas'}
              </label>
              <input
                type={field === 'email' ? 'email' : 'text'}
                className="input"
                value={form[field]}
                onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                placeholder={field === 'name' ? 'Nombre completo' : field === 'phone' ? '+54 11 1234-5678' : field === 'email' ? 'correo@ejemplo.com' : 'Notas adicionales...'}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" fullWidth onClick={handleClose}>Cancelar</Button>
            <Button variant="primary" fullWidth onClick={handleSave} disabled={!form.name.trim()}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
