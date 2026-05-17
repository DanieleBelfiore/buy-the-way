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
});
