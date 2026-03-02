import { useState } from 'react';
import type { Profile } from '../types';
import { Modal } from './Modal';
import { Avatar } from './Avatar';
import { Button } from './Button';
import './ProfileSelector.css';

interface ProfileSelectorProps {
  isOpen: boolean;
  profiles: Profile[];
  activeProfileId?: string;
  onSelectProfile: (profileId: string) => void;
  onAddProfile: () => void;
  onClose: () => void;
}

export function ProfileSelector({
  isOpen,
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  onClose,
}: ProfileSelectorProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambiar perfil"
      showCloseButton={true}
    >
      <div className="profile-selector">
        <div className="profile-selector-list">
          {profiles.map(profile => (
            <button
              key={profile.id}
              className={`profile-selector-item ${profile.id === activeProfileId ? 'active' : ''}`}
              onClick={() => {
                onSelectProfile(profile.id);
                onClose();
              }}
            >
              <Avatar
                name={profile.name}
                initials={profile.initials}
                color={profile.avatarColor}
                size="lg"
              />
              <div className="profile-selector-info">
                <span className="profile-selector-name">{profile.name}</span>
                <span className="profile-selector-permission">
                  {profile.permissions === 'admin' ? 'Administrador' : 'Solo lectura'}
                </span>
              </div>
              {profile.id === activeProfileId && (
                <span className="profile-selector-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
        
        <Button
          variant="secondary"
          fullWidth
          onClick={onAddProfile}
          leftIcon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          Agregar perfil
        </Button>
      </div>
    </Modal>
  );
}

interface AddProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, permissions: 'admin' | 'readonly') => void;
}

export function AddProfileModal({ isOpen, onClose, onAdd }: AddProfileModalProps) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<'admin' | 'readonly'>('readonly');
  const [error, setError] = useState('');
  
  const handleSubmit = () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    
    setError('');
    onAdd(name.trim(), permissions);
    setName('');
    setPermissions('readonly');
    onClose();
  };
  
  const handleClose = () => {
    setName('');
    setPermissions('readonly');
    setError('');
    onClose();
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nuevo perfil"
      showCloseButton={true}
    >
      <div className="add-profile-form">
        <div className="add-profile-preview">
          <Avatar
            name={name || 'Nombre'}
            initials={name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
            color="#1976d2"
            size="xl"
          />
        </div>
        
        <div className="add-profile-input">
          <label className="input-label">Nombre</label>
          <input
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ingresa el nombre"
            autoFocus
          />
          {error && <span className="input-error-message">{error}</span>}
        </div>
        
        <div className="add-profile-permissions">
          <label className="input-label">Permisos</label>
          <div className="add-profile-permission-options">
            <button
              className={`permission-option ${permissions === 'readonly' ? 'selected' : ''}`}
              onClick={() => setPermissions('readonly')}
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span>Solo lectura</span>
            </button>
            <button
              className={`permission-option ${permissions === 'admin' ? 'selected' : ''}`}
              onClick={() => setPermissions('admin')}
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Administrador</span>
            </button>
          </div>
        </div>
        
        <div className="add-profile-actions">
          <Button variant="secondary" onClick={handleClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} type="button">
            Crear perfil
          </Button>
        </div>
      </div>
    </Modal>
  );
}
