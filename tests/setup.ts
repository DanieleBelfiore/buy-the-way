import { vi } from 'vitest';
import { defineComponent, h } from 'vue';

vi.mock('@/services/firebase', () => ({
  auth: {},
  db: {},
  app: {},
}));

// vue-chartjs renders into a <canvas> via Chart.js, which jsdom does not
// implement. Stub both Bar and Doughnut to a div that records props for tests.
vi.mock('vue-chartjs', () => {
  const makeStub = (kind: string) =>
    defineComponent({
      name: `Chart-${kind}`,
      props: {
        data: { type: Object, default: () => ({}) },
        options: { type: Object, default: () => ({}) },
      },
      setup(props, { attrs }) {
        return () =>
          h(
            'div',
            {
              ...attrs,
              'data-stub': 'chart',
              'data-chart-type': kind,
              'data-labels': JSON.stringify((props.data as { labels?: unknown[] })?.labels ?? []),
            },
            `chart-${kind}-stub`,
          );
      },
    });
  return {
    Bar: makeStub('bar'),
    Doughnut: makeStub('doughnut'),
    Line: makeStub('line'),
    Pie: makeStub('pie'),
  };
});

// chart.js core also relies on canvas; stub the register surface we use.
vi.mock('chart.js', () => ({
  Chart: { register: () => undefined },
  BarElement: {},
  CategoryScale: {},
  LinearScale: {},
  ArcElement: {},
  Tooltip: {},
  Legend: {},
}));

// dotlottie-vue loads a WASM player at import time, which jsdom cannot satisfy.
// Stub mirrors the surface we use: src/autoplay/loop props + complete emit.
vi.mock('@lottiefiles/dotlottie-vue', () => {
  const DotLottieVue = defineComponent({
    name: 'DotLottieVue',
    props: {
      src: { type: String, default: '' },
      autoplay: { type: Boolean, default: false },
      loop: { type: Boolean, default: false },
    },
    emits: ['complete', 'load'],
    setup(props, { emit, attrs }) {
      return () =>
        h(
          'div',
          {
            ...attrs,
            'data-stub': 'dotlottie',
            'data-src': props.src,
            'data-autoplay': props.autoplay ? 'true' : 'false',
            'data-loop': props.loop ? 'true' : 'false',
            onClick: () => emit('complete'),
          },
          'lottie-stub',
        );
    },
  });
  return { DotLottieVue };
});

vi.mock('@unhead/vue', () => ({
  useHead: () => undefined,
  useSeoMeta: () => undefined,
  injectHead: () => ({ push: () => undefined }),
}));

const createStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length(): number {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number): string | null {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
  };
};

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createStorage(),
    writable: true,
    configurable: true,
  });
}
if (typeof globalThis.sessionStorage === 'undefined' || typeof globalThis.sessionStorage.clear !== 'function') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: createStorage(),
    writable: true,
    configurable: true,
  });
}
