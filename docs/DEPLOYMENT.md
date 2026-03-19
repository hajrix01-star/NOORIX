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
