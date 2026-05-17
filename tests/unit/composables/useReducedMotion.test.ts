import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, type Ref } from 'vue';
import {
  useReducedMotion,
  prefersReducedMotionSync,
} from '@/composables/useReducedMotion';

const originalMatchMedia = window.matchMedia;

describe('useReducedMotion / prefersReducedMotionSync', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn() as any;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('prefersReducedMotionSync returns true when media query matches', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    expect(prefersReducedMotionSync()).toBe(true);
  });

  it('prefersReducedMotionSync returns false when media query does not match', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    expect(prefersReducedMotionSync()).toBe(false);
  });

  it('useReducedMotion ref reflects initial matchMedia state', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: addListener,
      removeEventListener: removeListener,
    } as unknown as MediaQueryList);

    let captured: Ref<boolean> | undefined;
    const Comp = defineComponent({
      setup() {
        captured = useReducedMotion();
        return () => h('div');
      },
    });
    const wrapper = mount(Comp);
    expect(captured!.value).toBe(true);
    expect(addListener).toHaveBeenCalled();
    wrapper.unmount();
    expect(removeListener).toHaveBeenCalled();
  });

  it('useReducedMotion ref starts false when matchMedia missing', () => {
    delete (window as any).matchMedia;
    let captured: Ref<boolean> | undefined;
    const Comp = defineComponent({
      setup() {
        captured = useReducedMotion();
        return () => h('div');
      },
    });
    const wrapper = mount(Comp);
    expect(captured!.value).toBe(false);
    wrapper.unmount();
    window.matchMedia = originalMatchMedia;
  });
});
