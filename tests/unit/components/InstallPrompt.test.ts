import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import { createI18n } from 'vue-i18n';

const canInstall = ref(false);
const isInstalled = ref(false);
const showIOSHint = ref(false);
const isMobile = ref(true);
const dismissed = ref(false);
const promptInstall = vi.fn(async () => 'accepted' as const);
const dismiss = vi.fn(() => {
  dismissed.value = true;
});

vi.mock('@/pwa/installPrompt', () => ({
  useInstallPrompt: () => ({
    canInstall,
    isInstalled,
    showIOSHint,
    isMobile,
    dismissed,
    promptInstall,
    dismiss,
  }),
}));

import InstallPrompt from '@/components/ui/InstallPrompt.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      pwa: {
        installMessage: 'Install Buy The Way for quick access',
        install: 'Install',
        iosInstallHint: 'Tap Share → Add to Home Screen',
      },
    },
  },
});

const mountPrompt = () =>
  mount(InstallPrompt, { global: { plugins: [i18n] } });

describe('InstallPrompt', () => {
  beforeEach(() => {
    canInstall.value = false;
    isInstalled.value = false;
    showIOSHint.value = false;
    isMobile.value = true;
    dismissed.value = false;
    promptInstall.mockClear();
    promptInstall.mockResolvedValue('accepted');
    dismiss.mockClear();
  });

  it('hidden when nothing is true', () => {
    const wrapper = mountPrompt();
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false);
  });

  it('hidden when isInstalled even if canInstall is true', async () => {
    canInstall.value = true;
    isInstalled.value = true;
    const wrapper = mountPrompt();
    await nextTick();
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false);
  });

  it('hidden when dismissed', async () => {
    canInstall.value = true;
    dismissed.value = true;
    const wrapper = mountPrompt();
    await nextTick();
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false);
  });

  it('shows Chromium prompt with Install action when canInstall is true', async () => {
    canInstall.value = true;
    const wrapper = mountPrompt();
    await nextTick();
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Install Buy The Way for quick access');
    expect(wrapper.find('[data-testid="toast-action"]').text()).toBe('Install');
  });

  it('shows iOS hint without an action button when only showIOSHint is true', async () => {
    showIOSHint.value = true;
    const wrapper = mountPrompt();
    await nextTick();
    expect(wrapper.text()).toContain('Tap Share → Add to Home Screen');
    expect(wrapper.find('[data-testid="toast-action"]').exists()).toBe(false);
  });

  it('Chromium prompt wins over iOS hint when both are true', async () => {
    canInstall.value = true;
    showIOSHint.value = true;
    const wrapper = mountPrompt();
    await nextTick();
    expect(wrapper.find('[data-testid="toast-action"]').text()).toBe('Install');
  });

  it('clicking the action calls promptInstall and then dismiss on accepted', async () => {
    canInstall.value = true;
    promptInstall.mockResolvedValueOnce('accepted');
    const wrapper = mountPrompt();
    await nextTick();
    await wrapper.find('[data-testid="toast-action"]').trigger('click');
    await flushPromises();
    expect(promptInstall).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it('clicking the action also dismisses on a user-dismissed outcome', async () => {
    canInstall.value = true;
    promptInstall.mockResolvedValueOnce('dismissed');
    const wrapper = mountPrompt();
    await nextTick();
    await wrapper.find('[data-testid="toast-action"]').trigger('click');
    await flushPromises();
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it('does NOT dismiss on "unavailable" outcome (lets the prompt re-show if event refires)', async () => {
    canInstall.value = true;
    promptInstall.mockResolvedValueOnce('unavailable');
    const wrapper = mountPrompt();
    await nextTick();
    await wrapper.find('[data-testid="toast-action"]').trigger('click');
    await flushPromises();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('hidden on desktop even when canInstall is true', async () => {
    canInstall.value = true;
    isMobile.value = false;
    const wrapper = mountPrompt();
    await nextTick();
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false);
  });

  it('hidden on desktop even when showIOSHint is true', async () => {
    showIOSHint.value = true;
    isMobile.value = false;
    const wrapper = mountPrompt();
    await nextTick();
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false);
  });
});
