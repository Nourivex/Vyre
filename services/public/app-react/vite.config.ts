import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy API requests to the backend dev server (Fastify) running on :3000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/conversations': 'http://localhost:3000',
      '/agents': 'http://localhost:3000',
      '/models': 'http://localhost:3000',
      '/collections': 'http://localhost:3000',
      '/ingest': 'http://localhost:3000',
      '/openapi.json': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
      '/messages': 'http://localhost:3000'
    }
  }
})
