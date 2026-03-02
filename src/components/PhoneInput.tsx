import { useState, useCallback } from 'react';
import './PhoneInput.css';

interface PhoneInputProps {
  label?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Códigos de área comunes de Argentina
const AREA_CODES: Record<string, string> = {
  '11': 'Buenos Aires (CABA/GBA)',
  '220': 'Mar del Plata',
  '221': 'La Plata',
  '261': 'Mendoza',
  '264': 'San Juan',
  '280': 'Bariloche',
  '291': 'Bahía Blanca',
  '299': 'Neuquén',
  '341': 'Rosario',
  '351': 'Córdoba',
  '370': 'Formosa',
  '376': 'Posadas',
  '379': 'Corrientes',
  '381': 'Tucumán',
  '383': 'Catamarca',
  '385': 'La Rioja',
  '387': 'Salta',
  '388': 'Jujuy',
};

export function PhoneInput({ label, error, value, onChange, className = '' }: PhoneInputProps) {
  // Estado interno separado para área y número
  const [areaCode, setAreaCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Parsear valor inicial si cambia desde fuera
  useCallback(() => {
    const digits = (value || '').replace(/\D/g, '');
    if (digits.length > 0) {
      if (digits.length > 3 && AREA_CODES[digits.slice(0, 3)]) {
        setAreaCode(digits.slice(0, 3));
        setPhoneNumber(digits.slice(3));
      } else {
        setAreaCode(digits.slice(0, 2));
        setPhoneNumber(digits.slice(2));
      }
    } else {
      setAreaCode('');
      setPhoneNumber('');
    }
  }, [value]);

  const handleAreaCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAreaCode = e.target.value.replace(/\D/g, '').slice(0, 4);
    setAreaCode(newAreaCode);
    onChange(newAreaCode + phoneNumber);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    const newPhone = digits.slice(0, 8);
    setPhoneNumber(newPhone);
    onChange(areaCode + newPhone);
  };

  const isValid = (areaCode + phoneNumber).length >= 8;
  const areaHint = areaCode ? AREA_CODES[areaCode] : null;

  return (
    <div className={`phone-input-wrapper ${error || (value && !isValid) ? 'input-error' : ''} ${className}`}>
      {label && (
        <label className="input-label">
          {label}
        </label>
      )}
      
      <div className="phone-input-group">
        <div className="phone-input-country">
          <span className="phone-input-prefix">+54</span>
        </div>
        
        <div className="phone-input-area">
          <input
            type="text"
            className="phone-input-field"
            placeholder="Cód."
            value={areaCode}
            onChange={handleAreaCodeChange}
            inputMode="numeric"
            maxLength={4}
          />
          {areaHint && (
            <span className="phone-input-area-hint">{areaHint}</span>
          )}
        </div>
        
        <div className="phone-input-number">
          <input
            type="text"
            className="phone-input-field phone-input-number-field"
            placeholder="Número"
            value={formatPhoneNumber(phoneNumber)}
            onChange={handlePhoneNumberChange}
            inputMode="numeric"
            maxLength={9}
          />
        </div>
      </div>
      
      {error && <span className="input-error-message">{error}</span>}
      {value && !isValid && !error && (
        <span className="input-error-message">Ingresa al menos 8 dígitos</span>
      )}
    </div>
  );
}

// Utilidad para formatear número
function formatPhoneNumber(phone: string): string {
  if (phone.length <= 4) {
    return phone;
  }
  return `${phone.slice(0, 4)}-${phone.slice(4)}`;
}
