/**
 * Utility for persisting component state in sessionStorage.
 * Used for admin pages to survive page refresh.
 * Guarded for SSR — all operations are no-ops on the server.
 */

const PREFIX = 'ui_state:';

function isBrowser(): boolean {
  return typeof sessionStorage !== 'undefined';
}

export function saveState(key: string, value: Record<string, any>): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function loadState<T extends Record<string, any>>(key: string): Partial<T> {
  if (!isBrowser()) return {};
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${key}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function clearState(key: string): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(`${PREFIX}${key}`);
}
