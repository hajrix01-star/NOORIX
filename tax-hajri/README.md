# HAJRI TAX

تطبيق ويب لإدارة إقرارات ضريبة القيمة المضافة (شركات، نماذج، تقارير، محاكي سداد مستهدف).

## التشغيل محلياً

1. `npm install`
2. أنشئ ملف `.env.local` واضبط المتغيرات:

```env
VITE_TAX_APP_ID=your_app_id
VITE_TAX_APP_BASE_URL=https://your-backend-host.example
# اختياري:
# VITE_TAX_FUNCTIONS_VERSION=
```

3. `npm run dev`

## البناء

`npm run build` — المخرجات في `dist/`.

للنشر تحت مسار فرعي (مثل الموقع الرئيسي):

```bash
set VITE_BASE_PATH=/tax/
npm run build
```

## النشر (CI)

مع الدفع إلى `main` يبني GitHub Actions مشروع **نووريكس** ثم **tax-hajri** ويرفع الملفات إلى **`/var/www/hajrix.com/tax/`** على الـ VPS (عبر `rsync`).

- الرابط المتوقع بعد ضبط Nginx: **`https://hajrix.com/tax/`**
- أسرار اختيارية للبناء: `VITE_TAX_APP_ID`، `VITE_TAX_APP_BASE_URL`، `VITE_TAX_FUNCTIONS_VERSION` في إعدادات المستودع على GitHub.
- مثال موقع Nginx: `tax-hajri/deploy/nginx-location.example`

## المتغيرات

| المتغير | الوصف |
|---------|--------|
| `VITE_TAX_APP_ID` | معرّف التطبيق على الخادم الخلفي |
| `VITE_TAX_APP_BASE_URL` | عنوان الخادم الخلفي (BaaS أو API خاص) |
| `VITE_TAX_FUNCTIONS_VERSION` | اختياري |

يمكن تمرير `app_id` و`access_token` و`app_base_url` عبر استعلام الرابط أيضاً (للتطوير/الدمج).

## الاعتماد الخلفي

- الكود يستورد `hajri-sdk` و`taxAppClient` فقط.
- في `package.json` يُثبَّت `hajri-sdk` كاسم مستعار لحزمة NPM جاهزة (نفس واجهة `createClient`). عند الاستقلال الكامل يمكنكم استبدالها بخادمكم مع الحفاظ على نفس الاستدعاءات أو تعديل `taxAppClient.js` فقط.
