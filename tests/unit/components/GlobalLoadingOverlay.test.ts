import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createI18n } from 'vue-i18n';

// Drive `ready` directly so we can flip auth-restore state per test.
const readyRef = ref(false);
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ ready: readyRef, user: ref(null) }),
}));

import GlobalLoadingOverlay from '@/components/ui/GlobalLoadingOverlay.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { common: { loading: 'Loading…' } } },
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div/>' } },
    { path: '/other', name: 'other', component: { template: '<div/>' } },
  ],
});

const mountOverlay = (navDelayMs = 300): VueWrapper =>
  mount(GlobalLoadingOverlay, {
    props: { navDelayMs },
    global: { plugins: [i18n, router] },
  });

const VEIL = '[data-testid="global-loader"]';

describe('GlobalLoadingOverlay', () => {
  let wrapper: VueWrapper | null = null;
  // Guards that block navigation in a test must be torn down even if an
  // assertion throws first, or later `router.push` calls hang forever.
  let removeGuards: Array<() => void> = [];

  beforeEach(async () => {
    readyRef.value = false;
    removeGuards = [];
    await router.push('/');
    await router.isReady();
  });

  afterEach(() => {
    removeGuards.forEach((remove) => remove());
    removeGuards = [];
    wrapper?.unmount();
    wrapper = null;
  });

  it('shows the veil while auth is not ready', async () => {
    readyRef.value = false;
    wrapper = mountOverlay();
    await flushPromises();
    expect(wrapper.find(VEIL).exists()).toBe(true);
  });

  it('hides the veil once auth is ready', async () => {
    readyRef.value = true;
    wrapper = mountOverlay();
    await flushPromises();
    expect(wrapper.find(VEIL).exists()).toBe(false);
  });

  it('exposes an accessible loading status', async () => {
    readyRef.value = false;
    wrapper = mountOverlay();
    await flushPromises();
    const veil = wrapper.get(VEIL);
    expect(veil.attributes('role')).toBe('status');
    expect(veil.attributes('aria-label')).toBe('Loading…');
  });

  it('shows the veil for a navigation that blocks past the spinner delay', async () => {
    // navDelayMs: 0 -> the delay timer fires on the next macrotask, so a
    // single flushPromises is enough to observe the slow-nav veil without the
    // flakiness of mixing fake timers with vue-router's async guard chain.
    readyRef.value = true;
    wrapper = mountOverlay(0);
    await flushPromises();
    expect(wrapper.find(VEIL).exists()).toBe(false);

    // Park the navigation in a guard so the delay timer elapses while the
    // route is still in flight (the real-world slow-network case).
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    removeGuards.push(router.beforeEach(async () => {
      await gate;
    }));

    const nav = router.push('/other');
    // A short real wait guarantees the guards have run AND the 0ms delay timer
    // has fired, independent of setImmediate-vs-setTimeout ordering.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await flushPromises(); // Vue re-render
    expect(wrapper.find(VEIL).exists()).toBe(true);

    release();
    await nav;
    await flushPromises();
    expect(wrapper.find(VEIL).exists()).toBe(false);
  });

  it('does not flash the veil for a fast navigation', async () => {
    readyRef.value = true;
    wrapper = mountOverlay(0);
    await flushPromises();

    // Fast nav resolves via microtasks before the 0ms delay timer (a macrotask)
    // can fire, so the component's afterEach clears it and the veil never shows.
    await router.push('/other');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await flushPromises();
    expect(wrapper.find(VEIL).exists()).toBe(false);
  });
});
