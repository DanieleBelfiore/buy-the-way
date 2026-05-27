import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { i18n } from '@/i18n';
import ListFooterActionsMenu from '@/components/list/ListFooterActionsMenu.vue';

const mountMenu = (props: { showFavorites?: boolean } = {}) =>
  mount(ListFooterActionsMenu, {
    props: {
      showFavorites: props.showFavorites ?? true,
    },
    global: { plugins: [createPinia(), i18n] },
    attachTo: document.body,
  });

describe('ListFooterActionsMenu', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
  });

  it('hides action buttons until the + toggle is opened', () => {
    wrapper = mountMenu();
    expect(wrapper.find('[data-testid="footer-actions-toggle"]').attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('[data-testid="open-voice-add"]').exists()).toBe(false);
  });

  it('reveals stacked actions above the + button when opened', async () => {
    wrapper = mountMenu({ showFavorites: true });
    await wrapper.find('[data-testid="footer-actions-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="footer-actions-toggle"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('[data-testid="open-voice-add"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="open-bulk-paste"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="open-favorites"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="empty-list-button"]').exists()).toBe(false);
  });

  it('emits open-voice and closes after picking an action', async () => {
    wrapper = mountMenu({ showFavorites: false });
    await wrapper.find('[data-testid="footer-actions-toggle"]').trigger('click');
    await wrapper.find('[data-testid="open-voice-add"]').trigger('click');
    expect(wrapper.emitted('open-voice')).toHaveLength(1);
    expect(wrapper.find('[data-testid="footer-actions-toggle"]').attributes('aria-expanded')).toBe('false');
  });
});
