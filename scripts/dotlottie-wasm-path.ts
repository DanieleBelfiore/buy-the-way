import { createRequire } from 'node:module';

// Absolute path of the WASM runtime that belongs to the installed
// dotlottie-vue. Resolved THROUGH dotlottie-vue (dotlottie-web is its
// dependency, not ours) so the binary always matches the JS player version,
// whatever a future upgrade pulls in. Shared by vite.config.ts and
// vitest.config.ts.
const requireFromHere = createRequire(import.meta.url);
const requireFromPlayer = createRequire(requireFromHere.resolve('@lottiefiles/dotlottie-vue'));

const dotlottieWasmPath = requireFromPlayer.resolve(
  '@lottiefiles/dotlottie-web/dotlottie-player.wasm',
);

// Alias entry for `import url from 'dotlottie-player-wasm?url'`. A regex,
// because a plain string alias does not match an id carrying a `?url` query.
export const dotlottieWasmAlias = {
  find: /^dotlottie-player-wasm(?=\?|$)/,
  replacement: dotlottieWasmPath,
};
