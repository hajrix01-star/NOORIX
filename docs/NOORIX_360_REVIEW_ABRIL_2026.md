# مراجعة تقرير 360° — Noorix (أبريل 2026)

**تشغيل التحويل (خطوات + اختبارات + GitHub + سجل):** [docs/NOORIX_TRANSFORMATION_PLAYBOOK.md](NOORIX_TRANSFORMATION_PLAYBOOK.md)

**الغرض:** تقييم كل بند في التقرير، ربطه بما وُجد في المستودع (عيّنات 2026-04)، خطة تطبيع مرحلية، وقوائم تحقق للتنفيذ وللجودة.

**هذا المستند = خطة إصلاح/تطبيع شاملة على مستوى احترافي** بمعنى: أولويات (P0–P3)، DRY، أمان بيانات، وحدود لأحجام الملفات — مع إدراك أن “الشمول” **لا** تعني دمج كل المهام في تذكرة واحدة؛ التنفيذ **على موجات (PR) صغيرة** يحفظ جودة المراجعة.

**الخطوات التالية (ترتيب التنفيذ):**
1. **إكمال P0** (انظر قسم 3) — الأمان والنظافة: عدم تتبّع `uploads/`, إخفاء تفاصيل 500 في الإنتاج, `JWT` من مصدر واحد, حذف `prisma` من واجهة `package.json` عند عدم الاستعمال, و(Volume/mount أو خطة S3) للمرفقات. هذا “السقف المؤسسي” الأدنى.
2. **P1** — DRY وسلامة: `extract-json.util`, تفعيل `OcrCorrectionRule` في `enrichExtraction`, dynamic import لكشف البنك, مراجعة كل `validateJournalBalance`.
3. **P2** — إزالة المكررات (تواريخ, `cacheHelper`) + `PartialType`/`CompanyId` على **دفعات** + فهارس + اختبارات ماليّة مستهدفة.
4. **P3** — TypeScript تدريجي, BullMQ, مراقبة, object storage, حدود API — حسب البنية.

**ميثاق الجودة والنظافة والحجم (PR):**
| محور | الالتزام |
|------|--------|
| **DRY** | `extractJson`, `JWT` — مصدر واحد؛ لا تكرار طويل لمنطق التواريخ. |
| **أمان** | عدم تسريب 500 تفصيلي للعميل في `production`؛ **لا** بيانات/مرفقات حقيقية داخل `git`. |
| **وحدة** | `invalidateQueries` ومسارات الـ API حسب [docs/FRONTEND_CENTRALIZATION_CHECKLIST.md](FRONTEND_CENTRALIZATION_CHECKLIST.md) عند الاقتباس. |
| **حجم الملف** | **هدف صارم: ≤ 450 سطر** لملف `*.service.ts` أو مكوّن “عملاق” — وإلا التقسيم **حسب المسؤولية** قبل ميزة جديدة. استثناء: قوائم `api` طويلة، DTOs ضخمة, `schema` — **وثّق** في الـ PR. |

**مرتبط بـ:** [docs/NOORIX_EXECUTION_PLAN.md](NOORIX_EXECUTION_PLAN.md) (التزامات سابقة 17/17), [docs/FRONTEND_CENTRALIZATION_CHECKLIST.md](FRONTEND_CENTRALIZATION_CHECKLIST.md) عند دمج الـ `invalidateQueries`.

---

## 1) جدل تقييمي لبنود التقرير (حرجة + متوسطة + تحسينات)

**مفتاح الحالة في الكود (عيّنات):**  
`✅ مُتحقق` = مؤكد في المسار الحالي | `⚠️ مُنقح` = المبدأ صحيح لكن تفصيل المسار/السطور اختلف | `⏳ لم يُفحص بالكامل` = يتطلب إثبات أوسع (عدد endpoints، RLS، إلخ)

