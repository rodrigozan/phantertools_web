import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || (mode === 'production' ? 'https://phanterai.tailc5aaf7.ts.net:10000/ig/api' : '')),
    },
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:3930',
        '/public': 'http://127.0.0.1:3930',
        '/ig/api': 'http://127.0.0.1:3930',
        '/ig/public': 'http://127.0.0.1:3930',
      },
    },
  }
})
