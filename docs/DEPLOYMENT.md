# نشر نويركس (Deployment)

## Railway / بيئة الإنتاج

### خطوات النشر

1. **تأكد من متغيرات البيئة** في Railway:
   - `DATABASE_URL` — رابط PostgreSQL
   - `JWT_SECRET` — مفتاح JWT
   - `VITE_API_URL` (أو `API_URL`) — رابط الـ API للواجهة

2. **تشغيل Migrations** (عادةً تلقائي عند البناء):
   ```bash
   cd backend && npx prisma migrate deploy
   ```

3. **تشغيل Seed** (مهم — ينشئ المستخدم الافتراضي):
   ```bash
   cd backend && npx prisma db seed
   ```

### بيانات الدخول الافتراضية (بعد Seed)

| البريد | كلمة المرور |
|--------|-------------|
| `admin@noorix.sa` | `123` |

⚠️ **أمان**: غيّر كلمة المرور فوراً بعد أول دخول في بيئة الإنتاج.

### إذا لم يعمل Seed تلقائياً

في Railway، أضف أمر Seed إلى **Build Command** أو شغّله يدوياً من لوحة التحكم:

```
cd backend && npx prisma migrate deploy && npx prisma db seed && npm run build
```

أو كأمر منفصل بعد النشر:
```
cd backend && npx prisma db seed
```