| # | البند (ملخص) | حكم المبدأ | حالة المستودع (عيّنات) | تعليل مختصر |
|---|--------------|------------|-------------------------|------------|
| **نقاط القوة (إيجابي)** |
| S1 | LedgerEntry + double entry | ممتاز | ✅ (منسجم مع `financial-core` و`validateJournalBalance`) | قاعدة منطقية قوية للتوسع. |
| S2 | `FinancialCoreService` كمدخل | ممتاز | ⏳ | مبدأ “مدخل واحد” صحيح؛ يتطلب مراجعة أن لا يبقى أي مسار جانبي. |
| S3 | `$transaction` ذرّي | ممتاز | ✅ (أنماط `withTenant`/`$transaction` في الملفات المعروفة) | يلزم الاستمرار في مراجعات الـ PR. |
| S4 | Decimal.js | ممتاز | ✅ (backend + frontend `package.json`) | لا تخفف الدقة دون سبب. |
| S5 | RLS + Auth + guards + ValidationPipe + rate limit | ممتاز مبدئياً | ⏳ (أرقام 41 جدول / 218 endpoint = تحتاج سكريبت تدقيق) | **لا تعتمد على الأرقام دون توليد تلقائي من الكود/الـ DB**. |
| S6 | واجهة: tokens، RTL، PWA… | ممتاز كاتجاه | ⏳ | الاتساق مهم عند إضافة شاشات جديدة. |
| S7 | طبقة OCR (جداول، gemini، تطبيع) | ممتاز كتصميم | ✅ أجزاء من `ocr-invoices.service` | مازال `enrichExtraction` بدون `OcrCorrectionRule` (انظر [12]). |
| **🔴 حرجة** |
| 1 | ملفات HR حقيقية في `git` | **يجب عدم تتبع** بيانات حقيقية | ⚠️ المسار `backend/uploads/...` **غير وُجد** في المسح هنا؛ `.gitignore` **لا** يتضمّن `uploads/**` | المبدأ حرج دائماً: أضف `uploads` للـ ignore، `git rm --cached` لأي أثر، BFG لتاريخ قديم. |
| 2 | `uploads/` بلا VOLUME / mount | **صحيح للإنتاج** | ✅ `backend/Dockerfile` بدون `VOLUME` | الملفات داخل الـ image تُعاد بلا حجم ثابت؛ يلزم volume أو S3. |
| 3 | `prisma` + `@prisma/client` في فرونت | **صحيح** (زائد عن الحاجة) | ✅ `package.json` (الجذر) يتضمّمها | أزل من الواجهة إن لم تُستورد فعلياً. |
| 4 | `extractJson` مكرر ×3 | **صحيح** (DRY + BOM) | ✅ ثلاث دوال باسم واحد في `app.service` / `gemini.service` / `ocr-invoices.service` | ارفع `backend/src/common/utils/extract-json.util.ts` ووحّد (مع إزالة BOM). |
| 5 | `HttpExceptionFilter` يكشف `Error.message` | **جزئياً صحيح** | ⚠️ P2002/P2003 مُنقّحة؛ **أي خطأ `Error` آخر** يرسل `message` كما هو | عطّل الرسالة التفصيلية لـ 500 عند `NODE_ENV=production` (مع الإبقاء في السجلات). |
| **🟡 متوسطة** |
| 6 | `cacheHelper.js` ميّت | **مرجح صحيح** | ✅ `initGlobalCacheManager` في `main.jsx` | ربط بـ RQ persister أو إزالة لتقليل تعقيد. |
| 7 | `JWT_SECRET` مكرر ×4 | **صحيح** | ✅ نفس الـ fallback في 4 ملفات | `jwt.config.ts` مصدر واحد. |
| 8 | `getSaudiNow` / توحيد تاريخ | **مبدأ إيجابي** | ⏳ | `saudiDate.js` موجود؛ يُفضّل استيراد موحّد. |
| 9 | `bankStatementExportPrint` static `xlsx-js-style` | **صحيح** | ✅ `import XLSXmod from 'xlsx-js-style'` في الملف | حوّل لـ `import()` داخل دالة التصدير فقط. |
| 10 | `validateJournalBalance` “شكلية” | **مُنقح** | ⚠️ **مسارات الصرف الحالية (215، 343، 660)** تمرّر `total` مقابل `splits` | التقرير كان لنسخة قديمة؛ **راجع** باقي الاستدعاءات (مثلاً transfer 1236 يمرّر نفس المبلغ عمداً لأنها عملية 1:1). |
| 11 | `nowSaudi` مع `en-CA` | **مُنقح** | ✅ `date-utils.ts` يستعمل **`sv-SE`** ويوثّق السبب | **تمت المعالجة في الكود الحالي**؛ أعد فتح البند فقط إذا وُجد مسار تاريخ آخر. |
| 12 | `OcrCorrectionRule` لا يُقرأ في `enrichExtraction` | **صحيح** | ✅ `enrichExtraction` (من ~535) يبدأ بمورد/أصناف بدون `ocrCorrectionRule` | اقرأ `confirmed` rules وطبّق substitution قبل الـ match. |
| 13 | `useSales` loop + الداشبورد | **مرجح صحيح مبدئياً** | ⏳ | حل: endpoint مجمّع أو تقليل الحماية/إعادة استخدام `query` واحدة. |
| **تكرار و DTOs** |
| T1 | `PartialType` لـ 12 DTO | **مستحسن** (Nest) | ⏳ | يكسر التكرار بشرط أن `Create*Dto` يغطي الحقول. |
| T2 | `CompanyId` decorator | **مستحسن** | ⏳ | اختصر boilerplate الـ controller. |
| T3 | ملفات `cursorrules*.txt`، `build-out.txt` | **صحة مبدأ النظافة** | ⏳ | احذف الفارغ/artifacts + `.gitignore`. |
| **أداء/بنية** | تقسيم خدمات كبيرة، index على `LedgerEntry`، S3… | **اتجاه صحيح** | ⏳ / جزئي | ينفّذ تدريجياً حسب الضرورة بعد قياس. |
| **ما يتفق مع GPT (TS، تخزين، BullMQ…)** | **متوافق مع أفضل ممارسات** | — | **لا تعارض** — أولويات لاحقة بعد الأمان/البيانات. |

