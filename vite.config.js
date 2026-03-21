import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(process.env.RENDER_GIT_COMMIT || process.env.VITE_BUILD_ID || Date.now().toString()),
  },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,   // يرفض التشغيل إذا كان المنفذ مشغولاً بدلاً من التبديل بصمت
    host: '0.0.0.0',    // IPv4 + IPv6
  },
});
