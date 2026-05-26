import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import OfflineBanner from '@/components/ui/OfflineBanner.vue';
import { createI18n } from 'vue-i18n';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: { offline: { banner: 'Offline - changes will sync when back online' } },
  },
});

const setOnline = (online: boolean): void => {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
};

describe('OfflineBanner', () => {
  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
  });

  it('hidden when navigator.onLine is true', () => {
    const wrapper = mount(OfflineBanner, { global: { plugins: [i18n] } });
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(false);
  });

  it('shows when offline event fires', async () => {
    const wrapper = mount(OfflineBanner, { global: { plugins: [i18n] } });
    setOnline(false);
    await nextTick();
    const banner = wrapper.find('[data-testid="offline-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('Offline');
  });

  it('hides when online event fires after being offline', async () => {
    const wrapper = mount(OfflineBanner, { global: { plugins: [i18n] } });
    setOnline(false);
    await nextTick();
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(true);
    setOnline(true);
    await nextTick();
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(false);
  });

  it('uses role=status with aria-live=polite for screen readers', async () => {
    const wrapper = mount(OfflineBanner, { global: { plugins: [i18n] } });
    setOnline(false);
    await nextTick();
    const banner = wrapper.find('[data-testid="offline-banner"]');
    expect(banner.attributes('role')).toBe('status');
    expect(banner.attributes('aria-live')).toBe('polite');
  });

  it('renders WifiOff icon to the left of the message', async () => {
    const wrapper = mount(OfflineBanner, { global: { plugins: [i18n] } });
    setOnline(false);
    await nextTick();
    const icon = wrapper.find('[data-testid="offline-icon"]');
    expect(icon.exists()).toBe(true);
    expect(icon.attributes('aria-hidden')).toBe('true');
  });

  it('detaches listeners on unmount (no banner mutation after teardown)', async () => {
    const wrapper = mount(OfflineBanner, { global: { plugins: [i18n] } });
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('starts in offline state if navigator.onLine was already false at mount', () => {
    setOnline(false);
    const wrapper = mount(OfflineBanner, { global: { plugins: [i18n] } });
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(true);
  });
});
