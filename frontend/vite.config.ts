import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // In production the app is served through Frappe at /assets/store_customizations/
  // In development the Vite dev server handles everything from /
  base: mode === 'production' ? '/assets/store_customizations/' : '/',

  build: {
    // Output goes directly into the Frappe app's public/ directory.
    // After building, run `bench build --app store_customizations` to copy
    // assets to sites/assets/store_customizations/ where Frappe serves them.
    outDir: '../frappe-bench/apps/store_customizations/store_customizations/public',
    // Don't wipe the whole public/ dir — it contains existing css/ and js/ subdirs
    emptyOutDir: false,
    rollupOptions: {
      output: {
        // Fixed filenames so www/index.html can reference them without hashes
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (info) =>
          info.name?.endsWith('.css') ? 'index.css' : 'assets/[name][extname]',
      },
    },
  },

  server: {
    // Proxy API calls to Frappe during development
    proxy: {
      '/api': {
        target: 'http://localhost:8100',
        changeOrigin: true,
      },
    },
  },
}))
