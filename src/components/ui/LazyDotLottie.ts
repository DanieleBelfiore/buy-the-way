import { defineAsyncComponent } from 'vue';
import wasmUrl from 'dotlottie-player-wasm?url';

// The dotlottie player is ~380 kB of JS plus a WASM runtime, and it only ever
// renders in empty states and the completion celebration. Importing it
// statically from a view puts it on the cold-boot path of every app open, so
// it is loaded on first render instead. Props, attrs and listeners fall
// through to the real component.
//
// The WASM runtime is served from our own origin. Left alone, the player
// fetches it from jsdelivr / unpkg at runtime: third-party code outside our
// CSP and deploys, and no animation at all when offline.
export const LazyDotLottie = defineAsyncComponent(() =>
  import('@lottiefiles/dotlottie-vue').then((m) => {
    m.setWasmUrl(wasmUrl);
    return m.DotLottieVue;
  }),
);
