import { describe, it, expect, vi } from 'vitest';
import source from '../../../public/sw-retire.js?raw';

// Runs the retiring worker against a fake ServiceWorkerGlobalScope: on
// activate it must drop its caches, unregister and reload every open window,
// so the next navigation reaches the server and follows the 301.
describe('sw-retire.js', () => {
  it('takes over at once, then clears caches, unregisters and reloads clients', async () => {
    const listeners: Record<string, (e: { waitUntil: (p: Promise<unknown>) => void }) => void> = {};
    const navigate = vi.fn().mockResolvedValue(undefined);
    let pending: Promise<unknown> = Promise.resolve();
    const scope = {
      addEventListener: (type: string, fn: (typeof listeners)[string]) => {
        listeners[type] = fn;
      },
      skipWaiting: vi.fn().mockResolvedValue(undefined),
      registration: { unregister: vi.fn().mockResolvedValue(true) },
      clients: {
        matchAll: vi.fn().mockResolvedValue([{ url: 'https://old.example/lists', navigate }]),
      },
    };
    const caches = {
      keys: vi.fn().mockResolvedValue(['workbox-precache', 'google-fonts']),
      delete: vi.fn().mockResolvedValue(true),
    };

    new Function('self', 'caches', source)(scope, caches);

    listeners['install']!({ waitUntil: (p) => { pending = p; } });
    await pending;
    expect(scope.skipWaiting).toHaveBeenCalled();

    listeners['activate']!({ waitUntil: (p) => { pending = p; } });
    await pending;
    expect(caches.delete).toHaveBeenCalledWith('workbox-precache');
    expect(caches.delete).toHaveBeenCalledWith('google-fonts');
    expect(scope.registration.unregister).toHaveBeenCalled();
    expect(scope.clients.matchAll).toHaveBeenCalledWith({ type: 'window' });
    expect(navigate).toHaveBeenCalledWith('https://old.example/lists');
  });
});
