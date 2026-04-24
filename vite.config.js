import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

/** يُستخدم في الواجهة وفي index.html للتحقق من أن النشر يطابق الـ commit */
const noorixBuildId =
  process.env.VITE_BUILD_ID ||
  process.env.GITHUB_SHA ||
  process.env.RENDER_GIT_COMMIT ||
  String(Date.now());

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(noorixBuildId),
  },
  plugins: [
    {
      name: 'noorix-inject-build-meta',
      transformIndexHtml(html) {
        let out = html;
        if (!out.includes('name="noorix-build"')) {
          const safe = String(noorixBuildId).replace(/"/g, '');
          out = out.replace('<head>', `<head>\n    <meta name="noorix-build" content="${safe}" />`);
        }
        if (process.env.VITE_CSP === '0' || /http-equiv="Content-Security-Policy/i.test(out)) {
          return out;
        }
        const isDev = process.env.NODE_ENV !== 'production';
        const header = isDev ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
        let apiOrigin = '';
        const raw = process.env.VITE_API_URL;
        if (raw) {
          try {
            apiOrigin = ` ${new URL(raw).origin}`;
          } catch {
            /* تجاهل عنوان API غير صالح */
          }
        }
        const connectSrc = `'self'${apiOrigin} https://fonts.googleapis.com https://fonts.gstatic.com ws: wss:`;
        const csp = [
          "default-src 'self'",
          "base-uri 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          `connect-src ${connectSrc}`,
          "worker-src 'self'",
          "manifest-src 'self' data:",
        ].join('; ');
        return out.replace('<head>', `<head>\n    <meta http-equiv="${header}" content="${csp}" />`);
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'نووريكس — Noorix',
        short_name: 'نووريكس',
        description: 'نظام إدارة متكامل للمبيعات والمحاسبة والموارد البشرية',
        theme_color: '#0a1f44',
        background_color: '#f4f6f9',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'ar',
        dir: 'rtl',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        screenshots: [],
      },
      workbox: {
        /* يفعّل الإصدار الجديد بسرعة بعد النشر — يقلّل بقاء واجهة قديمة بسبب الـ PWA */
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          query: ['@tanstack/react-query'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
  },
});
