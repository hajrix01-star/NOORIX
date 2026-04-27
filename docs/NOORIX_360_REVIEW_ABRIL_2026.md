# مراجعة تقرير 360° — Noorix (أبريل 2026)

**تشغيل التحويل (خطوات + اختبارات + GitHub + سجل):** [docs/NOORIX_TRANSFORMATION_PLAYBOOK.md](NOORIX_TRANSFORMATION_PLAYBOOK.md)

**الغرض:** تقييم كل بند في التقرير، ربطه بما وُجد في المستودع (عيّنات 2026-04)، خطة تطبيع مرحلية، وقوائم تحقق للتنفيذ وللجودة.

**هذا المستند = خطة إصلاح/تطبيع شاملة على مستوى احترافي** بمعنى: أولويات (P0–P3)، DRY، أمان بيانات، وحدود لأحجام الملفات — مع إدراك أن “الشمول” **لا** تعني دمج كل المهام في تذكرة واحدة؛ التنفيذ **على موجات (PR) صغيرة** يحفظ جودة المراجعة.

**مسار `toYmd` — مغلق (2026-04-27):** واجهة (`saudiDate.ts`) + خادم (`to-ymd.util.ts`) + اختبارات + قاعدة Cursor — [date-ymd-helpers.mdc](../.cursor/rules/date-ymd-helpers.mdc). لا تذاكر جديدة إلا عند إضافة مسار تاريخ يخرج عن القاعدة الموثّقة.

**الخطوات التالية (ترتيب التنفيذ):**
1. **إكمال P0** (انظر قسم 3) — الأمان والنظافة: عدم تتبّع `uploads/`, إخفاء تفاصيل 500 في الإنتاج, `JWT` من مصدر واحد, حذف `prisma` من واجهة `package.json` عند عدم الاستعمال, و(Volume/mount أو خطة S3) للمرفقات. هذا “السقف المؤسسي” الأدنى.
2. **P1** — DRY وسلامة: `extract-json.util`, تفعيل `OcrCorrectionRule` في `enrichExtraction`, dynamic import لكشف البنك, مراجعة كل `validateJournalBalance`.
3. **P2** — إزالة المكررات (تواريخ عبر **`toYmd`** …) + `cacheHelper` + `PartialType`/`CompanyId` + فهارس `LedgerEntry` — **مُغلق في §3** (بما فيه مسار **`toYmd`** بالكامل).
4. **P3** — خط الأساس في الكود: طابور Bull لـ OCR، `ThrottlerModule`، حد التزامن لـ Gemini، متغيرات بيئة للمراقبة/التخزين — انظر §3 (P3-1…P3-4) و`backend/.env.example`.

