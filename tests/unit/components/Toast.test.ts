import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Toast from '@/components/ui/Toast.vue';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when open is false', () => {
    const wrapper = mount(Toast, { props: { open: false, message: 'Hi' } });
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false);
  });

  it('renders message when open is true', async () => {
    const wrapper = mount(Toast, { props: { open: true, message: 'All done!' } });
    expect(wrapper.find('[data-testid="toast"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('All done!');
  });

  it('emits close after default duration', async () => {
    const wrapper = mount(Toast, { props: { open: true, message: 'Hi' } });
    vi.advanceTimersByTime(2500);
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('respects custom durationMs', async () => {
    const wrapper = mount(Toast, { props: { open: true, message: 'Hi', durationMs: 500 } });
    vi.advanceTimersByTime(400);
    expect(wrapper.emitted('close')).toBeFalsy();
    vi.advanceTimersByTime(200);
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('clears timer when open transitions to false before duration', async () => {
    const wrapper = mount(Toast, { props: { open: true, message: 'Hi' } });
    await wrapper.setProps({ open: false });
    vi.advanceTimersByTime(5000);
    expect(wrapper.emitted('close')).toBeFalsy();
  });

  describe('action button', () => {
    it('renders action button when actionLabel is set', () => {
      const wrapper = mount(Toast, {
        props: { open: true, message: 'Update', actionLabel: 'Reload' },
      });
      const btn = wrapper.find('[data-testid="toast-action"]');
      expect(btn.exists()).toBe(true);
      expect(btn.text()).toBe('Reload');
    });

    it('emits action when button clicked', async () => {
      const wrapper = mount(Toast, {
        props: { open: true, message: 'Update', actionLabel: 'Reload' },
      });
      await wrapper.find('[data-testid="toast-action"]').trigger('click');
      expect(wrapper.emitted('action')).toBeTruthy();
    });

    it('does not auto-dismiss when actionLabel is set', () => {
      const wrapper = mount(Toast, {
        props: { open: true, message: 'Update', actionLabel: 'Reload' },
      });
      vi.advanceTimersByTime(10000);
      expect(wrapper.emitted('close')).toBeFalsy();
      expect(wrapper.find('[data-testid="toast"]').exists()).toBe(true);
    });

    it('no action button when actionLabel absent', () => {
      const wrapper = mount(Toast, { props: { open: true, message: 'Hi' } });
      expect(wrapper.find('[data-testid="toast-action"]').exists()).toBe(false);
    });

    it('adds animate-spin class to the action icon when actionLoading is true', async () => {
      // Import locally so we can pass a real Lucide icon component as actionIcon
      // (without it the icon element doesn't render at all and the spin class
      // has nothing to attach to).
      const { RefreshCw } = await import('@lucide/vue');
      const wrapper = mount(Toast, {
        props: {
          open: true,
          message: 'Update',
          actionLabel: 'Reload',
          actionIcon: RefreshCw,
          actionLoading: true,
        },
      });
      const iconWrapper = wrapper.find('[data-testid="toast-action-icon-wrapper"]');
      expect(iconWrapper.exists()).toBe(true);
      expect(iconWrapper.classes()).toContain('animate-spin');
    });

    it('omits animate-spin class on the action icon when actionLoading is false', async () => {
      const { RefreshCw } = await import('@lucide/vue');
      const wrapper = mount(Toast, {
        props: {
          open: true,
          message: 'Update',
          actionLabel: 'Reload',
          actionIcon: RefreshCw,
          actionLoading: false,
        },
      });
      const iconWrapper = wrapper.find('[data-testid="toast-action-icon-wrapper"]');
      expect(iconWrapper.exists()).toBe(true);
      expect(iconWrapper.classes()).not.toContain('animate-spin');
    });

    it('disables action button while actionLoading is true', async () => {
      const wrapper = mount(Toast, {
        props: {
          open: true,
          message: 'Update',
          actionLabel: 'Reload',
          actionLoading: true,
        },
      });
      const btn = wrapper.find('[data-testid="toast-action"]');
      expect(btn.attributes('disabled')).toBeDefined();
      expect(btn.attributes('aria-busy')).toBe('true');
    });

    it('does not emit action when clicked during actionLoading', async () => {
      const wrapper = mount(Toast, {
        props: {
          open: true,
          message: 'Update',
          actionLabel: 'Reload',
          actionLoading: true,
        },
      });
      await wrapper.find('[data-testid="toast-action"]').trigger('click');
      expect(wrapper.emitted('action')).toBeFalsy();
    });

    it('auto-dismisses when actionLabel set AND autoDismissWithAction=true', async () => {
      const wrapper = mount(Toast, {
        props: {
          open: true,
          message: 'Install',
          actionLabel: 'Install',
          autoDismissWithAction: true,
          durationMs: 500,
        },
      });
      vi.advanceTimersByTime(600);
      expect(wrapper.emitted('close')).toBeTruthy();
    });

    it('still suppresses auto-dismiss when actionLabel set AND autoDismissWithAction=false (default)', async () => {
      const wrapper = mount(Toast, {
        props: {
          open: true,
          message: 'Reload',
          actionLabel: 'Reload',
          durationMs: 500,
        },
      });
      vi.advanceTimersByTime(5000);
      expect(wrapper.emitted('close')).toBeFalsy();
    });
  });
});
