import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** إعداد Vite بدون إضافات منصة خارجية — لتفادي رسائل/اعتماد غير مرغوبة. */
/** للنشر تحت مسار فرعي عيّن عند البناء: VITE_BASE_PATH=/tax/ */
function vitePublicBase() {
  let b = (process.env.VITE_BASE_PATH || '/').trim();
  if (!b || b === '/') return '/';
  if (!b.startsWith('/')) b = `/${b}`;
  if (!b.endsWith('/')) b = `${b}/`;
  return b;
}

export default defineConfig({
  logLevel: 'error',
  base: vitePublicBase(),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_TAX_APP_BASE_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
