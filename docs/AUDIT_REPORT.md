# تقرير الفحص القيصري — نظام Noorix

**التاريخ:** 12 مارس 2025  
**النطاق:** الفرونت إند (src/) + البكند (backend/)

---

## 1. الهوكات المركزية

### 1.1 قائمة الهوكات في `src/hooks/`

| الملف | الأسطر | الوظيفة |
|-------|--------|----------|
| `useDateFilter.js` | 88 | فلترة التواريخ (شهر/يوم/نطاق) |
| `useTableFilter.js` | 113 | بحث، ترتيب، تصفح للجداول |
| `useDataManager.js` | 67 | جلب بيانات مرجعية مع كاش |
| `useInvoices.js` | 39 | جلب وإدارة الفواتير |
| `useSuppliers.js` | 46 | جلب وإدارة الموردين |
| `useVaults.js` | 61 | جلب وإدارة الخزائن |
| `useSales.js` | 51 | ملخصات المبيعات اليومية |
| `useCategories.js` | 58 | جلب وإدارة التصنيفات |

**المجموع:** 8 هوكس، جميعها في `src/hooks/`.

### 1.2 هوكس خارج `src/hooks/`

| الموقع | الهوك | ملاحظة |
|--------|-------|--------|
| `src/i18n/useTranslation.js` | `useTranslation` | مناسب لوضعه في i18n |
| `src/context/AppContext.jsx` | `useApp` | مناسب لوضعه في السياق |
| `src/context/AuthContext.jsx` | `useAuth` | مناسب لوضعه في السياق |

**الخلاصة:** لا توجد هوكس مبعثرة بشكل غير منطقي.

### 1.3 موقع `useDateFilter`

- **المصدر:** `src/hooks/useDateFilter.js`
- **إعادة التصدير:** `DateFilterBar.jsx` يعيد تصديره: `export { useDateFilter };`
- **الاستخدام:** 4 شاشات (PurchasesBatchScreen، InvoicesListScreen، TreasuryScreen، DailySalesScreen)

**التقييم: ممتاز**

---

## 2. أحجام الملفات

### 2.1 ملفات كبيرة (>200 سطر) — تحتاج تقسيم

| الملف | الأسطر | التوصية |
|-------|--------|----------|
| `PurchasesBatchScreen.jsx` | 450 | تقسيم إلى BatchHistory، BatchEntry، BatchForm |
| `translations.js` | 429 | مقبول (ملف ترجمات) |
| `LoginScreen.jsx` | 373 | فصل نماذج تسجيل الدخول/استعادة كلمة المرور |
| `DailySalesScreen.jsx` | 323 | فصل SummaryCard و SummaryForm |
| `UserMenu.jsx` | 276 | فصل قائمة المستخدم |
| `App.jsx` | 251 | استخراج منطق التوجيه |
| `api.js` | 250 | فصل حسب المجال (auth، invoices، vaults، إلخ) |
| `CompaniesTab.jsx` | 214 | فصل نماذج الإضافة والتعديل |
| `SmartTable.jsx` | 213 | فصل Pagination و SearchBar |
| `RolesTab.jsx` | 208 | فصل منطق الأدوار |
| `CategoryTree.jsx` | 208 | فصل منطق الشجرة |
| `UsersTab.jsx` | 206 | فصل نماذج المستخدمين |

### 2.2 ملفات صغيرة جداً (<20 سطر)

| الملف | الأسطر | ملاحظة |
|-------|--------|--------|
| `treasuryConstants.js` | 20 | فارغ تقريباً |
| `tax.js` | 18 | غير مستخدم؛ يُفضّل إزالته أو دمجه مع format.js |
| `useTranslation.js` | 15 | مناسب |
| `AppContext.jsx` | 14 | مناسب |
| `LoadingFallback.jsx` | 9 | مناسب |

**التقييم: يحتاج تحسين** — عدة ملفات كبيرة تحتاج تقسيم.

---

## 3. مركزية الفلاتر

### 3.1 مواقع الفلترة

| النوع | الموقع | الاستخدام |
|-------|--------|-----------|
| **useDateFilter** | `src/hooks/useDateFilter.js` | 4 شاشات |
| **useTableFilter** | `src/hooks/useTableFilter.js` | شاشة واحدة: InvoicesListScreen |
| **فلترة يدوية** | `SuppliersTab.jsx` | `useMemo` + `filter` على suppliers |

### 3.2 تقييم التوحيد

- **useDateFilter:** موحد ومستخدم في كل الشاشات التي تحتاج فلترة تاريخ.
- **useTableFilter:** موحد لكن مستخدم في شاشة واحدة فقط؛ يمكن استخدامه في `SuppliersTab` بدل الفلترة اليدوية.
- **SuppliersTab:** يستخدم فلترة يدوية بدل `useTableFilter`.

### 3.3 فلترة مالية/محاسبية مركزية

- لا يوجد هوك مركزي للفلترة المالية.
- الفلترة المالية تتم عبر:
  - `useInvoices` مع `startDate` و `endDate` من `useDateFilter`
  - `useSales` مع نفس التواريخ
  - `getVaultTransactions` مع تواريخ من `useDateFilter`

**التقييم: جيد** — الفلترة الزمنية موحدة، لكن `useTableFilter` غير مستغل بالكامل.

---

## 4. المنطق المحاسبي

### 4.1 `unifiedTransaction` و `core/`

| العنصر | الموقع | الوظيفة |
|--------|--------|----------|
| `unifiedTransaction` | `src/core/unifiedTransaction.js` | التحقق، التواريخ المزدوجة، تنفيذ المعاملات، إبطال الكاش |
| `validateTransactionPayload` | نفس الملف | التحقق من المبلغ، التاريخ، المورد، طريقة الدفع، الخزينة |
| `SalesService.createSaleInvoice` | `src/modules/Sales/SalesService.js` | يستدعي `unifiedTransaction` لإنشاء فاتورة مبيعات |

