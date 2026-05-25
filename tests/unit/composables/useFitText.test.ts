import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, ref, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { useFitText } from '@/composables/useFitText';

/**
 * Host component that wires a controllable watch source + container/inner
 * refs into useFitText so we can drive measurements deterministically.
 */
const makeHost = (
  watchSource: ReturnType<typeof ref<string>>,
  available: number,
  natural: number,
  opts?: { minScale?: number; maxScale?: number },
) =>
  defineComponent({
    setup() {
      const inner = ref<HTMLElement | null>(null);
      const container = ref<HTMLElement | null>(null);
      const { scale } = useFitText(inner, container, watchSource, opts);
      // Inject stubs that report deterministic clientWidth / scrollWidth.
      const containerStub = {
        get clientWidth() {
          return available;
        },
        style: {},
      } as unknown as HTMLElement;
      const innerStub = {
        get scrollWidth() {
          return natural;
        },
        style: {} as CSSStyleDeclaration,
      } as unknown as HTMLElement;
      container.value = containerStub;
      inner.value = innerStub;
      return () => h('div', { 'data-scale': scale.value });
    },
  });

describe('useFitText', () => {
  let originalRO: typeof globalThis.ResizeObserver;
  const observed: HTMLElement[] = [];
  const disconnects = vi.fn();
  let triggerResize: () => void = () => {};

  beforeEach(() => {
    observed.length = 0;
    disconnects.mockReset();
    originalRO = globalThis.ResizeObserver;
    class MockRO {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        triggerResize = () => this.cb([], this as unknown as ResizeObserver);
      }
      observe(target: HTMLElement) {
        observed.push(target);
      }
      unobserve() {}
      disconnect() {
        disconnects();
      }
    }
    globalThis.ResizeObserver = MockRO as unknown as typeof globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalRO;
  });

  it('returns scale=1 when natural fits in available width', async () => {
    const watchSource = ref('foo');
    const wrapper = mount(makeHost(watchSource, 200, 100));
    await nextTick();
    expect(wrapper.attributes('data-scale')).toBe('1');
  });

  it('shrinks scale to ratio when natural overflows available', async () => {
    const watchSource = ref('long-text');
    const wrapper = mount(makeHost(watchSource, 100, 200));
    await nextTick();
    // ratio = 100/200 = 0.5 → clamped above minScale=0.55 → 0.55
    expect(wrapper.attributes('data-scale')).toBe('0.55');
  });

  it('honors custom minScale option', async () => {
    const watchSource = ref('long-text');
    const wrapper = mount(makeHost(watchSource, 100, 1000, { minScale: 0.2 }));
    await nextTick();
    // ratio = 0.1 → clamped at minScale=0.2.
    expect(wrapper.attributes('data-scale')).toBe('0.2');
  });

  it('clamps to maxScale when natural is tiny vs available', async () => {
    const watchSource = ref('x');
    const wrapper = mount(makeHost(watchSource, 1000, 10, { maxScale: 1 }));
    await nextTick();
    expect(wrapper.attributes('data-scale')).toBe('1');
  });

  it('falls back to maxScale when widths are degenerate (natural=0)', async () => {
    const watchSource = ref('');
    const wrapper = mount(makeHost(watchSource, 100, 0));
    await nextTick();
    expect(wrapper.attributes('data-scale')).toBe('1');
  });

  it('registers a ResizeObserver on the container and disconnects on unmount', async () => {
    const watchSource = ref('foo');
    const wrapper = mount(makeHost(watchSource, 200, 100));
    await nextTick();
    expect(observed.length).toBe(1);
    wrapper.unmount();
    expect(disconnects).toHaveBeenCalledOnce();
  });

  it('re-measures when watchSource changes', async () => {
    const watchSource = ref('initial');
    const wrapper = mount(makeHost(watchSource, 100, 200));
    await nextTick();
    expect(wrapper.attributes('data-scale')).toBe('0.55');
    // queueMicrotask resolves on the next microtask tick.
    watchSource.value = 'changed';
    await Promise.resolve();
    await nextTick();
    // No widget changed underneath; result stays at the same clamped value.
    expect(wrapper.attributes('data-scale')).toBe('0.55');
  });

  it('re-measures on ResizeObserver fire', async () => {
    const watchSource = ref('foo');
    const wrapper = mount(makeHost(watchSource, 200, 100));
    await nextTick();
    expect(wrapper.attributes('data-scale')).toBe('1');
    triggerResize();
    await nextTick();
    // Same widths => idempotent.
    expect(wrapper.attributes('data-scale')).toBe('1');
  });
});
