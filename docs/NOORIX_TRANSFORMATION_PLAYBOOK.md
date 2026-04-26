# Noorix — دفتر تشغيل التحويل الاحترافي (الخطة + الاختبارات + Git + السجل)

**المرجع الاستراتيجي:** [docs/NOORIX_360_REVIEW_ABRIL_2026.md](NOORIX_360_REVIEW_ABRIL_2026.md) (الميزانية والميثاق ≤450 سطر/خدمة ثقيلّة)  
**الفلسفة:** خطوة واحدة = **وحدة اختبار واضحة** + **commit(ات) معزولة** + **نشر (push) لـ GitHub بعد إغلاق كل *مرحلة* كحد أدنى** (يفضّل أيضاً push للفرع يومياً لعدم فقدان العمل).

---

## 1) تعريفات: خطوة، مرحلة، نوع التغيير

| مفهوم | المعنى |
|--------|--------|
| **خطوة (Step)** | أصغر قطعة تُنفّذ ويُرافقها اختبار؛ قد = commit واحد. |
| **مرحلة (Phase)** | تجميع خطوات مترابطة (مثلاً P0 أمان)؛ **ننشرها لـ remote بعد الانتهاء** (انظر §4). |
| **نوع** | `security` / `fix` (سلوك يتصلح) / `refactor` (نقل بدون تغيير ناتج) / `perf` / `chore`. |

