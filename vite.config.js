import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@weather-icons': path.resolve(__dirname, 'node_modules/@bybas/weather-icons/production')
    }
  }
})
