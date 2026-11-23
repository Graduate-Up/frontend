import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // 개발 중 /api 요청을 로컬 FastAPI로 넘김 (CORS 회피)
    proxy: {
      '/api': 'http://localhost:8000',
      // 성적 가져오기 즐겨찾기(북마클릿) 원본 스크립트 — 백엔드가 제공
      '/transcript-bookmarklet.js': 'http://localhost:8000',
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
