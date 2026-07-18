import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/wordchain/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'WordChain',
        short_name: 'WordChain',
        description: 'A multiplayer word chain game for learning English',
        theme_color: '#6c5ce7',
        background_color: '#0a0a14',
        display: 'standalone',
        start_url: '/wordchain/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.dictionaryapi\.dev\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'dictionary-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],
});