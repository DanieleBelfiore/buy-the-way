import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
import { createI18n } from 'vue-i18n';

const needRefresh = ref(false);
const offlineReady = ref(false);
const updateServiceWorker = vi.fn(async () => {});

vi.mock('@/pwa/registerSW', () => ({
  useSW: () => ({ needRefresh, offlineReady, updateServiceWorker }),
}));

import UpdatePrompt from '@/components/ui/UpdatePrompt.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: { pwa: { updateAvailable: 'New version available', reload: 'Reload' } },
  },
});

describe('UpdatePrompt', () => {
  beforeEach(() => {
    needRefresh.value = false;
    offlineReady.value = false;
    updateServiceWorker.mockClear();
  });

  it('hidden when needRefresh is false', () => {
    const wrapper = mount(UpdatePrompt, { global: { plugins: [i18n] } });
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false);
  });

  it('shows toast with reload action when needRefresh becomes true', async () => {
    const wrapper = mount(UpdatePrompt, { global: { plugins: [i18n] } });
    needRefresh.value = true;
    await nextTick();
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('New version available');
    expect(wrapper.find('[data-testid="toast-action"]').text()).toBe('Reload');
  });

  it('calls updateServiceWorker(true) when reload button clicked', async () => {
    const wrapper = mount(UpdatePrompt, { global: { plugins: [i18n] } });
    needRefresh.value = true;
    await nextTick();
    await wrapper.find('[data-testid="toast-action"]').trigger('click');
    await flushPromises();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('shows spinner during pending updateServiceWorker call', async () => {
    let resolveSW: () => void = () => {};
    updateServiceWorker.mockImplementationOnce(
      () => new Promise<void>((r) => { resolveSW = r; }),
    );
    const wrapper = mount(UpdatePrompt, { global: { plugins: [i18n] } });
    needRefresh.value = true;
    await nextTick();
    await wrapper.find('[data-testid="toast-action"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="toast-action-spinner"]').exists()).toBe(true);
    resolveSW();
    await flushPromises();
  });
});
