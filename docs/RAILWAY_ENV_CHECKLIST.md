# فحص متغيرات Railway — قائمة التحقق

## المتغيرات المطلوبة

| المتغير | الحالة | ملاحظات |
|---------|--------|---------|
| `DATABASE_URL` | ✅ لديك | Supabase — تأكد من صحة الرابط |
| `JWT_SECRET` | ⚠️ **مفقود** | **أضفه فوراً** — 32 حرفاً على الأقل |
| `PORT` | ✅ لديك (8080) | Railway يضيفه تلقائياً — يمكن حذفه |
| `GEMINI_API_KEY` | ✅ لديك | اختياري للمحادثة الذكية |

---

## إجراءات مطلوبة

### 1. إضافة JWT_SECRET (إلزامي)

في Railway → Variables → **+ New Variable**:

```
JWT_SECRET=مفتاح-سري-قوي-32-حرف-على-الأقل
```

مثال آمن (ولّد مفتاحاً عشوائياً):
```
JWT_SECRET=n8Kp2mQx7vL9wR4tY6uI0oP3aS5dF1gH
```

### 2. التحقق من DATABASE_URL مع Supabase

رابطك الحالي:
```
postgresql://postgres:Hajrim2h%40%40%40@db.pfyhpebvmeluyirlhden.supabase.co:5432/postgres
```

- `%40` = `@` (ترميز صحيح)
- المنفذ 5432 = اتصال مباشر (مناسب لـ Railway)

**إذا ظهر خطأ اتصال**، أضف في نهاية الرابط:
```
?sslmode=require
```

مثال:
```
postgresql://postgres:Hajrim2h%40%40%40@db.pfyhpebvmeluyirlhden.supabase.co:5432/postgres?sslmode=require
```

### 3. Supabase — السماح بالاتصال من Railway

في Supabase Dashboard → **Settings** → **Database**:
- تأكد أن **Connection pooling** أو **Direct connection** مفعّل
- تحقق من **Network** — بعض المشاريع تقيّد عناوين IP

---

## بعد التعديل

1. أعد النشر (Redeploy) من Railway
2. افتح: `https://noorix-production.up.railway.app/api/v1/health`
3. تأكد: `dbConnected: true` و `adminExists: true`
4. جرّب الدخول: `admin@noorix.sa` / `123`
