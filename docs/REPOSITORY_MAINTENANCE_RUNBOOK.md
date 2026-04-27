# دليل الصيانة التشغيلية — البنود 1–9 (ما بعد مراجعة 360)

مرجع موحّد للأوامر والميثاق بعد إغلاق صفوف P0–P3 في [NOORIX_360_REVIEW_ABRIL_2026.md](./NOORIX_360_REVIEW_ABRIL_2026.md).

---

## 1) ميثاق حجم الملفات + محرك مالي

- **هدف:** خدمات Nest ثقيلة ≤ **450** سطر حيث ينطبق؛ مؤشر قصّ عند **>600**؛ فشل بناء اختياري عند **>900** (انظر سكربت المسح أدناه).
- **المصدر المرجعي للتجميع:** `backend/scripts/assemble-financial-core.mjs` يولّد `financial-outflow.service.ts` من `financial-core.service.monolith.ts`. عند وجود `financial-outflow-ledger.util.ts` أو ملفات **`financial-inflow-*.util.ts`** يطبع السكربت **تحذيراً** — أعد دمج المنطق في الـ monolith أو أعد ربط الاستدعاءات بعد التجميع.
- **تقليل حجم الصرف (2026-04-27):** نُقلت `scaleVaultAllocationsToTotal` و`replaceOutflowInvoiceLedgerAndAllocations` إلى `financial-outflow-ledger.util.ts` مع اختبار `financial-outflow-ledger.util.spec.ts`.
- **تقليل حجم الدخل (2026-04-27):** `financial-inflow-channels.util.ts` (تجميع/ضريبة/تحقق تاريخ) + `financial-inflow-ledger.util.ts` (قيود قنوات البيع) + `financial-inflow-channels.util.spec.ts` — `financial-inflow.service.ts` تحت هدف 450 سطر.
- **تقليل حجم الصرف (2026-04-27 ب):** `financial-outflow-persist.util.ts` — مسار إنشاء فاتورة + قيود + audit مشترك بين `processOutflow` و`processOutflowBatch`؛ `financial-outflow.service.ts` **ok** في `check:service-footprint`.
- **طلبات (2026-04-27):** `orders-month-range.util.ts` + `orders-lines.util.ts` (تكرار نطاق الشهر + بنود السطور)؛ `orders.service.ts` تحت 450 سطر.
- **هوك رفع OCR (2026-04-27):** تفكيك `useInvoiceUploadTab` — `useOcrInvoiceLineItems`، `useOcrInvoiceImagePipeline`، `ocrInvoiceUploadPayload` (تحقق + بناء payload)؛ الملف الرئيسي &lt; 450 سطر.
- **أصول الشركة + الخزائن (2026-04-27):** `company-assets-datetime.util.ts` + `company-assets-map.util.ts` + `company-assets-warranty-line-tx.util.ts`؛ `vault-ledger-maps.util.ts` + `vaults-find-one-with-transactions.util.ts` — `company-assets.service.ts` و`vaults.service.ts` تحت 450 سطر.
- **نسخ احتياطي (2026-04-27):** `backup-env-paths.util.ts`، `backup-database-url.util.ts`، `backup-file-helpers.util.ts`، `backup-pg-dump.util.ts`، `backup-system-full-restore.util.ts` — تقليص `backup.service.ts` (مسارات، pg_dump/restore، SHA256، تحقق أرشيف).
- **نسخ احتياطي (2026-04-27 ب):** `backup-gdrive-upload.util.ts`، `backup-company-logical-auto-verify.util.ts`، `backup-attachments-tar.util.ts`، `backup-system-full-tar-pack.util.ts` — رفع سحابي، تحقق لقطة شركة، tar مرفقات، تجميع أرشيف النظام.
- **نسخ احتياطي (2026-04-27 ج):** `backup-job-helpers.util.ts` (تكرار/ترقيم/قصّ)، `backup-gdrive-field-normalize.util.ts`، `backup-company-snapshot-json.util.ts` + `backup-gzip-buffer.util.ts`، `backup-restore-dump-gz.util.ts`، `backup-ingest-system-full-archive.util.ts` — تقليص إضافي لـ `backup.service.ts`.
- **نسخ احتياطي (2026-04-27 د):** `backup-company-logical-execute.util.ts` (`runCompanyLogicalBackup`) + `backup-system-full-archive-run.util.ts` (`runSystemFullArchiveJob`) — منطق النسخ المنطقي وأرشيف النظام خارج الخدمة.
- **نسخ احتياطي (2026-04-27 هـ):** `backup-company-logical-snapshot-read.util.ts` (قراءة ‎.json.gz + تطابق مستأجر)، `backup-restore-report.util.ts` (تقرير استعادة + مسار التنزيل)، `backup-company-logical-verify-manual.util.ts` — تقليص `backup.service.ts` في مسارات الاستعادة/التحقق.
- **نسخ احتياطي (2026-04-27 و):** `backup-external-upload-opts.util.ts`، `backup-verify-database-full-job.util.ts`، `backup-system-full-job-download.util.ts`، `backup-restore-confirm-phrase.util.ts` — تخفيف `backup.service.ts` (رفع خارجي، تحقق/تنزيل نسخة كاملة، عبارة الاستعادة). **كشوف بنك (2026-04-27 و):** `bank-statements-header-heuristic.util.ts` (عناوين وقصّ خام) — تخفيف `bank-statements.service.ts`.
- **كشوف بنك + تقارير + استيراد منطقي (2026-04-27 ح):** `bank-classification-pack.util.ts`، `bank-classification-import-access.util.ts`، `bank-reconciliation-stats.util.ts` — تخفيف `bank-statements.service.ts` (حزم تصنيف، تسوية، صلاحية استيراد). `backup-logical-import-helpers.util.ts` — `arr`/`dec`/`ddate` للقطة المنطقية. `reports-general-profit-loss-model.util.ts` — ثوابت وأنواع P&L العام — تخفيف `reports.service.ts`.
- **موجات تفكيك إضافية (2026-04-27 ط):** (1) `reports-pl-math.util.ts` + `reports-category-descendants.util.ts` + `reports-expense-tree.util.ts` — دوال P&L وشجرة المصاريف. (2) `invoice-fixed-expense-coverage.util.ts` + `invoice-to-public.util.ts`. (3) `bank-statement-save-template.util.ts` + `apply-bank-classification-summary.util.ts`. (4) `accounting-init-master-seeds.util.ts` — بذر COA. (5) `gemini-chat-intent-prompts.util.ts`. (6) `orders-order-number.util.ts`. يخفّف `reports.service.ts`، `invoice.service.ts`، `bank-statements.service.ts`، `accounting-init.service.ts`، `gemini.service.ts`، `orders.service.ts`.
- **تقارير P&L — تفكيك أعمق (2026-04-27 ى):** `reports-pl-item-meta.util.ts` (ميتا للبنود والعناوين)، `reports-pl-ledger-aggregates.util.ts` (تجميع لدجر + قنوات)، `reports-pl-category-hierarchy.util.ts` (هيكل فئات)، `reports-pl-group-states.util.ts` (حالة المجموعات)، `reports-pl-invoice-detail.util.ts` (فلتر/تفاصيل فواتير ولدجر) — تخفيف حجم `reports.service.ts` بإبقائه واجهة طبقة فقط.
- **تفكيك كامل مسار الاستيراد + رفع كشف (2026-04-28 هـ):** `backup-logical-import-transaction.util.ts` — جسم ‎`$transaction` لاستيراد اللقطة المنطقية (نفس ترتيب الجداول والخرائط) يُستدعى من `backup-logical-import.service.ts` (~90 سطر). `bank-statements-upload-analyze.util.ts` + `bank-statements-confirm-mapping-persist.util.ts` — رفع/تحليل و`confirmMapping` خارج `bank-statements.service.ts`. `invoice-update-in-transaction.util.ts` + `invoice-attachment-ops.util.ts` — تعديل فاتورة (قيود) ومرفقات. سكربت `scripts/extract-logical-import-tx.mjs` + `splice-logical-import-service.mjs` لإعادة التوليد عند تغيير الاستيراد.
- **نسخ احتياطي — تكوين شركة + استعادة (2026-04-28 و):** `backup-company-backup-config.util.ts` (قراءة/upsert إعدادات نسخ الشركة) + `backup-restore-operations.util.ts` (استعادة من رفع tar، استعادة من سجل ‎`backupJob`) — `backup.service.ts` **≤450** سطر.
- **فواتير + استيراد منطقي (2026-04-28):** `invoice-transaction-date-filter.util.ts`، `invoice-kind-rollup.util.ts`، `invoice-list-query-parts.util.ts`، `invoice-list-inflow-by-vault.util.ts`، `invoice-day-close-report.util.ts`، `invoice-purchase-batch-summaries.util.ts` — تخفيف `invoice.service.ts` (قائمة، تفصيل خزن، إغلاق يوم، دفعات). `backup-logical-import-verify-allocations.util.ts` — تحقق توزيعات الخزن بعد الاستيراد، يُستدعى من `backup-logical-import.service.ts`.
- **دفعات فواتير + طلبات + جيمني (2026-04-28 ب):** `invoice-batch-valid-items.util.ts` + `invoice-batch-build-dtos.util.ts` (تصفية صفوف + بناء `OutflowDto` لدفعة). `orders-month-summary.util.ts` + `orders-items-report-aggregate.util.ts` — تلخيص شهري وتقرير أصناف. `gemini-types.ts` + `gemini-normalize.util.ts` + `gemini-concurrency.util.ts` — نية/فترة وحد أقصى توازي لـ `gemini.service.ts`.
- **كشوف بنك + تعديل فاتورة (2026-04-28 ج):** `bank-statements-template-matcher.util.ts` (مطابقة قالب عند الرفع)، `bank-statements-structure-suggestion.util.ts` (تحويل أنواع أعمدة + تحديث السجل). `invoice-build-update-data.util.ts` + `invoice-cancel-reference.util.ts` — إلغاء/حقول `update` خارج `invoice.service.ts`.