---

## 2) خطة تطبيع (ما نعتبره “صحيحاً” بعد المراجعة)

### أولوية P0 — **فوري** (أيام/ساعات)
1. **نظافة المستودع:** `uploads/**` (وأي `backend/uploads/**`) في `.gitignore`؛ `git rm -r --cached` لأي ملف مرفوع؛ **rotate** أي مفاتيح/بيانات لو كانت مكشوفة.
2. **مفاتيح/أسرار:** وضع `JWT_SECRET` في مصدر واحد + التأكد من عدم الاعتماد على fallback في الإنتاج.
3. **واجهة + أخطاء:** تقليل تسريب رسائل 500 في الإنتاج (مع إبقاء `logger` كاملاً).
4. **اعتماديات الواجهة:** إزالة `prisma` / `@prisma/client` من `package.json` الروت إن لم تُستخدَما.
5. **نشر/ملفات:** VOLUME أو mount سحابي لـ `uploads` + خطة **Medium-term** تخزين سحابي (S3/B2) كما في التقرير.

### P1 — **هذا الأسبوع/الأسبوعين**
1. `extract-json.util.ts` + استبدال الثلاث نسخ.
2. `OcrCorrectionRule` داخل `enrichExtraction` (تطبيق `wrongText` → `correctText` لأسماء المورد/الأصناف قبل الـ match).
3. `bankStatementExportPrint.js` → `import()` ديناميكي.
4. مراجعة `HttpExceptionFilter` كاملة لـ 500s غير معروفة.
5. **إعادة تحقق** من `validateJournalBalance` عبر **جميع** الاستدعاءات (بما فيها inflow) وليس فقط سطور التقرير.

