/**
 * Where to send the user after sign-in, for routes that opt in with
 * `returnAfterLogin` (today only the MCP consent screen, /oauth/authorize).
 *
 * localStorage, not the URL: the Google redirect flow and the magic-link
 * email both come back on a fixed URL, so a query param would be lost.
 * Short-lived and single use; only same-origin relative paths are accepted.
 */

const STORAGE_KEY = 'btw:returnTo';
export const RETURN_TO_TTL_MS = 15 * 60 * 1000;

export const isSafeReturnPath = (path: unknown): path is string =>
  typeof path === 'string'
  && path.startsWith('/')
  && !path.startsWith('//')
  && !path.startsWith('/\\')
  && path.length <= 4096;

export const saveReturnTo = (path: string, now = Date.now()): void => {
  if (!isSafeReturnPath(path)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, at: now }));
  } catch {
    // Storage unavailable: sign-in still works, the user lands on /lists.
  }
};

export const consumeReturnTo = (now = Date.now()): string | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof at !== 'number' || now - at > RETURN_TO_TTL_MS) return null;
    return isSafeReturnPath(path) ? path : null;
  } catch {
    return null;
  }
};
