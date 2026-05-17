import { vi } from 'vitest';

vi.mock('@/services/firebase', () => ({
  auth: {},
  db: {},
  app: {},
}));

const createStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length(): number {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number): string | null {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
  };
};

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createStorage(),
    writable: true,
    configurable: true,
  });
}
if (typeof globalThis.sessionStorage === 'undefined' || typeof globalThis.sessionStorage.clear !== 'function') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: createStorage(),
    writable: true,
    configurable: true,
  });
}
