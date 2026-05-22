# Vue 3 + Vitest — Test Hygiene Rules

Patterns required in Vue test files to avoid spurious warnings and flaky tests. Activate this doc by adding `@~/.claude/docs/vue.md` to the project's CLAUDE.md when working on a Vue 3 + Vitest stack.

## Component test rules

1. **Fake timers for debounced components.** Any test mounting a component that uses `useDebouncedRef` (or any debounced composable) must use `vi.useFakeTimers()` in `beforeEach` + `vi.useRealTimers()` in `afterEach`. Without this, debounce timers fire after test teardown → `[Vue warn]: Unhandled error during component update`.

2. **Router initialization before mount.** Before mounting any component that depends on `vue-router`, navigate to the correct route:
   ```ts
   await router.push('/route');
   await router.isReady();
   ```
   Place inside async `beforeEach`. Missing this → `[Vue Router warn]: No match found for location with path ""`.

3. **console spy precision.** Spy on the exact method the production code calls (`console.warn` vs `console.error`). Wrong spy → error-handling test passes silently.

4. **Click events on dropdown/autocomplete options.** Use `@click` on interactive list options, not `@mousedown.prevent`. Vue Test Utils `trigger('click')` does not simulate real browser blur/focus, so `@mousedown.prevent` never fires in tests. If you must keep `@mousedown.prevent` for production UX (preventing input blur), add a parallel `@click` handler that tests can drive.

## Vitest + Node 26 — localStorage polyfill

Node 26 ships an experimental native `localStorage` that requires the `--localstorage-file` flag, otherwise it shadows jsdom's localStorage and `localStorage.clear()` throws `Cannot read properties of undefined`. Sessions/sessionStorage are not affected the same way.

**Fix:** in `tests/setup.ts`, install an in-memory Storage polyfill onto `globalThis.localStorage` and `globalThis.sessionStorage` when missing or broken:

```ts
function installStoragePolyfill(key: 'localStorage' | 'sessionStorage') {
  const store = new Map<string, string>();
  const polyfill: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    key: (i) => Array.from(store.keys())[i] ?? null,
  };
  try {
    if (!globalThis[key] || typeof globalThis[key].clear !== 'function') {
      Object.defineProperty(globalThis, key, { value: polyfill, writable: true, configurable: true });
    }
  } catch {
    Object.defineProperty(globalThis, key, { value: polyfill, writable: true, configurable: true });
  }
}
installStoragePolyfill('localStorage');
installStoragePolyfill('sessionStorage');
```

Don't remove this block when upgrading vitest unless Node's native localStorage is stable.

**Symptom:** new test using `localStorage` fails with `Cannot read properties of undefined (reading 'clear')` across the whole describe block → verify `tests/setup.ts` still defines the polyfill.

## View self-containment (Pinia + Vue Router)

Any view reachable via direct URL (e.g. `/lists/:id`) must subscribe to all required Pinia stores in its own `onMounted`. Never assume a parent view has already mounted and populated shared state.

```ts
let _unsub: (() => void) | null = null;
onMounted(() => {
  if (listsStore.lists.length === 0) {
    _unsub = listsStore.subscribe();
  }
});
onUnmounted(() => { _unsub?.(); });
```

**Symptom:** hard refresh on child route shows placeholder ("...") forever because parent view never mounted to populate the store.