**ما بعد إغلاق 360 ومسار التواريخ — موجات تطوير مقترحة (ليست P0–P3):**
1. **ميثاق حجم الملفات:** عند تغيير خدمة ثقيلة (`*.service.ts` أو ما يعادلها)، التقسيم نحو ≤450 سطر حيث ينطبق — مثال معروف: `financial-core.service.monolith.ts` (يُقسَّم عند أول تغيير جوهري، لا «حذفاً فورياً» دون حاجة).
2. **الواجهة:** [FRONTEND_CENTRALIZATION_CHECKLIST.md](FRONTEND_CENTRALIZATION_CHECKLIST.md) — عند إضافة مفاتيح React Query مالية جديدة، وسّع `invalidateOnFinancialMutation` في `src/utils/queryInvalidation.ts` (مثال 2026-04-27: كشوف بنك + `owner-daily-sales`)؛ راجع [PERFORMANCE_AND_DATA.md](PERFORMANCE_AND_DATA.md) ودليل التشغيل [REPOSITORY_MAINTENANCE_RUNBOOK.md](REPOSITORY_MAINTENANCE_RUNBOOK.md).
3. **اختياري (تشغيل):** `SENTRY_DSN`، تخزين مرفقات سحابي (S3/B2) — عند جاهزية البنية؛ متغيرات في `.env` دون كسر التشغيل الحالي.

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
| S2 | `FinancialCoreService` كمدخل | ممتاز | ✅ إنشاء/تحديث القيود عبر `financial-core` (`processOutflow`، `processInflow`، `processTransfer`، `cancelOperation`، إعادة بناء القيود)؛ مزامنة `transaction_date` للفواتير عبر `syncActiveLedgerTransactionDateForOutflowInvoice` من `invoice.service`. **استثناء موثّق:** `backup-logical-import.service` (استيراد لقطة منطقية). | عند مسار مالي جديد يجب أن يمر بالمحرك أو يُوثَّق الاستثناء. |
| S3 | `$transaction` ذرّي | ممتاز | ✅ (أنماط `withTenant`/`$transaction` في الملفات المعروفة) | يلزم الاستمرار في مراجعات الـ PR. |
| S4 | Decimal.js | ممتاز | ✅ (backend + frontend `package.json`) | لا تخفف الدقة دون سبب. |
| S5 | RLS + Auth + guards + ValidationPipe + rate limit | ممتاز مبدئياً | ✅ `prisma/rls_setup.sql` + `tenantId` على النماذج؛ `ThrottlerModule` في `app.module.ts`؛ تدقيق تلقائي: `npm run audit:http-surface` في `backend` (يُخرج عدد controllers ومسارات HTTP تقريبية وعدد نماذج Prisma). | أعد تشغيل السكربت بعد إضافة وحدات كبيرة؛ RLS يتطلب تطبيق SQL على الـ DB. |
| S6 | واجهة: tokens، RTL، PWA… | ممتاز كاتجاه | ✅ تصميم Noorix: `src/constants/kpiCardTheme`، `src/ui`، `useUiDir`، i18n؛ شاشات جديدة — قواعد المشروع تحت `.cursor/rules/` (ألوان، استجابة، مكوّنات). | مراجعة بصرية عند تغييرات UI كبيرة. |
| S7 | طبقة OCR (جداول، gemini، تطبيع) | ممتاز كتصميم | ✅ `ocr-extraction.service` — `applyCorrections` قبل مطابقة المورد/الأصناف | يُراجع مع كل تغيير على مسار الاستخراج. |
| **🔴 حرجة** |
| 1 | ملفات HR حقيقية في `git` | **يجب عدم تتبع** بيانات حقيقية | ✅ `backend/uploads/` في `.gitignore`؛ لا تتبّع تحت `git ls-files` (انظر §3 P0-1) | عند تسرّب تاريخي: `filter-repo` / BFG + تدوير مفاتيح. |
| 2 | `uploads/` بلا VOLUME / mount | **صحيح للإنتاج** | ✅ `VOLUME ["/app/uploads"]` في `Dockerfile` + توثيق النشر | الملفات داخل الـ image بدون mount تُفقد عند إعادة النشر؛ ربط volume أو S3. |
| 3 | `prisma` + `@prisma/client` في فرونت | **صحيح** (زائد عن الحاجة) | ✅ لا `prisma` / `@prisma/client` في `package.json` جذر الواجهة (2026-04-27). | لا تُعاد إضافتهما دون استعمال فعلي في الواجهة. |
| 4 | `extractJson` مكرر ×3 | **صحيح** (DRY + BOM) | ✅ `extract-json.util.ts` + استيراد في `app.service` / `gemini.service`؛ مسار OCR طويل عبر `ocr-llm-json.util.ts`. | أي مسار LLM جديد يعيد استخدام نفس الأدوات. |
| 5 | `HttpExceptionFilter` يكشف `Error.message` | **جزئياً صحيح** | ✅ `http-exception.filter.ts`: في `production` — `Error` عام غير Prisma → رسالة عامة؛ Prisma غير P2002/3 → «خطأ في قاعدة البيانات»؛ التفاصيل في `logger`. | راجع أي `HttpException` يدوي لا يكشف أسراراً. |
| **🟡 متوسطة** |
| 6 | `cacheHelper.js` ميّت | **مرجح صحيح** | ✅ `initGlobalCacheManager` في `main.jsx` | ربط بـ RQ persister أو إزالة لتقليل تعقيد. |
| 7 | `JWT_SECRET` مكرر ×4 | **صحيح** | ✅ `jwt.config.ts` (`getJwtSecret`، `JWT_DEV_FALLBACK`)؛ التوقيع في `AuthModule` يقرأ `JWT_DEV_FALLBACK` من نفس الملف؛ التحقق الإلزامي في prod في `main.ts` / `AuthModule`. | لا تُعرّف fallback جديداً خارج `jwt.config.ts`. |
| 8 | `getSaudiNow` / توحيد تاريخ | **مبدأ إيجابي** | ✅ `toYmd` في الواجهة (`saudiDate.ts`) وفي الخادم (`backend/src/common/utils/to-ymd.util.ts`)؛ **`apiEndpoints`:** `sales-summaries`، `invoices`، `connection-bank`، `reports`، `accounts-categories-expense`، `hr`؛ خدمات Nest رئيسية (مبيعات، فواتير، بنك، تقارير فترة، خزائن، HR، OCR، Gemini metadata). | `toYmd` للنصوص ولمفاتيح الـ API؛ `Date` يُعامل يوم UTC (مثل الخادم). لحقول التقويم بتوقيت الرياض: `toDateInputYmd` في الواجهة. |
| 9 | `bankStatementExportPrint` static `xlsx-js-style` | **صحيح** | ✅ `await import('xlsx-js-style')` داخل دوال التصدير (`bankStatementExportPrint.ts`). | — |
| 10 | `validateJournalBalance` “شكلية” | **مُنقح** | ✅ تدقيق 2026-04-27: الصرف يقارن `totalAmount` بمجموع `splits`؛ الإيراد يقارن قنوات الخزنة بـ net+ضريبة لكل قناة؛ التحويل 1:1 (مدين/دائن بنفس المبلغ). | عند مسار مالي جديد أضف استدعاءً صريحاً + اختباراً إن أمكن. |
| 11 | `nowSaudi` مع `en-CA` | **مُنقح** | ✅ `date-utils.ts` يستعمل **`sv-SE`** ويوثّق السبب | **تمت المعالجة في الكود الحالي**؛ أعد فتح البند فقط إذا وُجد مسار تاريخ آخر. |
| 12 | `OcrCorrectionRule` لا يُقرأ في `enrichExtraction` | **صحيح** | ✅ `applyCorrections` قبل مطابقة المورد/الأصناف (`ocr-extraction.service.ts`) | يُراجع عند إضافة قواعد أو تغيير المطابقة. |
| 13 | `useSales` loop + الداشبورد | **مرجح صحيح مبدئياً** | ✅ `useDashboardSalesPack` + `GET .../summaries/dashboard-pack`؛ **تقويم الداشبورد** و**تبويب مبيعات التطبيقات** يستخدمان الحزمة (طلب واحد) بدل حلقة pagination من `useSales`. | `DailySalesScreen` يبقى على `useSales` (تحويلات + ترقيم). |
| **تكرار و DTOs** |
| T1 | `PartialType` لـ 12 DTO | **مستحسن** (Nest) | ✅ دفعات C1/C2 في playbook (2026-04-26)؛ `UpdateInvoiceDto` وغيره يبقى صريحاً حيث تختلف القواعد عن `Create*` (أنواع kind، `vaultSplits`، حقول ضمان…). | يكسر التكرار عندما يتطابق شكل التحديث مع الإنشاء. |
| T2 | `CompanyId` decorator | **مستحسن** | ✅ مستخدم في مسارات متعددة (`hr`، `vaults`، `invoice`، `orders`، `ocr-invoices`، …) | أي endpoint جديد يفضّل `@CompanyId()` بدل تكرار `@Query('companyId')`. |
| T3 | ملفات `cursorrules*.txt`، `build-out.txt` | **صحة مبدأ النظافة** | ✅ `build-out.txt` و`cursorrules*.txt` في `.gitignore` جذر المستودع (2026-04-27). | احذف أي artifact محلي ظاهر في `git status`. |
| **أداء/بنية** | تقسيم خدمات كبيرة، index على `LedgerEntry`، S3… | **اتجاه صحيح** | ✅ فهارس `LedgerEntry` في `schema.prisma` (tenant، company+date، referenceType+referenceId، vault، employee…)؛ تقسيم الخدمات جزئي؛ S3 لاحقاً. | قياس `EXPLAIN` عند بطء تقارير محددة. |
| **ما يتفق مع GPT (TS، تخزين، BullMQ…)** | **متوافق مع أفضل ممارسات** | ✅ طابور Bull لاستخراج OCR؛ حدود Gemini عبر `GEMINI_MAX_CONCURRENT`؛ `strict` في الواجهة؛ S3/Sentry تبقى اختيارية عبر البيئة (§3 P3). | تفعيل Sentry/Object storage عند جاهزية البنية. |

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
5. **إعادة تحقق** من `validateJournalBalance` — **مُنجَز** تدقيق 2026-04-27 (انظر §3 P1-4 + JSDoc على الدالة)؛ أعد فتحه عند تغيير `financial-core`.

