# نشر نويركس (Deployment)

## Railway / بيئة الإنتاج

### متغيرات البيئة المطلوبة

| المتغير | الوصف |
|---------|-------|
| `DATABASE_URL` | رابط PostgreSQL (من Railway أو خارجي) |
| `JWT_SECRET` | مفتاح JWT (32 حرفاً على الأقل) |
| `VITE_API_URL` | رابط الـ Backend (عند بناء الـ Frontend) |

### آلية التشغيل التلقائي

- **Migrations**: تُنفَّذ عند البدء عبر `prisma migrate deploy`
- **Seed**: يُنفَّذ تلقائياً عند بدء التطبيق (NestJS DatabaseBootstrapService)
- المستخدم الافتراضي يُنشأ أو يُحدَّث في كل تشغيل

### بيانات الدخول الافتراضية

| البريد | كلمة المرور |
|--------|-------------|
| `admin@noorix.sa` | `123` |

⚠️ **أمان**: غيّر كلمة المرور فوراً بعد أول دخول في بيئة الإنتاج.

### فحص الاتصال والتشخيص

افتح: `https://YOUR-BACKEND-URL/api/v1/health`

الاستجابة تتضمن:
- `dbConnected`: هل قاعدة البيانات متصلة
- `adminExists`: هل المستخدم admin@noorix.sa موجود

إذا كان `adminExists: false` رغم تشغيل التطبيق، تحقق من:
1. `DATABASE_URL` صحيح ومتصل بنفس قاعدة البيانات
2. سجلات Railway (Deploy Logs) — هل تظهر أخطاء عند البدء

### خطأ MaxClientsInSessionMode (Supabase)

إذا ظهر:
```
MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size
```

**السبب:** Supabase Session mode يحدّ عدد الاتصالات المتزامنة حسب pool_size. المشروع يستخدم نسختين من Prisma (PrismaService + TenantPrismaService)، وكل نسخة تفتح عدة اتصالات.

**الحل المدمج (main.ts):**
- يُضاف تلقائياً `connection_limit=3` لتقليل اتصالات Prisma.
- إذا كان الرابط يحتوي `pooler.supabase.com:5432` يُستبدل المنفذ بـ 6543 (Transaction mode).

**إذا استمر الخطأ — استخدم رابط Pooler (Transaction mode):**
1. Supabase Dashboard → Project Settings → Database
2. انسخ رابط **Connection Pooling** → **Transaction** (منفذ **6543**) — وليس Direct أو Session
3. ضعه في `DATABASE_URL` على Render/Railway

**اختياري:** أضف `DATABASE_CONNECTION_LIMIT=2` في متغيرات البيئة لمزيد من التقليل.
