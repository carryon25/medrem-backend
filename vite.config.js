import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  preview: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
