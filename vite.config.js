import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local'],
  },
})
