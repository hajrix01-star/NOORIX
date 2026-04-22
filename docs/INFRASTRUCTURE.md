# بنية التحتية لـ Noorix — الحقيقة الكاملة (أبريل 2026)

> **هذا الملف يوثّق القرارات والإعدادات الحرجة التي يجب على أي مطوّر معرفتها قبل أي تعديل.**

---

## 1. البيئة الإنتاجية — Hostinger VPS فقط

| التفصيل | القيمة |
|---------|--------|
| المزود | Hostinger VPS |
| عنوان IP | `77.37.51.67` |
| المستخدم | `root` |
| نظام التشغيل | Ubuntu |
| Node.js | v20 |
| مدير العمليات | PM2 |
| قاعدة البيانات | PostgreSQL 16 — على `localhost:5432` |
| اسم القاعدة | `noorix` |
| مستخدم DB | `noorix_user` |
| مسار المشروع | `/var/www/noorix/` |
| المنفذ | `8080` |

**⚠️ لا يوجد Supabase في الإنتاج — لا تضف أي إعدادات Supabase مجدداً.**

---

## 2. ملف `.env` على الـ VPS

```
PORT=8080
DATABASE_URL="postgresql://noorix_user:StrongPassword123@localhost:5432/noorix"
JWT_SECRET=super-secret-key-123456789
JWT_EXPIRES_IN=8h
GEMINI_API_KEY=...
```

**قاعدة البيانات محلية على نفس السيرفر** — localhost، بدون SSL، بدون اتصال خارجي.

---

## 3. النشر — مصدران يجب فهمهما

| المسار | الدور |
|--------|--------|
| `/var/www/noorix/` | كود المستودع + بناء الـ backend؛ قد يحتوي `dist/` بعد بناء محلي **لكن هذا لا يعني أن الزائر يراه** |
| `/var/www/hajrix.com/` (أو ما في `/etc/noorix/frontend-root`) | **مجلد Nginx `root`** — هنا يجب أن تُنسخ حزمة الواجهة بعد كل بناء إنتاجي |

**احتمال «واجهتين»:** نسخة حديثة داخل `/var/www/noorix/dist` ونسخة قديمة تُخدم من `/var/www/hajrix.com` إذا لم يُنفَّذ `deploy/install-frontend.sh` (أو لم يطابق الملف `/etc/noorix/frontend-root` إعداد Nginx).

- **GitHub Actions:** يبني على الـ runner ثم يشغّل `deploy/install-frontend.sh` على السيرفر (انظر `.github/workflows/deploy.yml`).
- **يدوياً:** استخدم `bash scripts/vps-update-noorix.sh` — يبني الواجهة ثم يستدعي نفس `install-frontend.sh`.

### خطوات آمنة (مرجع قديم — يُفضّل السكربت أعلاه)

```bash
cd /var/www/noorix
git pull origin main
bash scripts/vps-update-noorix.sh
curl http://localhost:8080/api/v1/health
```

---

## 4. نظام النسخ الاحتياطي — طبقتان

### الطبقة الأولى: نسخة الكرون اليومية (خارج التطبيق)

| التفصيل | القيمة |
|---------|--------|
| السكريبت | `/usr/local/bin/noorix-backup.sh` |
| الجدول | كل يوم الساعة **2:00 صباحاً** |
| مكان الحفظ | `/var/backups/noorix/` |
| الاحتفاظ | آخر **30 يوم** |
| السجل | `/var/log/noorix-backup.log` |
| النوع | `pg_dump` — نسخة كاملة لكل القاعدة |

**هذه النسخة لا تظهر في واجهة التطبيق** — هي طبقة أمان خارجية مستقلة.

لمراجعة النسخ:
```bash
ls -lh /var/backups/noorix/
cat /var/log/noorix-backup.log
```

لاسترداد يدوي:
```bash
# فك الضغط
gunzip /var/backups/noorix/noorix_backup_YYYY-MM-DD_HH-MM.sql.gz

# استرداد في قاعدة البيانات
sudo -u postgres psql -d noorix < /var/backups/noorix/noorix_backup_YYYY-MM-DD_HH-MM.sql
```

---

### الطبقة الثانية: نظام النسخ المدمج في التطبيق

| التفصيل | القيمة |
|---------|--------|
| مكان الحفظ | `/var/www/noorix/backend/data/backups/` |
| النوع الكامل | `database_full` — pg_dump custom format |
| نوع الشركة | `company_logical` — JSON لكل شركة |
| الجدول التلقائي | من الإعدادات (حالياً **معطّل**) |
| يظهر في | الإعدادات ← النسخ الاحتياطي |

**لتفعيل النسخ التلقائي:**
افتح النظام ← الإعدادات ← النسخ الاحتياطي ← النسخ الاحتياطي للنظام ← فعّل الجدول اليومي.

**ما تشمله نسخة الشركة:**
الموردين، الفواتير، المبيعات، الخزائن، الحسابات، الموظفين، الرواتب، الإجازات، الطلبات، كشوف البنك، المصاريف، سجل المراجعة.

**ما لا تشمله نسخة الشركة:** بيانات OCR — تُحفظ فقط في النسخة الكاملة.

---

## 5. دروس مستفادة — أحداث أبريل 2026

### ما حدث
بعد إضافة ميزة المفضلة، اعتُقد أن أكثر من 30 مورداً اختفوا من شركة "المعلم الشامي". في الواقع:
- البيانات كانت **موجودة دائماً** على VPS (114 مورد للمعلم الشامي)
- المشكلة: الكود المحلي كان يشير إلى Supabase (قاعدة فارغة) بدلاً من VPS
- الباكند كان يتعطل 500+ مرة يومياً بسبب مكتبة `multer` مفقودة

### الأخطاء التي أُصلحت
| الخطأ | السبب | الإصلاح |
|-------|--------|---------|
| `multer` غير موجودة | كانت في `devDependencies` | نُقلت إلى `dependencies` |
| `pg_dump` يفشل على localhost | `PGSSLMODE=require` | تلقائي: `disable` للـ localhost، `require` لغيره |
| `isTaxRegistered` لا يُحفظ | حقل مفقود من Schema والكود | أُضيف لكليهما |
| التحقق من الهاتف صارم جداً | regex يقبل السعودي فقط | مرن لأي رقم |

---

## 6. قواعد ذهبية — لا تتجاوزها أبداً

```
⛔ لا تستخدم: prisma db push --force-reset
⛔ لا تستخدم: prisma db push --accept-data-loss
⛔ لا تضف حزمة تحتاجها في runtime داخل devDependencies
⛔ لا تُنشئ Supabase URL أو shadowDatabaseUrl في الإنتاج
✅ أي تغيير في Schema → prisma db push (بدون flags خطيرة) أو prisma migrate
✅ قبل أي تغيير كبير → شغّل نسخة احتياطية يدوية من الإعدادات
```

---

## 7. PM2 — العمليات الجارية

| الاسم | المنفذ | الوضع |
|-------|--------|-------|
| `noorix-backend` | 8080 | online |
| `hajri-menu` | — | online |

```bash
# مراقبة
pm2 list
pm2 logs noorix-backend --lines 50

# إعادة تشغيل
pm2 restart noorix-backend

# حفظ الإعداد بعد تغيير
pm2 save
```

---

## 8. حالة قاعدة البيانات (أبريل 2026)

| الشركة | عدد الموردين |
|--------|-------------|
| المعلم الشامي | 114 |
| دوحة المستهلك | 108 |
| وقت الكرك | 15 |
| ARZ | 3 |
