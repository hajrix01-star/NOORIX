# نشر Noorix على Hostinger VPS

## المتطلبات
- Hostinger VPS مع Ubuntu
- Node.js 20+، PM2، PostgreSQL 15+، Nginx
- المنفذ 3000 للباكند، 80/443 للفرونت إند

---

## إعداد قاعدة البيانات (أول مرة)

```bash
# على الـ VPS
sudo -u postgres psql
CREATE DATABASE noorix;
CREATE USER noorixuser WITH PASSWORD 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE noorix TO noorixuser;
\q
```

---

## ملف `.env` على الـ VPS

```
# /var/www/noorix/backend/.env
PORT=3000
DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/noorix"
JWT_SECRET=your-very-long-random-secret-min-32-chars
JWT_EXPIRES_IN=8h
ADMIN_DEFAULT_PASSWORD=your-admin-password
CORS_ORIGIN=https://your-domain.com
GEMINI_API_KEY=your-gemini-key-optional
```

---

## النشر (pull + build + restart)

```bash
cd /var/www/noorix

# سحب التحديثات
git pull origin main

# الباكند
cd backend
npm install
npm run build
npx prisma db push          # ⚠️ لا تستخدم --force-reset أبداً
pm2 restart noorix-backend

# الفرونت إند
cd ../
npm install
npm run build
# الملفات في dist/ → خدّمها عبر Nginx
```

---

## PM2 (أول مرة)

```bash
cd /var/www/noorix/backend
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## فحص الصحة

```
GET https://your-domain.com/api/v1/health
```

يُعيد:
```json
{ "dbConnected": true, "adminExists": true }
```

---

## النسخ الاحتياطي اليدوي

```bash
# على الـ VPS
PGPASSWORD=YOUR_PASSWORD pg_dump -U postgres -d noorix \
  --no-owner --no-acl --format=custom \
  --file=/var/backups/noorix_$(date +%Y%m%d).dump
```

---

## بيانات الدخول الافتراضية

| البريد | كلمة المرور |
|--------|-------------|
| `admin@noorix.sa` | `ADMIN_DEFAULT_PASSWORD من .env` |

⚠️ **غيّر كلمة المرور فور أول دخول.**

---

## GitHub Secrets المطلوبة للنسخ الاحتياطي التلقائي

| الاسم | القيمة |
|-------|--------|
| `VPS_HOST` | `77.37.51.67` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | مفتاح SSH الخاص (private key) |
| `VPS_DB_PASSWORD` | كلمة مرور PostgreSQL |
| `VPS_DB_NAME` | `noorix` |
| `GDRIVE_SCRIPT_URL` | رابط Google Apps Script |
