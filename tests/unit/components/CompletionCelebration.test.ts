import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import CompletionCelebration from '@/components/ui/CompletionCelebration.vue';

const originalMatchMedia = window.matchMedia;

const setReducedMotion = (matches: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }) as unknown as typeof window.matchMedia;
};

const mountIt = (props: { triggerKey: number }) =>
  mount(CompletionCelebration, {
    props,
    attachTo: document.body,
  });

describe('CompletionCelebration', () => {
  beforeEach(() => {
    setReducedMotion(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it('renders nothing when triggerKey is 0', () => {
    const wrapper = mountIt({ triggerKey: 0 });
    expect(wrapper.find('[data-testid="celebration-overlay"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows overlay with lottie when triggerKey increments', async () => {
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    expect(wrapper.find('[data-testid="celebration-overlay"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="celebration-lottie"]').exists()).toBe(true);
  });

  it('points lottie at success.lottie with autoplay + no loop', async () => {
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    const el = wrapper.get('[data-testid="celebration-lottie"]').element as HTMLElement;
    expect(el.getAttribute('data-src')).toContain('success.lottie');
    expect(el.getAttribute('data-autoplay')).toBe('true');
    expect(el.getAttribute('data-loop')).toBe('false');
  });

  it('dismisses after fallback timer fires', async () => {
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    expect(wrapper.find('[data-testid="celebration-overlay"]').exists()).toBe(true);
    vi.advanceTimersByTime(3600);
    await nextTick();
    expect(wrapper.find('[data-testid="celebration-overlay"]').exists()).toBe(false);
  });

  it('marks overlay aria-hidden true', async () => {
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    expect(wrapper.find('[data-testid="celebration-overlay"]').attributes('aria-hidden')).toBe('true');
  });

  it('closes when lottie emits complete', async () => {
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    expect(wrapper.find('[data-testid="celebration-overlay"]').exists()).toBe(true);
    await wrapper.get('[data-testid="celebration-lottie"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="celebration-overlay"]').exists()).toBe(false);
  });

  it('suppresses overlay when prefers-reduced-motion matches', async () => {
    setReducedMotion(true);
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    await nextTick();
    expect(wrapper.find('[data-testid="celebration-overlay"]').exists()).toBe(false);
  });

  it('emits finished when the lottie completes', async () => {
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    await wrapper.get('[data-testid="celebration-lottie"]').trigger('click');
    await nextTick();
    expect(wrapper.emitted('finished')).toHaveLength(1);
  });

  it('emits finished after the fallback timer fires', async () => {
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    vi.advanceTimersByTime(3600);
    await nextTick();
    expect(wrapper.emitted('finished')).toHaveLength(1);
  });

  it('emits finished immediately (no overlay) under reduced motion', async () => {
    setReducedMotion(true);
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    expect(wrapper.find('[data-testid="celebration-overlay"]').exists()).toBe(false);
    expect(wrapper.emitted('finished')).toHaveLength(1);
  });

  it('emits finished only once when complete clears the fallback timer', async () => {
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    await wrapper.get('[data-testid="celebration-lottie"]').trigger('click');
    await nextTick();
    vi.advanceTimersByTime(3600);
    await nextTick();
    expect(wrapper.emitted('finished')).toHaveLength(1);
  });

  it('does not retrigger when triggerKey stays the same', async () => {
    const wrapper = mountIt({ triggerKey: 1 });
    await flushPromises();
    expect(wrapper.find('[data-testid="celebration-overlay"]').exists()).toBe(false);
  });

  it('remounts lottie with new key on each retrigger to restart playback', async () => {
    const wrapper = mountIt({ triggerKey: 0 });
    await wrapper.setProps({ triggerKey: 1 });
    await flushPromises();
    const first = (wrapper.get('[data-testid="celebration-lottie"]').element as HTMLElement).outerHTML;
    await wrapper.get('[data-testid="celebration-lottie"]').trigger('click');
    await nextTick();
    await wrapper.setProps({ triggerKey: 2 });
    await flushPromises();
    expect(wrapper.find('[data-testid="celebration-lottie"]').exists()).toBe(true);
    expect(first).toContain('lottie-stub');
  });
});
