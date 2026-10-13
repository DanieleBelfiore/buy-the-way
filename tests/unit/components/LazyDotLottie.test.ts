import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';

// Records when the player package is actually evaluated. vi.mock factories run
// on first import, so this stays false for as long as nothing imports it.
const state = vi.hoisted(() => ({ playerLoaded: false, wasmUrl: '' }));

vi.mock('dotlottie-player-wasm?url', () => ({ default: '/assets/dotlottie-player.test.wasm' }));

vi.mock('@lottiefiles/dotlottie-vue', () => {
  state.playerLoaded = true;
  return {
    setWasmUrl: (url: string) => {
      state.wasmUrl = url;
    },
    DotLottieVue: defineComponent({
      name: 'DotLottieVue',
      props: { src: { type: String, default: '' } },
      setup(props) {
        return () => h('div', { 'data-stub': 'dotlottie', 'data-src': props.src });
      },
    }),
  };
});

import { LazyDotLottie } from '@/components/ui/LazyDotLottie';

describe('LazyDotLottie', () => {
  it('does not load the player package until it is rendered', () => {
    expect(LazyDotLottie).toBeDefined();
    expect(state.playerLoaded).toBe(false);
  });

  it('renders the player once mounted, forwarding props and attrs', async () => {
    // Mounted through a host, as the views do: test-utils cannot query an
    // async component used as the mount root.
    const Host = defineComponent({
      setup: () => () =>
        h('section', [
          h(LazyDotLottie, {
            src: '/animations/empty.lottie',
            'data-testid': 'lazy-lottie',
            class: 'h-40',
          }),
        ]),
    });
    const wrapper = mount(Host);
    await flushPromises();

    expect(state.playerLoaded).toBe(true);
    // The player must fetch its WASM runtime from our own origin, not a CDN.
    expect(state.wasmUrl).toBe('/assets/dotlottie-player.test.wasm');
    const el = wrapper.find('[data-testid="lazy-lottie"]');
    expect(el.exists()).toBe(true);
    expect(el.attributes('data-stub')).toBe('dotlottie');
    expect(el.attributes('data-src')).toBe('/animations/empty.lottie');
    expect(el.classes()).toContain('h-40');
  });
});