### 4.2 أماكن الحسابات (Decimal، net، tax، total)

| الموقع | نوع الحساب | ملاحظة |
|--------|-------------|--------|
| `constants/tax.js` | `splitTaxFromTotal`, `splitTaxFromTotalAsNumbers` | ✓ SSOT — Decimal فقط |
| `utils/format.js` | `sumAmounts`, `calcReverseVat` (يستخدم tax.js) | ✓ Decimal |
| `hooks/useBatchCalculation.js` | `useBatchSummary` — ملخص الدفعات | ✓ Decimal |
| `PurchasesBatchScreen.jsx` | يستخدم `useBatchSummary` | ✓ Decimal |
| `BatchRow.jsx` | `calcReverseVat` للعرض | ✓ Decimal |
| `BatchEditPanel.jsx` | `splitTaxFromTotalAsNumbers` | ✓ Decimal |
| `BatchPrintSheet.jsx` | `sumAmounts` | ✓ Decimal |
| `InvoicesListScreen.jsx` | `sumAmounts` | ✓ Decimal |
| `InvoiceEditModal.jsx` | `splitTaxFromTotalAsNumbers` | ✓ Decimal |
| `DailySalesScreen.jsx` | `Decimal` للمجاميع | ✓ Decimal |
| `SalesEditModal.jsx` | `Decimal` | ✓ Decimal |
| `SalesService.js` | `splitTaxFromTotal` من tax.js | ✓ Decimal |
| `unifiedTransaction.js` | `Decimal` للتحقق | ✓ Decimal |

### 4.3 توزيع المنطق: فرونت أم بَكند؟

- **الفرونت:** جميع الحسابات المالية (net، tax، total) تمر عبر `tax.js` أو `format.js` — Decimal فقط.
- **البَكند:** API على NestJS؛ القيد المزدوج في `ledger.service.ts`.
- **unifiedTransaction:** يعمل في الفرونت ويستقبل `runInTransaction` من طبقة التنفيذ.

**التقييم: ممتاز** — tax.js مصدر وحيد للضرائب، لا float ولا Math.round.

---

## 5. القلب المحاسبي (Accounting Core)

### 5.1 القيد المزدوج

- **الفرونت:** لا يوجد تنفيذ للقيد المزدوج في الكود الحالي.
- **البَكند:** `backend/src/ledger/ledger.service.ts` — يستعلم عن `ledgerEntry` مع فلترة تاريخ.
- **API:** `getLedgerEntries` في `api.js` (سطر 197).

### 5.2 ربط الفواتير بالدفاتر

- الفرونت يرسل الفواتير عبر `createInvoiceBatch` و `createInvoice`.
- الربط الفعلي (reference_type، reference_id) يتم في البَكند.
- `PurchasesBatchScreen` يرسل `debitAccountId` في كل صف.

### 5.3 قواعد التحقق المالي

| الموقع | القواعد |
|--------|---------|
| `unifiedTransaction.js` | مبلغ > 0، تاريخ، مورد، طريقة دفع، خزينة |
| `SalesService.js` | totalInclusive > 0، paymentMethod مطلوب |
| `format.js` | `calcReverseVat` — Decimal-safe |
| `tax.js` | `splitTax` — غير مستخدم، يستخدم Number |

**التقييم: ضعيف** — القلب المحاسبي غير واضح في الفرونت؛ القيد المزدوج في البَكند فقط.

---

## 6. ملخص التقييم

| الجزء | التقييم | ملاحظات |
|-------|---------|----------|
| الهوكات المركزية | ممتاز | تنظيم جيد، useDateFilter في مكانه الصحيح |
| أحجام الملفات | يحتاج تحسين | عدة ملفات كبيرة تحتاج تقسيم |
| مركزية الفلاتر | جيد | useDateFilter موحد، useTableFilter غير مستغل بالكامل |
| المنطق المحاسبي | ممتاز | tax.js SSOT، Decimal فقط، useBatchCalculation |
| القلب المحاسبي | ضعيف | القيد المزدوج في البَكند فقط |

---

## 7. إصلاحات تم تنفيذها (15 مارس 2025)

- [x] إضافة `import { sumAmounts }` في `BatchEditPanel.jsx`
- [x] **تحويل tax.js كاملًا** ليعتمد على Decimal.js — SSOT للضرائب
- [x] **إصلاح BatchEditPanel:** استبدال `v/1.15` بـ `splitTaxFromTotalAsNumbers`
- [x] **إصلاح InvoiceEditModal:** استبدال `v/1.15` بـ `splitTaxFromTotalAsNumbers`
- [x] **إصلاح SalesService:** استبدال `1.15` الثابت بـ `splitTaxFromTotal` من tax.js
- [x] **تحديث format.js:** `calcReverseVat` يستخدم tax.js داخليًا
- [x] **إنشاء useBatchCalculation.js:** Hook مركزي لملخص الدفعات
- [x] **تفتيت PurchasesBatchScreen:** نقل منطق الحسابات إلى `useBatchSummary`

---

## 8. توصيات أولوية

### أولوية متوسطة
1. **توحيد الفلترة:** استخدام `useTableFilter` في `SuppliersTab` بدل الفلترة اليدوية.
2. **تقسيم الملفات الكبيرة:** DailySalesScreen، LoginScreen.

### أولوية منخفضة
3. **فصل api.js:** تقسيم حسب المجال (auth، invoices، vaults، ledger، إلخ).
4. **توثيق الربط:** توثيق واجهة الربط بين الفرونت والبَكند للقيد المزدوج.
