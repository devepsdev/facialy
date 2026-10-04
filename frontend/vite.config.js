import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Prefijo bajo el que cuelga la app: '/facialy' (por defecto, detrás del proxy de la Orange Pi)
// o '' cuando vive en la raíz de un subdominio (facialy.deveps.dev). Se fija con VITE_BASE_PATH.
const BASE = (process.env.VITE_BASE_PATH ?? '/facialy').replace(/\/$/, '')

// Producción: Django sirve el build bajo {BASE}/static/.
// Desarrollo: la SPA vive en http://localhost:5173{BASE}/ y la API se reenvía a Django.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' ? `${BASE}/static/` : `${BASE}/`,
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 700,
  },
  server: {
    proxy: {
      [`${BASE}/api`]: {
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        rewrite: (path) => path.slice(BASE.length),
      },
    },
  },
}))
