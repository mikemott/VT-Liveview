import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Small files are normally inlined into the JS as data URLs. For the ~240
    // weather icons that put ~400 KB of SVG text in the main chunk, though only a
    // few are ever shown, so they stay separate files (VTL-95).
    assetsInlineLimit: (filePath) =>
      filePath.includes('@bybas/weather-icons') ? false : undefined,
    rollupOptions: {
      output: {
        // Libraries change far less often than the app, so they get their own
        // chunks and stay cached across releases (VTL-95)
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('maplibre-gl')) return 'maplibre';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/types': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@/components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@/hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@/services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@/utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
    },
  },
});
