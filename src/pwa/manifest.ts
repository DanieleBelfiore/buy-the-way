import type { VitePWAOptions } from 'vite-plugin-pwa';

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface PwaManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'portrait' | 'landscape' | 'any';
  theme_color: string;
  background_color: string;
  lang: string;
  icons: ManifestIcon[];
}

export const pwaManifest: PwaManifest = {
  name: 'Buy The Way',
  short_name: 'BuyTheWay',
  description: 'Shared real-time shopping lists.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: '#1c1c1c',
  background_color: '#f7f4ed',
  lang: 'it',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
  ],
};

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  injectRegister: null,
  includeAssets: ['icons/favicon.ico', 'icons/apple-touch-icon.png'],
  manifest: pwaManifest,
  devOptions: {
    enabled: false,
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/, /identitytoolkit\.googleapis\.com/],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
};
