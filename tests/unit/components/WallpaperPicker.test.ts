import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import WallpaperPicker from '@/components/list/WallpaperPicker.vue';
import { WALLPAPERS } from '@/domain/wallpapers';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      listSettings: {
        wallpaperOptionAria: 'Select wallpaper {name}',
      },
    },
  },
});

const mount_ = (props: { current?: string; busy?: boolean } = {}) =>
  mount(WallpaperPicker, {
    props,
    global: { plugins: [i18n] },
  });

describe('WallpaperPicker', () => {
  it('renders one option per wallpaper', () => {
    const wrapper = mount_();
    for (const w of WALLPAPERS) {
      expect(wrapper.find(`[data-testid="wallpaper-option-${w}"]`).exists()).toBe(true);
    }
    expect(wrapper.findAll('[data-testid^="wallpaper-option-"]')).toHaveLength(WALLPAPERS.length);
  });

  it('emits select with the chosen wallpaper', async () => {
    const wrapper = mount_({ current: '01.jpg' });
    await wrapper.find('[data-testid="wallpaper-option-05.jpg"]').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['05.jpg']);
  });

  it('does not emit select when clicking the current wallpaper', async () => {
    const wrapper = mount_({ current: '03.jpg' });
    await wrapper.find('[data-testid="wallpaper-option-03.jpg"]').trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('does not emit select when busy', async () => {
    const wrapper = mount_({ current: '01.jpg', busy: true });
    await wrapper.find('[data-testid="wallpaper-option-05.jpg"]').trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('marks the current option as pressed', () => {
    const wrapper = mount_({ current: '07.jpg' });
    const btn = wrapper.find('[data-testid="wallpaper-option-07.jpg"]');
    expect(btn.attributes('aria-pressed')).toBe('true');
    const other = wrapper.find('[data-testid="wallpaper-option-08.jpg"]');
    expect(other.attributes('aria-pressed')).toBe('false');
  });

  it('uses lazy loading on thumbnails', () => {
    const wrapper = mount_();
    const imgs = wrapper.findAll('img');
    expect(imgs.length).toBe(WALLPAPERS.length);
    for (const img of imgs) {
      expect(img.attributes('loading')).toBe('lazy');
    }
  });
});
