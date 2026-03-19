# عقد المحاسبة — Noorix

**الغرض:** توثيق العقد بين الفرونت والبَكند للعمليات المالية.

---

## أنواع العمليات

| النوع | الوصف | الفرونت | البَكند |
|-------|-------|----------|---------|
| **outflow** | فاتورة / مصروف / مشتريات | `financialApi.createInvoice` / `createInvoiceBatch` | `FinancialCoreService.processOutflow` |
| **inflow** | ملخص مبيعات يومي | `financialApi.createSalesSummary` | `FinancialCoreService.processInflow` |
| **transfer** | تحويل بين خزائن | (مستقبلاً) | `FinancialCoreService.processTransfer` |
| **cancel** | إلغاء عملية | عبر `updateInvoice` أو `cancelDailySalesSummary` | `FinancialCoreService.cancelOperation` |

---

## تدفق البيانات

```
الفرونت                          البَكند
────────                         ────────
الشاشة (PurchasesBatchScreen,
        DailySalesScreen، إلخ)
        │
        ▼
financialApi.js
  - validateTransactionPayload
  - splitTaxFromTotalAsNumbers (إن لزم)
  - invalidateRelated بعد النجاح
        │
        ▼
api.js (HTTP)
        │
        ▼
InvoiceController / SalesController
        │
        ▼
InvoiceService / SalesService
        │
        ▼
FinancialCoreService
  - processOutflow / processInflow
  - Invoice + LedgerEntry + AuditLog
```

---

## الحقول المطلوبة لكل نوع

### outflow (فاتورة مفردة)

| الحقل | مطلوب | ملاحظة |
|-------|-------|--------|
| companyId | نعم | |
| supplierId | نعم | |
| invoiceNumber | نعم | |
| kind | نعم | purchase \| expense \| hr_expense \| fixed_expense \| salary \| advance |
| totalAmount | نعم | > 0 |
| transactionDate | نعم | ISO أو YYYY-MM-DD |
| paymentMethodId أو vaultId | نعم | للتحقق في الفرونت |
| netAmount, taxAmount | لا | يُحسبان من totalAmount و isTaxable (15%) |

### outflow (دفعة فواتير)

| الحقل | مطلوب | ملاحظة |
|-------|-------|--------|
| companyId | نعم | |
| transactionDate | نعم | |
| items | نعم | مصفوفة |
| items[].supplierId | نعم | |
| items[].invoiceNumber | نعم | |
| items[].kind | نعم | |
| items[].totalAmount | نعم | > 0 |

### inflow (ملخص مبيعات)

| الحقل | مطلوب | ملاحظة |
|-------|-------|--------|
| companyId | نعم | |
| transactionDate | نعم | |
| channels | نعم | مصفوفة، عنصر واحد على الأقل |
| channels[].vaultId | نعم | |
| channels[].amount | نعم | > 0 |
| customerCount | نعم | عدد صحيح ≥ 0 |

---

## رموز التحقق المشتركة

| الرمز | المعنى |
|-------|--------|
| TRANSACTION_PAYLOAD_REQUIRED | بيانات العملية مطلوبة |
| TRANSACTION_AMOUNT_MUST_BE_POSITIVE | المبلغ يجب أن يكون أكبر من صفر |
| TRANSACTION_DATE_REQUIRED | تاريخ العملية مطلوب |
| INVALID_TRANSACTION_DATE | تاريخ العملية غير صالح |
| SUPPLIER_REQUIRED | المورد مطلوب |
| PAYMENT_METHOD_REQUIRED | طريقة الدفع مطلوبة |
| VAULT_REQUIRED | الخزينة مطلوبة |

---

## الحسابات (math-engine)

- **الفرونت:** `src/utils/math-engine.js` — sumAmounts، splitTaxFromTotal، splitTaxFromTotalAsNumbers
- **البَكند:** `backend/src/common/utils/math-engine.ts` — splitTax، add، sub، mul، div

نسبة الضريبة: 15% (ZATCA / السعودية).