```bash
cd backend && npm run check:service-footprint
```

---

## 2) توحيد الواجهة + كاش React Query

- قائمة التحقق: [FRONTEND_CENTRALIZATION_CHECKLIST.md](./FRONTEND_CENTRALIZATION_CHECKLIST.md) — **مكتملة**؛ عند ميزات جديدة تلمس البيانات المالية أضف بادئة `queryKey` إلى `invalidateOnFinancialMutation` في `src/utils/queryInvalidation.ts` واطلع على [PERFORMANCE_AND_DATA.md](./PERFORMANCE_AND_DATA.md).

---

## 3) تغييرات `financial-core` وتوازن القيود

عند أي PR يمس `financial-outflow` / `financial-inflow` / `financial-transfer` أو `financial-core-helpers.util.ts`:

```bash
cd backend
npx jest financial-core-helpers.util.spec.ts --no-cache
npx jest financial-outflow-ledger.util.spec.ts --no-cache
# اختياري — تكامل:
# npm run test:integration:financial
```

أعد قراءة JSDoc لـ `validateJournalBalance` في `financial-core-helpers.util.ts` بعد تغيير مسارات القيد.

---

## 4) سطح HTTP والأرقام الديناميكية

لا تنسخ أرقام endpoints من تقارير قديمة — ولّدها من المستودع:

