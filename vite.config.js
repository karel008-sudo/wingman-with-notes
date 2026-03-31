import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Wingman with notes',
        short_name: 'Wingman',
        description: 'Your gym training wingman',
        theme_color: '#0f0f16',
        background_color: '#0f0f16',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
