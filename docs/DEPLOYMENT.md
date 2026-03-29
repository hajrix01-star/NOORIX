# نشر نويركس (Deployment)

## GitHub Actions → VPS (خطأ `dial tcp ...:22: connect: connection timed out`)

عند فشل خطوة `appleboy/scp-action` أو `appleboy/ssh-action` بهذا النص، المشكلة **شبكية**: الـ runner لا يستطيع فتح اتصال TCP إلى `VPS_HOST` على المنفذ المستخدم (افتراضياً 22).

### ما الذي تتحقق منه

1. **`VPS_HOST` في Secrets**  
   يجب أن يكون **عنوان IPv4 عام** يصل إليه الإنترنت (ليس IP داخلياً ولا `localhost`). جرّب من جهازك خارج الشبكة الداخلية:
   `ssh -p PORT USER@HOST`

2. **جدار النار على السيرفر** (`ufw` / `iptables`)  
   اسمح بالمنفذ 22 (أو المنفذ الذي يستمع عليه SSH):
   `ufw allow 22/tcp` ثم `ufw reload`  
   راقب أن لا يكون السماح مقتصراً على IP قديم.

3. **جدار مزوّد السحابة** (Security Group / Firewall في لوحة التحكم)  
   أضف قاعدة **Inbound**: TCP المنفذ 22 (أو منفذ SSH الفعلي) من `0.0.0.0/0` للاختبار، ثم يمكن تقييدها لاحقاً.  
   ملاحظة: عناوين **GitHub-hosted runners** ليست ثابتة؛ تقييد SSH لقائمة IP صغيرة قد يكسر النشر بينما يعمل الاتصال من بيتك.

4. **SSH على منفذ غير 22**  
   في إعدادات المستودع → Secrets → أضف `VPS_SSH_PORT` بالقيمة الصحيحة (مثلاً `2222`). السير `deploy.yml` يقرأها.

5. **السيرفر متوقف أو غير متصل**  
   تأكد أن الـ VPS يعمل وأن نفس الـ IP ما زال مخصصاً له.

6. **اختبار سريع من الإنترنت**  
   من جهاز خارجي: `nc -zv YOUR_HOST 22` (أو المنفذ المستخدم). إذا فشل، المشكلة قبل SSH (شبكة/جدار).

### بدائل إن استمر الحظر

- تشغيل **self-hosted runner** على شبكة تصل للسيرفر ثم توجيه الـ workflow إليه.
- النشر اليدوي عند الحاجة: `bash scripts/vps-update-noorix.sh` على السيرفر بعد `git pull` محلياً أو من الجهاز الذي يصل للـ SSH.

---

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

**راجع [RENDER_SUPABASE.md](RENDER_SUPABASE.md) للحل التفصيلي.** الملخص: استخدم رابط **Pooler → Transaction** (منفذ 6543) في `DATABASE_URL`.
