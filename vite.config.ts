import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { pwaOptions } from './src/pwa/manifest';

export default defineConfig({
  plugins: [vue(), VitePWA(pwaOptions)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 / rolldown requires a function form for manualChunks.
        manualChunks(id) {
          if (id.includes('node_modules/firebase/auth') || id.includes('node_modules/@firebase/auth')) {
            return 'firebase-auth';
          }
          if (id.includes('node_modules/firebase/app') || id.includes('node_modules/@firebase/app')) {
            return 'firebase-auth';
          }
          if (id.includes('node_modules/firebase/firestore') || id.includes('node_modules/@firebase/firestore')) {
            return 'firebase-firestore';
          }
          if (
            id.includes('node_modules/vue/') ||
            id.includes('node_modules/vue-router') ||
            id.includes('node_modules/pinia') ||
            id.includes('node_modules/@vue/')
          ) {
            return 'vue';
          }
          return undefined;
        },
      },
    },
  },
});
