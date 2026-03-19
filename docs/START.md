# تشغيل Noorix بالكامل

لتشغيل التطبيق (واجهة + سيرفر + قاعدة بيانات) محلياً.

## 1. المتطلبات

- Node.js 18+
- PostgreSQL يعمل ومتاح (منفذ 5432 أو حسب إعدادك)

## 2. قاعدة البيانات والـ Backend

```bash
cd backend
cp .env.example .env
# عدّل .env: DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/noorix?schema=public"
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

السيرفر يعمل على **http://localhost:3000**. نقطة الصحة: `GET http://localhost:3000/api/v1/health`.

نقاط نهاية مفيدة: `GET /api/v1/companies`، `GET /api/v1/invoices?companyId=...`، `GET /api/v1/vaults?companyId=...`، `GET /api/v1/suppliers?companyId=...&page=1&pageSize=50`.

بعد الـ seed يمكن تسجيل الدخول بـ:
- **البريد:** admin@noorix.sa  
- **كلمة المرور:** noorix123  

والشركات الافتراضية: **المعلم الشامي**، **وقت الكرك**.

## 3. الواجهة (Frontend)

```bash
# من جذر المشروع (noorix)
cp .env.example .env
# عدّل .env وأضف سطر الاتصال بالسيرفر (إلزامي لربط الواجهة بالـ Backend):
# VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

**مهم:** بعد أي تعديل على `.env` يجب إعادة تشغيل `npm run dev` لأن Vite يقرأ متغيرات البيئة عند بدء التشغيل فقط.

الواجهة تعمل على **http://localhost:5173**. افتح أدوات المطوّر (F12) → Console لرؤية نتيجة فحص الاتصال بالسيرفر.

## 4. المسارات المهمة

| المسار | الوصف |
|--------|--------|
| `/` | إعادة توجيه إلى المبيعات |
| `/login` | تسجيل الدخول (انتهاء الجلسة بعد 15 دقيقة خمول) |
| `/invoices` | قائمة الفواتير من السيرفر (SmartTable + ترقيم) |
| `/sales/new` | إدخال فاتورة مبيعات/ملخص نهاية الدوام |
| `/reports` | التقارير |
| `/suppliers` | الموردين والتصنيفات (إضافة مورد + قائمة) |
| `/treasury` | الخزائن (إضافة خزنة + قائمة) |
| `/settings` | الإعدادات |

## 5. استكشاف الأخطاء

- **الفواتير لا تظهر:** تأكد من تشغيل الـ Backend ووجود شركة واحدة على الأقل (بعد `prisma db seed`).
- **CORS:** السيرفر يفعّل CORS. إن استخدمت منفذ أو أصل آخر للواجهة، اضبط `CORS_ORIGIN` في `backend/.env`.
- **لا توجد شركات:** نفّذ `cd backend && npx prisma db seed` ثم حدّث صفحة الفواتير.
