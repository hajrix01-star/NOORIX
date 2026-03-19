# تدفقات العمليات المحاسبية — NOORIX

هذا الملف يوثّق تدفق كل عملية مالية من الـ API حتى القيد المحاسبي.

---

## 1. المبيعات اليومية (Inflow)

```
SalesController.createSummary()
  → SalesService.create()
  → FinancialCoreService.processInflow()
  → _withRetry() [إعادة محاولة عند تعارض P2034]
  → db.withTenant($transaction):
      1. FiscalPeriodService.assertPeriodOpenForDate() — رفض إذا الفترة مغلقة
      2. توليد رقم ملخص DS-YYYYMMDD-NNN
      3. جلب إعدادات الضريبة (vatEnabledForSales, vatRatePercent)
      4. حساب الصافي والضريبة لكل قناة (إن مفعّلة)
      5. إنشاء DailySalesSummary + DailySalesChannel
      6. إنشاء Invoice (kind=sale) مع netAmount و taxAmount
      7. إنشاء LedgerEntry لكل قناة:
         - قيد الإيراد: مدين خزنة، دائن إيراد (الصافي)
         - قيد الضريبة: مدين خزنة، دائن TAX-001 (إن وُجدت)
      8. AuditLog
  → Rollback عند أي فشل
```

---

## 2. الصرف (Outflow) — مشتريات / مصاريف / رواتب / سلفيات

```
InvoiceController / HRController
  → InvoiceService.createWithLedger() أو HRService
  → FinancialCoreService.processOutflow()
  → _withRetry()
  → db.withTenant($transaction):
      1. FiscalPeriodService.assertPeriodOpenForDate()
      2. Resolve: vault account, expense/revenue account
      3. إنشاء Invoice
      4. إنشاء LedgerEntry: مدين مصروف، دائن خزنة
      5. AuditLog
  → Rollback عند أي فشل
```

---

## 3. التحويل بين الخزائن (Transfer)

```
TransferController (أو من واجهة الخزائن)
  → FinancialCoreService.processTransfer()
  → _withRetry()
  → db.withTenant($transaction):
      1. FiscalPeriodService.assertPeriodOpenForDate()
      2. مدين خزنة المستقبل، دائن خزنة المرسل
      3. AuditLog
  → Rollback عند أي فشل
```

---

## 4. إلغاء عملية (Cancel)

```
FinancialCoreService.cancelOperation()
  → db.withTenant($transaction):
      1. تحديث status → 'cancelled' للوثيقة (Invoice / DailySalesSummary)
      2. تحديث status → 'cancelled' لجميع LedgerEntry المرتبطة
      3. AuditLog
  → لا حذف فعلي — سلامة البيانات محفوظة
```

---

## 5. رصيد الخزينة (Vault Balance)

**القاعدة الذهبية:** الرصيد يُحسب دائماً من القيود — لا يُخزّن في حقل منفصل.

```
VaultBalanceService.getVaultBalance(tx, vaultId, asOfDate?)
  → جمع: SUM(amount) where debitAccountId = vault.accountId
  → طرح: SUM(amount) where creditAccountId = vault.accountId
  → النتيجة = رصيد الخزينة حتى التاريخ
```

---

## 6. الفترات المالية (Fiscal Periods)

- كل شركة لها فترات مالية (افتراضياً: السنة الحالية تُنشأ عند التهيئة).
- الحالات: `open` | `closed` | `locked`
- قبل أي عملية تسجيل: `assertPeriodOpenForDate()` — يرفض إذا الفترة `closed` أو `locked`.

---

## 7. إعادة المحاولة (Retry)

- عند تعارض معاملات Prisma (P2034): إعادة المحاولة حتى 3 مرات مع **Exponential Backoff** (100ms, 200ms, 400ms).
- يُطبّق على: processOutflow, processInflow, processTransfer.

---

## 8. تنظيف Idempotency (Cron)

- كل ساعة: حذف مفاتيح عدم التكرار المنتهية (`expiresAt < now`).
- `IdempotencyCleanupService.handleCleanup()` — Cron: `0 * * * *`.

---

## 9. الفترات المالية — منع التداخل

- عند إنشاء فترة جديدة عبر `POST /api/v1/fiscal-periods`: التحقق من عدم تداخلها مع فترات موجودة.
- الشرط: `endDate > startDate` (تاريخ النهاية بعد البداية) و `startDate ≤ existing.endDate AND endDate ≥ existing.startDate` للتداخل.
- `assertNoOverlap()` يرفض صراحةً إذا `endDate <= startDate`.

---

## 10. ضمانات السلامة (Hardening Safeguards)

### Idempotency Cleanup
- حذف المفاتيح المنتهية: `expiresAt < new Date()` — لا طرح ساعات إضافية لأن `expiresAt` يمثل حد الصلاحية.
- Index على `expiresAt` لتحسين أداء الـ Cron.

### Retry Engine
- حد أقصى 3 محاولات (`MAX_RETRIES = 3`) لمنع حلقات إعادة محاولة لا نهائية.
- Exponential backoff + jitter (100–150ms, 200–250ms, 400–450ms) لتقليل thundering herd.

### Double-Entry Validation
- `validateJournalBalance(entries)` قبل حفظ القيود: التحقق من أن مجموع المدين = مجموع الدائن.
- يُطبّق على: processOutflow, processInflow, processTransfer, updateInflow.

### Company Access Guard
- التحقق من أن المستخدم مرتبط بالشركة (`user.companyIds`).
- التحقق من أن الشركة موجودة وتنتمي لـ tenant المستخدم (استعلام + RLS).
