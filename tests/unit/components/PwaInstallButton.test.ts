import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import { createI18n } from 'vue-i18n';

const showInstallButton = ref(false);
const canInstall = ref(false);
const showIOSHint = ref(false);
const promptInstall = vi.fn(async () => 'accepted' as const);

vi.mock('@/pwa/installPrompt', () => ({
  useInstallPrompt: () => ({
    showInstallButton,
    canInstall,
    showIOSHint,
    promptInstall,
  }),
}));

import PwaInstallButton from '@/components/ui/PwaInstallButton.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      pwa: {
        installButton: 'Install app',
        iosInstallHint: 'Tap Share, then Add to Home Screen',
      },
    },
  },
});

describe('PwaInstallButton', () => {
  beforeEach(() => {
    showInstallButton.value = false;
    canInstall.value = false;
    showIOSHint.value = false;
    promptInstall.mockClear();
    document.body.innerHTML = '';
  });

  it('renders nothing when showInstallButton is false', () => {
    const wrapper = mount(PwaInstallButton, { global: { plugins: [i18n] } });
    expect(wrapper.find('[data-testid="pwa-install-button"]').exists()).toBe(false);
  });

  it('renders an icon install button when showInstallButton is true', async () => {
    showInstallButton.value = true;
    const wrapper = mount(PwaInstallButton, { global: { plugins: [i18n] } });
    await nextTick();
    const btn = wrapper.find('[data-testid="pwa-install-button"]');
    expect(btn.attributes('aria-label')).toBe('Install app');
    expect(btn.classes()).toContain('rounded-full');
  });

  it('calls promptInstall on Chromium when canInstall is true', async () => {
    showInstallButton.value = true;
    canInstall.value = true;
    const wrapper = mount(PwaInstallButton, { global: { plugins: [i18n] } });
    await wrapper.find('[data-testid="pwa-install-button"]').trigger('click');
    await flushPromises();
    expect(promptInstall).toHaveBeenCalledOnce();
  });

  it('shows iOS hint toast when only showIOSHint is true', async () => {
    showInstallButton.value = true;
    showIOSHint.value = true;
    const wrapper = mount(PwaInstallButton, {
      global: { plugins: [i18n] },
      attachTo: document.body,
    });
    await wrapper.find('[data-testid="pwa-install-button"]').trigger('click');
    await nextTick();
    expect(promptInstall).not.toHaveBeenCalled();
    expect(document.body.querySelector('[data-testid="toast"]')).not.toBeNull();
  });
});
