import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 放上 GitHub Pages 時，網站喺 /A-iue-O/ 底下（由發佈流程設定 PAGES_BASE）
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react()],
  server: { port: 5173, host: true },
})
