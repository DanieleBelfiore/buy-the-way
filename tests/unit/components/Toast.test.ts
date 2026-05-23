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

    it('renders spinner instead of action icon when actionLoading is true', async () => {
      const wrapper = mount(Toast, {
        props: {
          open: true,
          message: 'Update',
          actionLabel: 'Reload',
          actionLoading: true,
        },
      });
      expect(wrapper.find('[data-testid="toast-action-spinner"]').exists()).toBe(true);
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
  });
});