### P2 — **هذا الشهر**
1. `cacheHelper` إمّا تفعيله أو حذفه.
2. توحيد تواريخ `getSaudiToday` / إزالة التكرار.
3. `PartialType` + (اختياري) `CompanyId` decorator على دفعات صغيرة مع PRs منفصلة.
4. فهارس DB حسب `EXPLAIN` الفعلي (مثال مقترح في التقرير: مركب على `LedgerEntry`).
5. تدريجي: اختبارات `financial-core` الحرجة.

### P3 — **خط الأساس + اختياري لاحقاً**
- **الواجهة:** TypeScript `strict` في الجذر (2026-04-27).
- **OCR:** `@nestjs/bull` + Redis + `ocr-extraction.processor.ts` (طابور استخراج).
- **حدود API:** `ThrottlerModule` (120/دقيقة لكل IP) في `app.module.ts`.
- **Gemini:** حد التزامن `GEMINI_MAX_CONCURRENT` (افتراضي 2) في `gemini.service.ts`.
- **اختياري:** `SENTRY_DSN`، تخزين كائنات S3/B2 — عند التشغيل أضف المتغيرات في `.env` فقط دون كسر التشغيل الحالي.

**حدود الملفات (مواءمة مع “ميثاق” الأعلى)**
- **هدف الخدمة/المكوّن الثقيل: ≤ 450 سطر**؛ **إن جاوز 600** يُعامل كمؤشر “قصّ” قريب. التقسيم: OCR (استخراج/تسعير/كتالوج)؛ HR (تفرعات)؛ مالي (outflow/inflow/transfer).
- **Controller في الغالب يبقى نحيفاً**؛ اختصر `PartialType` و`CompanyId` تدريجياً.
- **Hooks (Git) مختصرة:** `lint-staged` + منع `console.log` في `src`؛ اختياري: منع `uploads/` و`*.xlsx` تحت `backend/uploads`. **أمران–ثلاثة** تكفي لمعظم النظافة.

