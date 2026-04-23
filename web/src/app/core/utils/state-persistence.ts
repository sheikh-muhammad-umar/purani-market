/**
 * Utility for persisting component state in sessionStorage.
 * Used for admin pages to survive page refresh.
 */

const PREFIX = 'ui_state:';

export function saveState(key: string, value: Record<string, any>): void {
  try {
    sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function loadState<T extends Record<string, any>>(key: string): Partial<T> {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${key}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function clearState(key: string): void {
  sessionStorage.removeItem(`${PREFIX}${key}`);
}
