import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

const demoFile = (f) => fileURLToPath(new URL(`./src/demo/${f}`, import.meta.url))

// TRYB DEMO (`npm run demo`, `npm run build:demo`): Firebase podmieniony na
// atrapę w pamięci przeglądarki z losowymi danymi — patrz src/demo/.
// Kod aplikacji się nie zmienia, zmieniają się tylko ścieżki importów.
const demoAliases = [
  { find: /^firebase\/firestore\/lite$/, replacement: demoFile('lite.js') },
  { find: /^firebase\/firestore$/, replacement: demoFile('firestore.js') },
  { find: /^firebase\/auth$/, replacement: demoFile('auth.js') },
  { find: /^firebase\/app$/, replacement: demoFile('app.js') },
]

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
  // Demo budujemy ze ścieżkami względnymi, żeby działało pod dowolnym adresem.
  base: demo ? './' : '/Apka_2.0/',
  resolve: { alias: demo ? demoAliases : [] },
  build: {
    rollupOptions: {
      output: {
        // Duże, rzadko zmieniane biblioteki w osobnych chunkach — po aktualizacji
        // aplikacji przeglądarka pobiera tylko mały chunk z naszym kodem.
        manualChunks: demo ? { react: ['react', 'react-dom'] } : {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    // W demo bez service workera — inaczej stara wersja demo wisiałaby w cache.
    !demo && VitePWA({
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
}
})