### P2 — **هذا الشهر**
1. `cacheHelper` إمّا تفعيله أو حذفه.
2. توحيد تواريخ `getSaudiToday` / إزالة التكرار.
3. `PartialType` + (اختياري) `CompanyId` decorator على دفعات صغيرة مع PRs منفصلة.
4. فهارس DB حسب `EXPLAIN` الفعلي (مثال مقترح في التقرير: مركب على `LedgerEntry`).
5. تدريجي: اختبارات `financial-core` الحرجة.

### P3 — **مستقبلاً**
- TypeScript للواجهة (مجلدات `utils`/`hooks`)، BullMQ لـ OCR، Sentry/Datadog، object storage، حدود استخدام Gemini.

**حدود الملفات (مواءمة مع “ميثاق” الأعلى)**
- **هدف الخدمة/المكوّن الثقيل: ≤ 450 سطر**؛ **إن جاوز 600** يُعامل كمؤشر “قصّ” قريب. التقسيم: OCR (استخراج/تسعير/كتالوج)؛ HR (تفرعات)؛ مالي (outflow/inflow/transfer).
- **Controller في الغالب يبقى نحيفاً**؛ اختصر `PartialType` و`CompanyId` تدريجياً.
- **Hooks (Git) مختصرة:** `lint-staged` + منع `console.log` في `src`؛ اختياري: منع `uploads/` و`*.xlsx` تحت `backend/uploads`. **أمران–ثلاثة** تكفي لمعظم النظافة.

---

## 3) Checklist — تنفيذ (Owner / مبرمج)

| # | فعل | تم؟ | ملاحظة |
|---|-----|-----|--------|
| P0-1 | `uploads` في `.gitignore` + إزالة تتبّع من Git | ☐ | |
| P0-2 | VOLUME أو docker-compose mount لـ `/app/uploads` (أو قرار S3) | ☐ | |
| P0-3 | `npm` root: حذف prisma إن زائد + `npm install` | ☐ | |
| P0-4 | `jwt.config.ts` + env إلزامي في prod | ☐ | |
| P0-5 | `HttpExceptionFilter` إخفاء 500 details في `production` | ☐ | |
| P1-1 | `extract-json.util.ts` + استيراد لثلاثة | ☐ | |
| P1-2 | `OcrCorrectionRule` في `enrichExtraction` | ☐ | |
| P1-3 | dynamic import في `bankStatementExportPrint` | ☐ | |
| P1-4 | تدقيق كل `validateJournalBalance` (قراءة نصية) | ☐ | |
| P2-1 | قرار `cacheHelper` (حذف أو ربط) | ☐ | |

---

## 4) Checklist — تحقق جودة ومهنية (مراجعة ثانية / QA)

| # | سؤال | معيار "نجاح" |
|---|--------|----------------|
| Q1 | هل بقي أي `uploads` مُتعقّب؟ | `git ls-files \| rg uploads` فارغ. |
| Q2 | هل 500 في prod مُبهمة للعميل؟ | رسالة عامة؛ التفاصيل فقط في logs. |
| Q3 | هل bundle الواجهة؟ | لا `@prisma/client` من الواجهة. |
| Q4 | JSON من Gemini؟ | BOM يُتعامل معه في **دالة واحدة** مختبرة. |
| Q5 | OCR؟ | قواعد تصحيح `confirmed` تغيّر الأسماء **قبل** الـ match. |
| Q6 | مالي؟ | أي تغيير بـ `financial-core` يرافقه اختبار أو تدقيق سيناريو يدوي موثق. |
| Q7 | حجم PR؟ | تقسيم حسب T1/T2: ملفات قليلة/موضوع واحد. |

---

**آخر تحديث المستند:** 2026-04-26 — يُنصح بربطه بسطر في CHANGELOG عند اكتمال P0.
