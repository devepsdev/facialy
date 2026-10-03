import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Producción: Django sirve el build bajo /facialy/static/.
// Desarrollo: la SPA vive en http://localhost:5173/facialy/ y la API se reenvía a Django.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' ? '/facialy/static/' : '/facialy/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 700,
  },
  server: {
    proxy: {
      '/facialy/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/facialy/, ''),
      },
    },
  },
}))
