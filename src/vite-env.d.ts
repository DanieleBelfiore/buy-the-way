/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Alias for the dotlottie WASM runtime, see scripts/dotlottie-wasm-path.ts.
declare module 'dotlottie-player-wasm?url' {
  const url: string;
  export default url;
}
