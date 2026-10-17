import { describe, it, expect, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import { useSafeBack } from '@/composables/useSafeBack';

// Real web history on purpose: the bug lived in how browser history entries
// relate to each other, which a mocked router cannot reproduce.
const Stub = defineComponent({ render: () => h('div') });

const makeRouter = (): Router =>
  createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/lists', name: 'lists', component: Stub },
      { path: '/lists/:id', name: 'list-detail', component: Stub },
      { path: '/lists/:id/settings', name: 'list-settings', component: Stub },
    ],
  });

const mountSafeBack = (router: Router) => {
  const capture: { safeBack?: ReturnType<typeof useSafeBack> } = {};
  mount(
    defineComponent({
      setup() {
        capture.safeBack = useSafeBack();
        return () => h('div');
      },
    }),
    { global: { plugins: [router] } },
  );
  return capture.safeBack!;
};

/** history.back() is async in jsdom: let popstate (if any) land. */
const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flushPromises();
};

describe('useSafeBack', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('pops the history entry after an in-app navigation', async () => {
    const router = makeRouter();
    await router.push('/lists');
    await router.isReady();
    await router.push('/lists/abc');
    const safeBack = mountSafeBack(router);
    const lengthBefore = window.history.length;

    safeBack({ name: 'lists' });
    await settle();

    expect(router.currentRoute.value.name).toBe('lists');
    expect(window.history.length).toBe(lengthBefore);
  });

  // Regression: entering a list by deep link or by the default-list boot
  // redirect, then visiting another view and coming back, left the back arrow
  // calling history.back() on the first entry of the tab. Nothing happened
  // until a refresh reset the old global navigation counter.
  it('falls back when the current entry is the first one in the app', async () => {
    const router = makeRouter();
    await router.push('/lists/abc');
    await router.isReady();
    const safeBack = mountSafeBack(router);

    await router.push('/lists/abc/settings');
    safeBack({ name: 'list-detail', params: { id: 'abc' } });
    await settle();
    expect(router.currentRoute.value.name).toBe('list-detail');

    safeBack({ name: 'lists' });
    await settle();
    expect(router.currentRoute.value.name).toBe('lists');
  });
});
