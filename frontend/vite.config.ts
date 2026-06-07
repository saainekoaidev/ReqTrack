import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // DGMS(5173) と衝突しないよう 5174 を使用
    port: 5174,
    strictPort: true,
    // 開発時は /api を backend (Hono) へプロキシし、CORS/URL 差異を吸収する。
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
});