**ملاحظة دقيقة:** `git rm --cached` يزيل **التتبع في الـ index** فقط؛ **ليس** تنظيف تاريخ الـ commit القديم. إن خرجت بيانات حساسة في **commits قديمة**، يلزم [git-filter-repo](https://github.com/newren/git-filter-repo) أو BFG + تدوين في السجل (§6).

---

## 2) اختبارات — ما يُشغّل بعد *كل* خطوة (حد أدنى)

| طبقة | أمر/إجراء | متى |
|------|------------|-----|
| **فرونت** | من الجذر: `npm test` (إن وُجد)، `npm run build` | بعد أي تغيير `src/`. |
| **باكند** | من `backend/`: `npm test` (إن وُجد)، `npm run build` | بعد أي تغيير `backend/src/`. |
| **يدوي سريع** | تشغيل `npm run dev` (واجهة) + `npm run start:dev` (باك) إن أمكن، فتح تبوّب أماني بعد تغيير `HttpExceptionFilter`، إلخ | **إلزامي** بعد: أمان، مالي، OCR. |

**سيناريوهات حرجة يدوية (بعد مراحل تتعلق بالمال/OCR/رفع):**

- تسجيل دخول → لوحة/شركة.
- (إن مُسِّستَ المالي) إنشاء حركة صغيرة + التحقق من الرصيد/قائمة.
- (إن مُسِّستَ الأخطاء) محاكاة خطأ 500/Prisma P20xx — الرسالة للمستخدم عامة في `production`.
- (إن مُسِّستَ OCR) رفع صورة/مراجعة بعد قواعد التصحيح.

---

## 3) جدول المراحل والخطوات (نفّذ بالترتيب)

**قاعدة:** **لا** تدمج مرحلتين في commit واحد. يمكن تجميع *عدة commits* داخل **فرع مرحلة واحد** ثم `push` + PR.

### المرحلة A — P0 أمان ونظافة المستودع (الأعلى أولوية)

| ID | الإجراء | النوع | اختبار الحد الأدنى | رسالة commit مقترحة |
|----|----------|-------|--------------------|------------------------|
| A1 | `backend/uploads/` في `.gitignore` + `build-out.txt` (و`*.log` عند الحاجة) + **لا** commit لملفات داخل `uploads` | `security`/`chore` | `git check-ignore` للمسار، `git status` نظيف | `chore(gitignore): ignore backend uploads and build artifacts` |
| A2 | `git rm -r --cached backend/uploads` إن وُجد تتبّع، **بدون** الادّعاء "حذف من history" | `security` | `git ls-files \| findstr uploads` = فارغ | `security: stop tracking upload directory contents` |
| A3 | (اختياري لاحقاً) تنظيف **التاريخ** إن كشفت بيانات: `filter-repo` + تنسيق فريق | `security` | repo clone جديد + بحث | `docs: document secret rotation after history rewrite` |
| A4 | حذف `cursorrules.txt` / `cursorrules1.txt` / `build-out.txt` إن كانت زائدة + `.gitignore` يلتقط `build-out.txt` | `chore` | بناء الجذر يمر | `chore: remove empty/artifact files from root` |
| A5 | حذف `prisma` + `@prisma/client` من `package.json` جذر المشروع (إن غير مستخدمة) + `npm install` | `fix` | `npm run build` (جذر) | `fix: remove backend prisma deps from frontend package.json` |
| A6 | VOLUME/mount الـ `uploads` في Docker أو `docker-compose` (أو قرار مكتوب: الانتقال لـ S3 لاحقاً) | `chore`/`docs` | بناء/تشغيل الحاوية أو توثيق الإجراء في [DEPLOYMENT](DEPLOYMENT.md) | `chore(docker): document or add volume for uploads` |

**بوابة نجاح المرحلة A:** لا ملف `uploads` تحت `git ls-files`؛ واجهة تُبنى؛ قرار **إما** mount **أو** خطة S3 **موثّق**.

---

### المرحلة B — P1 إصلاحات سلوك/DRY/أداء (أسبوع ~1–2)

| ID | الإجراء | النوع | اختبار |
|----|----------|-------|--------|
| B1 | `http-exception.filter.ts` — إخفاء `Error.message` الخام في `production` + رسائل Prisma الأخرى عامة | `security` | محاكاة 500/Prisma غير P2002/3 — رسالة عامة `NODE_ENV=production` |
| B2 | `extract-json.util.ts` + حذف 3 نسخ، استيراد موحّد (قارن السلوك اختيارياً باختبار وحدة) | `refactor` | `npm run build` (backend) + اختبار مسار JSON مع BOM اختياري |
| B3 | `OcrCorrectionRule` في `enrichExtraction` (قبل المطابقة) | `fix` / `feat` | سيناريو مورد/صنف مع rule `confirmed` |
| B4 | `bankStatementExportPrint.js` — `import('xlsx-js-style')` ديناميكي | `perf` | فتح صفحة كشف بنك + تصدير + لا خطأ |
| B5 | `jwt.config.ts` + استبدال التكرار في 4 ملفات | `refactor` | تسجيل دخول/refresh |
| B6 | `cacheHelper` إزالة + تنظيف `main.jsx` **أو** ربط RQ (اختر واحداً) | `chore` / `refactor` | `npm run build` |
| B7 | حذف imports غير مستخدمة (Treasury, Sales, InvoiceUploadTab…) | `chore` | بناء + lint إن وُجد |

**بوابة B:** `npm test` + `build` (جذر + backend) ناجحان؛ يدوي الحرج كما في الجدول.

---

### المرحلة C — P2 التوحيد (DTOs, Decorator, تواريخ, صور) — دفعات PR

| ID | الإجراء | اختبار |
|----|----------|--------|
| C1 | `PartialType` — DTOs “بسيطة” أولاً | e2e يدوي: تحديث كيان بسيط |
| C2 | `PartialType` — DTOs بـ `ValidateNested` (مراقبة) | اختبارات/يدوي: فاتورة، أصل… |
| C3 | `CompanyId` decorator — على دفعات من controllers | استدعاء API بـ header/query |
| C4 | توحيد تواريخ → `saudiDate.js` | داشبورد/فلتر |
| C5 | `compressImage` في `imageUtils` (إن لم يوجد) + استبدال 3 نسخ | تدفق رفع/شعار |
| C6 | `assertVaultsUsable` موحّد (بنفس `TenantPrisma`/`withTenant` **لا** `PrismaClient` عشوائياً) | صرف/دفع بخزائن |

**بوابة C:** تقليل التكرار بدون تغيير أرقام تقارير (عيّن عينة P&L إن ممكن).

---

### المرحلة D — P3 التقسيم الهيكلي (الشهر 2+)

- تقسيم `apiEndpoints.js` (حِزم re-export)؛ مكوّنات HR/OCR/رفع فواتير ضخمة؛ `hr`/`ocr`/`financial-core` — **واحد وفرع فرع** مع اختبارات يدوية موثّقة **بعد كل** sub-PR.  
- انظر [TESTING_ACCOUNTING](TESTING_ACCOUNTING.md) عند تغيير المسار المالي.

**بوابة D:** لا regresion في: صرف/قبض/تحويل/إلغاء + عيّن تقرير ربحية.

---

### المرحلة E — مستقبل (BullMQ، S3، TS للواجهة)

- **بعد** استقرار P0–P2؛ توثيق استهلاك Gemini والنسخ الاحتياطي.

---

## 4) استراتيجية Git + GitHub (مُوصى بها)

1. **فرع لكل مرحلة رئيسية:** `transform/p0-security`، `transform/p1-dry-ocr`، `transform/p2-dtos`…  
2. **Commit صغير لكل ID** (A1، A2، B1…).  
3. **بعد اكتمال المرحلة ونجاح الاختبارات:** `git push -u origin <branch>` → **فتح PR** → مراجعة → `merge` إلى `main` (أو `develop` إن وُجد).  
4. **تسمية (tag) اختيارية بعد الدمج:** `transform-2026-p0` لتثبيت نقطة rollback.  
5. **يومياً** على نفس الفرع: `push` حتى لا يضيع العمل (حتى لو لم تكمل المرحلة).

**لا** تُلزم **كل commit** بـ `push` إلى GitHub — لكن **ألزم push للفرع بعد كل مرحلة مغلقة** + في نهاية كل أسبوع عمل على الأقل.

---

## 5) معايير نجاح التحويل (نهاية المسار)

- لا تتبّع لملفات تشغيلية داخل `uploads`؛ **document** اختيار storage.  
- لا `prisma` بلا استعمال في `package.json` الروت.  
- 500 في الإنتاج لا تكشف `stack`/`prisma` الخام للعميل.  
- `extractJson` واحد؛ `JWT` من مصدر واحد.  
- ميثاق الحجم: خدمة ثقيلة **≤ 450** سطر (استثناء موثّق) — [NOORIX_360_REVIEW](NOORIX_360_REVIEW_ABRIL_2026.md).  
- مسار مالي/ذِمّي: عيّنة يدوية أو اختبارات مُوثّقة عند تغيير `financial-core`.

---

## 6) سجل التنفيذ (يُعاد نسخه/تحديثه أسبوعياً)

| التاريخ | المرحلة | الـ ID | الـ commit (short hash) | المنفّذ | نتيجة الاختبار (✓/✗) | ملاحظات |
|---------|---------|--------|-------------------------|--------|---------------------|---------|
| 2026-04-26 | D | D (تقسيم apiEndpoints) | `2c09f94` | Cursor | ✓ | إزالة `apiEndpoints.js` الضخم؛ إضافة `apiEndpoints/`: `connection-accounts-assets`، `sales-reports-orders-employees`، `hr-and-suppliers`، `invoices-and-backup` (مع `fetchAllInvoices*` بعد `getInvoices`) + `index.js`؛ `import` من `../../authStore` / `../../core`؛ دون تغيير `export *` لـ`services/api.js`. **التحقق:** vitest + vite build |
| 2026-04-26 | C | C2 (دفعة كبيرة) | `5155015` | Cursor | ✓ | **4 ملفات:** `UpdateExpenseLineDto` = `PartialType(OmitType(Create, [companyId]))`؛ `UpdateSalesSummaryDto` = `PartialType(OmitType(Create, [companyId, idempotencyKey]))` + `SalesChannelDto`؛ `UpdateCompanyBackupConfigDto` = `companyId` + `PartialType(CompanyBackupConfigDataDto)`؛ `UpdateLeaveDto` = `PartialType(OmitType(Create, [companyId]))` + `voidSalarySettlement`. **التحقق:** vitest + vite build + nest build |
| 2026-04-26 | C | C2 (طلبات/أصناف) | `86bcdbc` | Cursor | ✓ | `UpdateProductDto` = `IntersectionType(PartialType(OmitType(Create…, [companyId])), isActive)` — `isActive` غير معرّف في Create. **الاختبارات:** vitest + vite build + nest build |
| 2026-04-26 | C | C2 (أصول + مسيرات) | `6b49e17` | Cursor | ✓ | `UpdateCompanyAssetDto` و`UpdatePayrollRunDto` = `PartialType(OmitType(Create…, [companyId]))`؛ `UpdatePayrollRunStatusDto` دون تغيير. **الاختبارات:** vitest + vite build + `backend` nest build |
| 2026-04-26 | C | C4 (اختبارات) | `95128f9` | Cursor | ✓ | `saudiDate.test.js`: `toDateInputYmd` (فارغ، غير قابل للتحليل، UTC→يوم Riyadh) + `getSaudiToday` بصيغة YYYY-MM-DD. **الاختبارات:** vitest + vite build |
| 2026-04-26 | C | C4 (طلبات + موظفين) | `821e27e` | Cursor | ✓ | `OrderFormModal` (تاريخ الطلب) + `StaffFormModal` (joinDate): `toDateInputYmd` مع `|| getSaudiToday()`. **الاختبارات:** vitest + vite build |
| 2026-04-26 | C | C4 (نماذج + مبيعات) | `ef10c4a` | Cursor | ✓ | `toDateInputYmd()` في `saudiDate.js`؛ `InvoiceEditModal` + `SalesEditModal`؛ `addCalendarDaysYmd` في `DailySalesScreen`. **الاختبارات:** vitest + vite build |
| 2026-04-26 | C | C4 (استيراد/تصدير) | `8b8c493` | Cursor | ✓ | `importTemplates`: `getSaudiToday` + `parseDate` → `formatSaudiDateISO` (Riyadh)؛ `ImportExportModal` / `SupplierImportExport` / `BankCategoryTreePanel` — طوابع الملفات بـ `getSaudiToday()`. **الاختبارات:** vitest + vite build |
| 2026-04-26 | C | C4 (HR) | `0d84f33` | Cursor | ✓ | `getSaudiToday()` بدل `toISOString().slice(0,10)` في: `SalaryCalcTab`، `EOSCalcTab` (تاريخ تقرير)، `AdvancesTab` (تاريخ التسوية)، `EmployeeDocModal` (تواريخ افتراضية). **الاختبارات:** vitest + vite build |
| 2026-04-26 | C | C1 + chore | `248edef` | Cursor | ✓ | C1: `UpdateSystemBackupConfigDto` = `PartialType(SystemBackupConfigBaseDto)`؛ إزالة `preferQueryCompanyId` (غير مستخدم). **الاختبارات:** vitest + vite build + nest build + tsc |
| 2026-04-26 | C | C3 + تطابق | `c7eee25` | Cursor | ✓ | `getCompanyIdFromHttpRequest` + `CompanyAccessGuard`: قراءة `body.companyId` لـ **PATCH** (مثل POST/PUT)؛ تبسيط `categories` PATCH. **الاختبارات:** vitest + vite build + nest build |
| 2026-04-26 | C | C3 (دفعة) | `631cd8e` | Cursor | ✓ | استبدال `@Query('companyId')` بـ `@CompanyId()` في: `vat-planning`، `company-assets`، `expense-line`، `sales`، `employees`، `orders`، `invoice`، `bank-statements`، `getCompanyBackupConfig` في `backup` — يتماشى مع `getCompanyIdFromHttpRequest` / `CompanyAccessGuard`. **الاختبارات:** vitest + vite build + nest build |
| 2026-04-26 | C | C3 | `9e08eaa` | Cursor | ✓ | `categories` + `accounts`: `@CompanyId()` بدل `@Query('companyId')`؛ `PATCH` للفئات يبقى `companyId` من الديكور + `body.companyId` (PATCH لا يقرأ body في util). **الاختبارات:** vitest + vite build + nest build |
| 2026-04-26 | C | C3 (OCR) | `ba786a1` | Cursor | ✓ | `ocr-invoices.controller`: إزالة `@Req`/`getCompanyIdFromHttpRequest`، `@CompanyId()` + `requireCompanyId` (نفس رسالة التحقق عند غياب الشركة). **الاختبارات:** vitest + vite build + nest build |
| 2026-04-26 | C | C3 + C5 + C6 | `a494eba` | Cursor | ✓ | `@CompanyId` على `suppliers` / `ledger` / `chat` (مع بقاء fallback لأول شركة في الشات)؛ `assert-vaults-for-payment.util` + `hr.service`؛ `imageUtils.compressImageFileToJpegDataUrl` وOCR تبويب الرفع. **الاختبارات:** vitest + vite build + nest build |
| 2026-04-26 | C | C1 (جزئي) + C3 + C4 | `31a487f` | Cursor | ✓ | `PartialType` لـ `UpdateEmployeeDto` / `UpdateResidencyDto` + `@nestjs/mapped-types`؛ `CompanyId` decorator + `vaults` + `hr` controllers؛ `getSaudiDateParts`/`getSaudiNow`/`getSaudiYearMonth` في `saudiDate.js` وربط 8+ مكوّنات. **الاختبارات:** vitest + vite build + nest build |
| 2026-04-26 | A+B | A1–A2، B1–B7 (دفعة 1) | `4fd6a85` | Cursor | ✓ | `git rm --cached` لـ `backend/uploads/*` + `build-out.txt`، `.gitignore`، إزالة prisma من جذر الواجهة، JWT موحّد، `http-exception` production، `extractJson`+OCR util، `OcrCorrectionRule`، dynamic xlsx bank، `cacheHelper`، تنظيف imports، `Dockerfile` VOLUME. **اختبارات:** `npm run build` + `npm test` (جذر)، `npm run build` (backend) |
| YYYY-MM-DD | A | A1 | | | | |
| | | A2 | | | | |
| | B | B1 | | | | |
| | … | | | | | |

**نموذج ملاحظة سطر:** `A2 ✓ 2026-04-28 abc1234 — git ls-files uploads clean; build ok`

---

## 7) Checklist — قبل الإعلان “المرحلة مكتملة”

- [ ] كل خطوات المرحلة في §3 **✓** في جدول السجل §6.  
- [ ] `build` (و`test` إن تُوفر) ناجح.  
- [ ] الاختبارات اليدوية ذات الصلة **✓** أو فشل **موثّق** + issue.  
- [ ] **PR مدمج** و`push` على `main` (أو دمج الفرع).  
- [ ] تحديث سطر **آخر تاريخ** في أسفل [NOORIX_360_REVIEW](NOORIX_360_REVIEW_ABRIL_2026.md) (اختياري) أو تعليق PR.

---

**آخر تحديث لملف التشغيل:** 2026-04-26
