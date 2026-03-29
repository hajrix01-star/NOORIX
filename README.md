# Noorix

واجهة React (Vite) + خلفية NestJS مع Prisma وPostgreSQL، مع عزل متعدد المستأجرين عبر RLS.

## المتطلبات

- Node.js 18+
- PostgreSQL (أو قاعدة متوافقة مع Prisma)

## التشغيل السريع

### الخلفية

```bash
cd backend
cp .env.example .env   # ثم عدّل DATABASE_URL و JWT_SECRET
npm install
npx prisma migrate deploy   # أو prisma migrate dev للتطوير
npm run build
npm run start:dev
```

الخادم الافتراضي: `http://localhost:3000` (يُضبط عبر `PORT` في `.env`).

### الواجهة (من جذر المستودع)

```bash
npm install
npm run dev
```

Vite الافتراضي: `http://localhost:5173`.

## أوامر مفيدة

| المجلد | الأمر | الوظيفة |
|--------|--------|---------|
| جذر المشروع | `npm run build` | بناء إنتاج الواجهة |
| جذر المشروع | `npm test` | Vitest |
| `backend/` | `npm run build` | تجميع Nest |
| `backend/` | `npm run prisma:studio` | استوديو Prisma |

## المتغيرات

راجع `backend/.env.example` لتعليقات `DATABASE_URL`، JWT، وGemini الاختياري.