---

## 3) Checklist — تنفيذ (Owner / مبرمج)

| # | فعل | تم؟ | ملاحظة |
|---|-----|-----|--------|
| P0-1 | `uploads` في `.gitignore` + إزالة تتبّع من Git | ☑ | `backend/uploads/` في `.gitignore`؛ `git ls-files` لا يُرجع uploads (2026-04-27). |
| P0-2 | VOLUME أو docker-compose mount لـ `/app/uploads` (أو قرار S3) | ☑ | `backend/Dockerfile`: `VOLUME ["/app/uploads"]`؛ توثيق VPS في `DEPLOYMENT.md` § المرفقات (2026-04-27). |
| P0-3 | `npm` root: حذف prisma إن زائد + `npm install` | ☑ | لا `prisma` في `package.json` جذر الواجهة (2026-04-27). |
| P0-4 | `jwt.config.ts` + env إلزامي في prod | ☑ | `backend/src/config/jwt.config.ts` + فحص `main.ts` / `AuthModule` (2026-04-27). |
| P0-5 | `HttpExceptionFilter` إخفاء 500 details في `production` | ☑ | `http-exception.filter.ts`: Prisma غير P2002/3 والأخطاء العامة مُبهَمة في prod (2026-04-27). |
| P1-1 | `extract-json.util.ts` + استيراد لثلاثة | ☑ | `extract-json.util.ts`؛ `app.service` + `gemini.service`؛ OCR يستخدم `ocr-llm-json.util` للنصوص الطويلة (2026-04-27). |
| P1-2 | `OcrCorrectionRule` في `enrichExtraction` | ☑ | `ocr-extraction.service.ts` — `applyCorrections` قبل مطابقة المورد/الأصناف (2026-04-27). |
| P1-3 | dynamic import في `bankStatementExportPrint` | ☑ | `bankStatementExportPrint.ts` — `await import('xlsx-js-style')` (2026-04-27). |
| P1-4 | تدقيق كل `validateJournalBalance` (قراءة نصية) | ☑ | **2026-04-27:** `financial-outflow.service` (إنشاء فاتورة، دفعة، `_replaceOutflowInvoiceLedgerAndAllocations`)؛ `financial-inflow.service` (إنشاء/تحديث ملخص مبيعات)؛ `financial-transfer.service` (تحويل). JSDoc على الدالة في `financial-core-helpers.util.ts`؛ اختبارات في `financial-core-helpers.util.spec.ts`. **يُعاد** التدقيق عند أي تغيير على هذه الملفات. |
| P2-1 | قرار `cacheHelper` (حذف أو ربط) | ☑ | لا مراجع `cacheHelper` في `src/`؛ الهجرة ضمن دفعة A+B (2026-04-26). |
| P2-2 | فهارس `LedgerEntry` | ☑ | `backend/prisma/schema.prisma` — مركّبات على `companyId+transactionDate`، `companyId+status+transactionDate`، `referenceType+referenceId`، إلخ (2026-04-27). |
| P2-3 | `PartialType` / `CompanyId` على دفعات | ☑ | انظر playbook §6 (C1/C2 + decorators)؛ استثناءات صريحة حيث يختلف التحقق عن `Create*Dto`. |
| P2-4 | artifacts في `.gitignore` | ☑ | `build-out.txt`، `cursorrules*.txt` (2026-04-27). |
| P2-5 | `toYmd` — API + واجهات + خادم | ☑ | **`apiEndpoints/`:** بلا `slice(0,10)` للتواريخ. **واجهة:** دفعة إضافية (تقارير تفصيلية، مسيرات، وثائق موظف، استيراد/تصدير، مالك، كشوف بنك، يومية، إقامة، EOS، طباعة HR، إلخ) — انظر سجل playbook 2026-04-27. **خادم:** `to-ymd.util.ts` + استبدال في `sales`/`invoice`/`bank-statements`/`reports-period-analytics`/`vaults`/`expense-line`/`company-assets`/`hr-*`/`ocr-invoice-workflow-persist`/`gemini`/`fiscal-period`/`financial-outflow` + `bank-statement-row-parser`؛ `clampSalesSummaryDateQuery` يستخدم `toYmd` في `addDaysYmd`. **اختبارات:** `to-ymd.util.spec.ts` (jest) + `saudiDate.test.ts` (vitest، `toYmd` + trim + `Date`). **تمييز:** يوم الرياض للحقول البشرية — `toDateInputYmd`؛ `toYmd(Date)` = UTC (مواءمة الخادم). |
| P3-1 | Bull طابور OCR + Redis | ☑ | `OcrInvoicesModule` + `ocr-intake.service` + `ocr-extraction.processor`؛ `REDIS_*` في `backend/.env.example`. |
| P3-2 | Rate limit HTTP | ☑ | `ThrottlerModule.forRoot` في `backend/src/app.module.ts`. |
| P3-3 | حد تزامن Gemini | ☑ | `GEMINI_MAX_CONCURRENT` — `gemini.service.ts` (`withGeminiConcurrency`). |
| P3-4 | تدقيق سطح HTTP / أرقام ديناميكية | ☑ | `npm run audit:http-surface` — `backend/scripts/audit-http-surface.mjs`. |

