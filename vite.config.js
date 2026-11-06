import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  base: '/Apka_2.0/',
  build: {
    rollupOptions: {
      output: {
        // Duże, rzadko zmieniane biblioteki w osobnych chunkach — po aktualizacji
        // aplikacji przeglądarka pobiera tylko mały chunk z naszym kodem.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Apka 2.0',
        short_name: 'Apka 2.0',
        description: 'Budżet, nawyki, modlitwa i więcej',
        theme_color: '#D4A574',
        background_color: '#14110D',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/Apka_2.0/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
