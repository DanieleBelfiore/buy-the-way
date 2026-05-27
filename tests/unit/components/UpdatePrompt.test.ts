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
    en: {
      pwa: {
        updateRequiredTitle: 'Update required',
        updateRequiredMessage: 'A new version is available. Reload to keep using the app.',
        reload: 'Reload',
      },
    },
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
    expect(wrapper.find('[data-testid="update-required-overlay"]').exists()).toBe(false);
  });

  it('shows blocking dialog when needRefresh becomes true', async () => {
    const wrapper = mount(UpdatePrompt, { global: { plugins: [i18n] } });
    needRefresh.value = true;
    await nextTick();
    expect(wrapper.find('[data-testid="update-required-dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Update required');
    expect(wrapper.text()).toContain('A new version is available');
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false);
  });

  it('has no dismiss control (only reload)', async () => {
    const wrapper = mount(UpdatePrompt, { global: { plugins: [i18n] } });
    needRefresh.value = true;
    await nextTick();
    expect(wrapper.find('[data-testid="update-required-reload"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="confirm-modal-cancel"]').exists()).toBe(false);
  });

  it('calls updateServiceWorker(true) when reload button clicked', async () => {
    const wrapper = mount(UpdatePrompt, { global: { plugins: [i18n] } });
    needRefresh.value = true;
    await nextTick();
    await wrapper.find('[data-testid="update-required-reload"]').trigger('click');
    await flushPromises();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('spins reload icon during pending updateServiceWorker call', async () => {
    let resolveSW: () => void = () => {};
    updateServiceWorker.mockImplementationOnce(
      () => new Promise<void>((r) => { resolveSW = r; }),
    );
    const wrapper = mount(UpdatePrompt, { global: { plugins: [i18n] } });
    needRefresh.value = true;
    await nextTick();
    await wrapper.find('[data-testid="update-required-reload"]').trigger('click');
    await nextTick();
    const icon = wrapper.find('[data-testid="update-required-reload"] svg');
    expect(icon.classes()).toContain('animate-spin');
    resolveSW();
    await flushPromises();
  });
});
