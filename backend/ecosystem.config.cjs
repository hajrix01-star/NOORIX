/**
 * PM2: شغّل من مجلد backend الحالي (على السيرفر: /var/www/noorix/backend)
 *
 *   cd /var/www/noorix/backend
 *   npm run build
 *   pm2 delete noorix-api noorix-backend   # مرة واحدة لإزالة المسارات القديمة
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
const path = require('path');
const dotenv = require('dotenv');

const cwd = path.resolve(__dirname);
dotenv.config({ path: path.join(cwd, '.env') });

module.exports = {
  apps: [
    {
      name: 'noorix-backend',
      cwd,
      script: 'dist/main.js',
      interpreter: 'node',
      /** Cluster: استغلال أكثر من نواة — كل طلب له سياق مستقل (AsyncLocalStorage). */
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
        /** مهم: يجب أن يطابق Nginx ‎proxy_pass (غالباً 3000 أو 8080 من ‎.env) */
        PORT: String(process.env.PORT || '3000'),
        /** نُعيّن عبر النشر (GitHub Actions) ليعود في ‎/api/v1/health ‎version */
        DEPLOY_SHA: process.env.DEPLOY_SHA || '',
        /** .env + افتراضي: بدون CORS الـ app كان ينهار قبل listen */
        CORS_ORIGIN: (String(process.env.CORS_ORIGIN || '').trim() || 'https://hajrix.com'),
      },
    },
  ],
};
