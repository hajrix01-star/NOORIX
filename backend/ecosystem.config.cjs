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

const cwd = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: 'noorix-backend',
      cwd,
      script: 'dist/main.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