```bash
cd backend && npm run audit:http-surface
```

**لقطة مرجعية (2026-04-27):** `controllerFiles` 25، `httpMethodDecoratorsApprox` 228، `prismaModelCount` 55 — أعد التشغيل وحدّث هذا القسم عند تغيير كبير.

---

## 5) تطبيق RLS على قاعدة البيانات

انظر [RLS_APPLY_RUNBOOK.md](./RLS_APPLY_RUNBOOK.md).

---

## 6) نظافة Git (uploads)

```bash
# من جذر المستودع — يفشل إذا وُجد uploads تحت التتبع
npm run verify:git-cleanliness
# فشل أيضاً على artifacts تحذيرية (cursorrules، xlsx، …):
npm run verify:git-cleanliness -- --strict
```

---

## 7) أخطاء HTTP للعميل

- الفلتر العام: `backend/src/common/http-exception.filter.ts` — في **production** أخطاء **غير** HttpException مُبهمة؛ **HttpException** بحالة **≥500** تُرجع رسالة عامة للعميل (2026-04-27).
- عند إضافة `throw new HttpException(..., 5xx)` تأكد أن الرسالة ليست تفاصيل داخلية.

---

## 8) Sentry وتخزين كائنات (اختياري)

- متغيرات البيئة: `backend/.env.example` — `SENTRY_DSN`، `AWS_S3_BUCKET` / `AWS_REGION` (تعليقات فقط حتى التفعيل).
- عند التفعيل: ثبّت `@sentry/nestjs` أو `@sentry/node`، ثم اربط `Sentry.init` في `main.ts` داخل `if (process.env.SENTRY_DSN)` دون كسر التشغيل عند غياب الحزمة (يُنفَّذ عادة في PR منفصل).

---

## 9) معايير QA (مراجعة 360 §4)

| معيار | إجراء |
|--------|--------|
| Q5 OCR | قواعد `confirmed` تُطبَّق قبل مطابقة المورد — راجع `ocr-extraction.service.ts` عند تغيير المسار. |
| Q6 مالي | مع اختبارات أعلاه + مراجعة يدوية موثّقة عند تغيير القيود. |
| Q7 حجم PR | تقسيم حسب موضوع واحد؛ لا تدمج monolith + واجهة في PR واحد. |

---

**آخر تحديث:** 2026-04-28
