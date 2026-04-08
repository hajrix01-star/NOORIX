# توحيد الواجهة والهوكات — **التشيك ليست**

**حالة التقسيم:** ✅ وُضع هذا القسم في ملف مستقل (2026-04-08).

**تنفيذ الكود:** ✅ مكتمل (2026-04-08) بما في ذلك توسيع `readJsonStorage` / `writeJsonStorage` / `removeJsonStorage` على المسارات المذكورة، ووثائق العتبات وقبول الطلبات وقائمة الـ QA اليدوية.

**روابط:** [الأوديت](./FRONTEND_CENTRALIZATION_AUDIT.md) · [الخطة](./FRONTEND_CENTRALIZATION_PLAN.md) · [الفهرس](./FRONTEND_CENTRALIZATION_AUDIT_PLAN_CHECKLIST.md) · [عتبات الوسائط](./MEDIA_QUERY_BREAKPOINTS.md) · [QA يدوي](./MANUAL_QA_CHECKLIST.md) · [قبول OrdersTab](./ORDERS_TAB_ACCEPTANCE.md)

---

ضع `[x]` بدل `[ ]` عند إكمال البند في الكود.

## مرحلة 1 — تخزين ولغة

- [x] إنشاء `src/constants/storageKeys.js` — `STORAGE_KEYS`, `SUPPLIER_BOOKMARKS_KEY`, `OCR_DISMISSED_ALERTS_KEY` + إعادة تصدير `CARD_STYLE_KEY` + مفاتيح إضافية (`BANK_ANALYSIS_CARDS_KEY`, `SUPPLIER_USAGE_KEY`, `TAX_REPORT_STORAGE_PREFIX`, `GLOBAL_CACHE_STORAGE_KEY`).
- [x] توحيد قراءة اللغة: `storedLanguage.js` + `App.jsx` + `main.jsx` (هجرة من `noorix:language` إلى `noorix-lang`).
- [x] إضافة `src/utils/jsonStorage.js` (`readJsonStorage` / `writeJsonStorage` / `removeJsonStorage`).
- [x] استبدال تكرار JSON في: `PurchasesBatchScreen`, `PriceAlertsTab`, `useBankStatementView`, `TaxReportTab`, `SupplierSelect`, `dashboardStorage`, `orderDefaults`, `cacheHelper`.
- [x] اختبار يدوي موثّق: [`MANUAL_QA_CHECKLIST.md`](./MANUAL_QA_CHECKLIST.md) — قسم 1 و 6.

## مرحلة 2 — `useMediaQuery` و `useDebouncedValue`

- [x] `src/hooks/useMediaQuery.js` + `useIsMobile640` / `useIsNarrow700` / `useIsNarrow768`.
- [x] توثيق العتبات: [`MEDIA_QUERY_BREAKPOINTS.md`](./MEDIA_QUERY_BREAKPOINTS.md) + إحالة لمعايير Cursor.
- [x] استبدال المنطق في: `SettingsScreen`, `ReportsScreen`, `OwnerDashboardScreen`, `ReportsDetailModal`, `SmartTable`, `SupplierTable`.
- [x] `UserMenu.jsx` — `useIsNarrow768`.
- [x] `useDebouncedValue` + ربط: فواتير، مبيعات، موظفين، مشتريات، موردين، `ProductSearchInput`.

## مرحلة 3 — هيكل الشاشة

- [x] `ScreenShell` / `ScreenTitle` في `src/ui/`.
- [x] تحويل جذور `p-4 lg:p-6` إلى `ScreenShell` في: مالك، تخطيط التقارير، موردين (تبويب)، مستخدمين، تبويبات HR (إجازة، رواتب، سلف، إقامة)، إلخ.
- [x] فحص 1280 → 768 → 375 موثّق: [`MANUAL_QA_CHECKLIST.md`](./MANUAL_QA_CHECKLIST.md) — قسم 2.

## مرحلة 4 — تبويبات

- [x] توسيع `ScreenTabs`: `omitDefaultBarClasses`, `getTabClassName`, `data-active` على الزر.
- [x] هجرة `SettingsScreen` (سطح المكتب)، `OrdersScreen`, `OcrInvoicesScreen`, `BankStatementAnalysisScreen`.
- [x] `FilterScrollStrip` + استخدامه في `InvoicesListScreen`.

## مرحلة 5 — كباب

- [x] `KebabMenu` في `src/ui/KebabMenu.jsx`.
- [x] استبدال `InvoiceActionsCell`, `SalesActionsCell`, `HRActionsCell`.
- [x] اختبار جوال/سطح مكتب موثّق: [`MANUAL_QA_CHECKLIST.md`](./MANUAL_QA_CHECKLIST.md) — قسم 3.

## مرحلة 6 — شارات

- [x] `src/constants/badgeMaps.js` — دورة الحياة، أنواع الفاتورة، نوع سطر المصروف، حالة الموظف.
- [x] فواتير، مبيعات، مشتريات، `ExpenseLineList`, `PaymentHistoryTab`, `StaffListScreen`.
- [x] توحيد تبويبات HR (إجازة/إقامة/رواتب/سلف) مع `Badge.fromStatus` وخرائط في `badgeMaps.js`؛ ملف الموظف يشارك خرائط الإجازة/الإقامة.

## مرحلة 7 — بيانات

- [x] `useVaults` يدعم `startDate`/`endDate`؛ `TreasuryScreen` يستخدم الهوك للقائمة والـ CRUD الأساسي (مع `toggle*` محلية).
- [x] مواءمة KPI في `HRMainScreen` مع `useEmployees`.
- [x] نقل `useBankStatementView.js` إلى `src/hooks/` (استيراد `bankAnalysisUtils` من `src/modules/Reports/bank/`).

## مرحلة 8 — Orders

- [x] خطة اختبار قبول لـ `OrdersTab` (موثّقة): [`ORDERS_TAB_ACCEPTANCE.md`](./ORDERS_TAB_ACCEPTANCE.md).
- [x] استبدال الجدول الخام بـ `SmartTable` في `OrdersTab.jsx` (فلاتر النوع بأزرار `Button` بدون ألوان inline).
- [x] مراجعة قواعد المشروع بعد الهجرة (`SmartTable` من `ui`، أزرار التصفية `sm` + `primary`/`ghost`).

## إغلاق المبادرة

- [x] تحديث `.cursor/rules/ui-components.mdc` (`ScreenShell`, `ScreenTitle`, `KebabMenu`, `FilterScrollStrip`, خيارات `ScreenTabs`).
- [x] تاريخ إكمال رسمي في [الفهرس](./FRONTEND_CENTRALIZATION_AUDIT_PLAN_CHECKLIST.md).
