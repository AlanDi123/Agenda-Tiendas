/**
 * Valida y formatea un número de teléfono argentino
 * Formatos aceptados:
 * - 1112345678
 * - 1512345678 (se convierte a 11)
 * - 0111512345678
 * - +5491112345678
 * - 11 1234-5678
 * 
 * Formato de salida: 11 1234-5678
 */

export function formatPhoneArgentino(value: string): string {
  // Eliminar todos los caracteres no numéricos
  const digits = value.replace(/\D/g, '');
  
  // Manejar diferentes prefijos
  let normalized = digits;
  
  // Si comienza con +549, eliminarlo
  if (normalized.startsWith('549')) {
    normalized = normalized.slice(3);
  }
  
  // Si comienza con 011, convertir a 11
  if (normalized.startsWith('011')) {
    normalized = normalized.slice(3);
  }
  
  // Si comienza con 15, convertir a 11
  if (normalized.startsWith('15')) {
    normalized = '11' + normalized.slice(2);
  }
  
  // Si tiene 10 dígitos y comienza con 11, está bien
  if (normalized.length === 10 && normalized.startsWith('11')) {
    // Formato: 11 1234-5678
    return `${normalized.slice(0, 2)} ${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  }
  
  // Si tiene 8 dígitos, agregar 11 al principio
  if (normalized.length === 8) {
    normalized = '11' + normalized;
    return `${normalized.slice(0, 2)} ${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  }
  
  // Si está en proceso de escritura, mostrar progreso
  if (normalized.length <= 2) {
    return normalized;
  } else if (normalized.length <= 6) {
    return `${normalized.slice(0, 2)} ${normalized.slice(2)}`;
  } else if (normalized.length <= 10) {
    return `${normalized.slice(0, 2)} ${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  }
  
  // Por defecto, retornar sin formato
  return value;
}

/**
 * Valida que el teléfono tenga el formato correcto
 */
export function isValidPhoneArgentino(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  
  // Debe tener 10 dígitos (11 + 8 dígitos)
  if (digits.length !== 10) {
    return false;
  }
  
  // Debe comenzar con 11
  if (!digits.startsWith('11')) {
    return false;
  }
  
  return true;
}

/**
 * Obtiene solo los dígitos del teléfono
 */
export function getPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}
