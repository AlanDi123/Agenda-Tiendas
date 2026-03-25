/**
 * Registro local de familias creadas por cuenta (userId del backend).
 * La segunda familia requiere suscripción activa (mensual/anual/vitalicio).
 */
const STORAGE_KEY = 'dommuss_created_environment_ids_by_account';

export function getCreatedEnvironmentIdsForUser(userId: string): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    const list = map[userId];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function registerCreatedEnvironment(userId: string, environmentId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    const list = Array.isArray(map[userId]) ? map[userId] : [];
    if (!list.includes(environmentId)) {
      map[userId] = [...list, environmentId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    /* ignore quota / private mode */
  }
}