---

## 4) Checklist — تحقق جودة ومهنية (مراجعة ثانية / QA)

| # | سؤال | معيار "نجاح" |
|---|--------|----------------|
| Q1 | هل بقي أي `uploads` مُتعقّب؟ | `git ls-files \| rg uploads` فارغ. |
| Q2 | هل 500 في prod مُبهمة للعميل؟ | رسالة عامة؛ التفاصيل فقط في logs. |
| Q3 | هل bundle الواجهة؟ | لا `@prisma/client` من الواجهة. |
| Q4 | JSON من Gemini؟ | BOM يُتعامل معه في **دالة واحدة** (`extract-json.util.ts`) + اختبارات `extract-json.util.spec.ts`. |
| Q5 | OCR؟ | قواعد تصحيح `confirmed` تغيّر الأسماء **قبل** الـ match. |
| Q6 | مالي؟ | أي تغيير بـ `financial-core` يرافقه اختبار (`financial-core-helpers.util.spec.ts`) أو تدقيق سيناريو يدوي موثق. |
| Q7 | حجم PR؟ | تقسيم حسب T1/T2: ملفات قليلة/موضوع واحد. |
| Q8 | أرقام endpoints/جداول في التقارير؟ | `cd backend && npm run audit:http-surface` — لا تنسخ أرقاماً يدوية قديمة. |

---

**حالة الوثيقة (2026-04-27):** **مكتملة** — جميع صفوف §1 مُحدَّثة؛ §2 متوافقة؛ §3 (P0–P3) ☑؛ §4 (Q1–Q8) معايير نجاح مغطاة في الكود أو بأدوات تلقائية؛ **مسار `toYmd` مغلق** (انظر الفقرة تحت عنوان المستند). أي تغيير لاحق على المسارات الحرجة (مالي، OCR، RLS) يُحدَّث هذا الملف أو playbook §6. راجع [NOORIX_TRANSFORMATION_PLAYBOOK](NOORIX_TRANSFORMATION_PLAYBOOK.md) §6 للسجل التفصيلي.
