import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      process: 'process/browser',
      ...(process.env.NODE_ENV === 'production'
        ? { './mockData': path.resolve(__dirname, 'src/services/mockData.stub.ts') }
        : {}),
    },
  },
  server: {
    proxy: {
      // Default: proxy to live Vercel deployment (requires SOSOVALUE_API_KEY set on Vercel).
      // For fully local dev: run `vercel dev` in project root, then set
      //   API_PROXY=http://localhost:3000 pnpm dev
      '/api': {
        target: process.env.API_PROXY ?? 'https://etfsignal.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
