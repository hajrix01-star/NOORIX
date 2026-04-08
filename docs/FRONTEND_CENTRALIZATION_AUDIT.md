# توحيد الواجهة والهوكات — **الأوديت**

**حالة التقسيم:** ✅ وُضع هذا القسم في ملف مستقل (2026-04-08).

**الغرض:** تقليل التكرار بين الأقسام (مكوّنات، هوكات، ثوابت، تخزين) دون «إعادة كتابة» دفعة واحدة.  
**آخر تحديث للفحص:** 2026-04-08 (مراجعة grep على `src/`).

**روابط:** [الخطة](./FRONTEND_CENTRALIZATION_PLAN.md) · [التشيك ليست](./FRONTEND_CENTRALIZATION_CHECKLIST.md) · [الفهرس](./FRONTEND_CENTRALIZATION_AUDIT_PLAN_CHECKLIST.md)

---

## أ-1 ما هو موحّد أصلاً (مرجع جيد)

| المنطقة | الموقع / الملاحظة |
|--------|-------------------|
| مكتبة UI | `src/ui/` — `Button`, `Input`, `Modal`, `Drawer`, `AdaptiveSheet`, `SmartTable`, `ScreenTabs`, `Badge`, … |
| شريط التاريخ | `src/shared/components/DateFilterBar.jsx` ومستهلكون متعددون |
| هوكات المجال | `src/hooks/` — `useInvoices`, `useSuppliers`, `useTableFilter`, `useDateFilter`, … |
| الترجمة | `useTranslation` + `src/i18n/` — النمط متسق |
| مفتاح نمط البطاقات | `CARD_STYLE_KEY` من `src/constants/cardStyles.js` (يُستورد من `ThemePreviewScreen`؛ `App.jsx` يعرّف نفس القيمة محلياً — تفضيل استيراد من `cardStyles.js` أو من `storageKeys` موحّد) |

## أ-2 تكرار / تشتت يستحق توحيداً

### 1) عرض الشاشة (breakpoint) — **تشتت واضح**

نفس الفكرة («جوال مقابل سطح») بعدة أرقام وطرق:

| الملف / المكوّن | الآلية | العتبة |
|-----------------|--------|--------|
| `SettingsScreen.jsx` | `matchMedia` + `useState` | `max-width: 639px` وكذلك `innerWidth < 640` |
| `ReportsDetailModal.jsx` | `matchMedia` | `max-width: 640px` |
| `ReportsScreen.jsx`, `OwnerDashboardScreen.jsx` | `resize` + `innerWidth` | `< 700` |
| `SmartTable.jsx`, `SupplierTable.jsx` | `matchMedia` | `max-width: 700px` |
| `UserMenu.jsx` | قراءة لمرة عند التصيير | `innerWidth <= 768` (بدون اشتراك بتغيير الحجم) |
| `AdaptiveSheet.jsx` | `useSyncExternalStore` + `matchMedia` | قابل للتمرير بالبكسل — **نموذج جيد للتقليد** |

**التوصية:** هوك واحد `useMediaQuery('(max-width: …px)')` أو محاذاة مع نقاط الكسر في `.cursor/rules/ui-responsive-standards.mdc` (640 / 768 / 1024) وتوثيق الاستثناءات.

### 2) `localStorage` — **مفتاح لغة مزدوج (خلل محتمل)**

| الموقع | المفتاح |
|--------|---------|
| `App.jsx` | `noorix-lang` |
| `main.jsx` (قبل React) | `noorix:language` |

**النتيجة:** `applyBranding` قد يقرأ لغة بينما التطبيق بعد التحميل يقرأ أخرى إذا اختلفت القيم المحفوظة.

**التوصية:** `src/constants/storageKeys.js` (أو توسيع ملف ثوابت موجود) — مفتاح واحد + قراءة/كتابة موحّدة؛ هجرة لمرة واحدة (قراءة القديم إن وُجد ثم كتابة بالمفتاح الجديد).

### 3) `localStorage` + JSON — **نمط مكرر**

تكرار `try/catch` + `JSON.parse`/`stringify` في: المشتريات (مفضلات)، تنبيهات OCR، التقارير الضريبية، البنك، لوحة التحكم، الطلبات، `SupplierSelect`, `cacheHelper`, إلخ.

**التوصية:** `readJsonStorage(key, fallback)` / `writeJsonStorage(key, value)` في `src/utils/storage.js` (أو بجانب `cacheHelper` مع عدم ازدواجية المسؤولية).

### 4) Debounce للبحث (300ms) — **نفس المنطق في عدة شاشات**

| الملفات (أمثلة) |
|-----------------|
| `InvoicesListScreen.jsx`, `DailySalesScreen.jsx`, `StaffListScreen.jsx`, `PurchasesBatchScreen.jsx`, `SuppliersTab.jsx`, `ProductSearchInput.jsx` |

**ملاحظة:** `setTimeout(..., 300)` بعد `window.print` في عدة ملفات **ليس debounce** — نمط طباعة؛ يمكن لاحقاً استخراج `schedulePrintWhenLoaded(win)` اختيارياً؛ أولوية أقل من debounce البحث.

### 5) تبويبات يدوية بدل `ScreenTabs`

| الملف |
|-------|
| `SettingsScreen.jsx`, `OrdersScreen.jsx`, `OcrInvoicesScreen.jsx`, `BankStatementAnalysisScreen.jsx` |

`InvoicesListScreen.jsx` يستخدم `nx-tab-bar-fade-wrap` كغلاف تمرير لفلاتر — ليس نفس «شريط التبويب» لكن يتقاطع بصرياً مع بنية `ScreenTabs`.

### 6) قوائم إجراءات صف (كباب + `createPortal`)

| الملف |
|-------|
| `InvoiceActionsCell.jsx`, `SalesActionsCell.jsx`, `HRActionsCell.jsx` |

`SupplierSelect.jsx`, `ProductSearchInput.jsx`, `InvoiceListTab.jsx` (OCR), `AppHeader.jsx`, `UserMenu.jsx` — حالات portal لأسباب مختلفة (قائمة، قائمة منسدلة، طبقة)؛ **الكباب الثلاثة** هي أعلى عائد للدمج في `src/ui`.

### 7) جذر الشاشة وهوامش — **انحراف عن القاعدة**

عدة شاشات تستخدم `p-4 lg:p-6` على الجذر بدل النمط الموثّق `py-4 px-0 md:px-3 lg:px-6` (راجع `ui-responsive-standards.mdc`).

### 8) خرائط حالات / شارات (`Badge.fromStatus` وما شابه)

تكرار وشقّ مسارين (من `fromStatus` مقابل `statusColorMap` يدوي) في: فواتير/مبيعات/مشتريات، مصروفات (نوع السطر)، HR (موظف، إجازة، رواتب، إقامة، سلف).  
**التوصية:** بنّاءات في `src/constants/` مثل `buildInvoiceLifecycleStatusMap(t)` حسب المجال، وليس ملفاً واحداً ضخماً لكل النظام.

### 9) React Query داخل الموديولات

استعلامات مضمنة في `TreasuryScreen`, `HRMainScreen`, إعدادات، OCR، إلخ — جزءٌ منها يتداخل مع `useVaults` / `useEmployees` (مفاتيح أو شكل بيانات مختلف). **توحيد تدريجي** عند لمس الملف.

### 10) Hooks داخل مجلد موديول

`src/modules/Reports/bank/useBankStatementView.js` — إن كانت سياسة المشروع تمنع استيراد بين الموديولات، الأنسب نقل المنطق المشترك إلى `src/hooks/`.

## أ-3 ما لم يُعتبر «أولوية توحيد» الآن

- **Portal في `Modal` / `Drawer`:** متوقع وممركز.
- **طباعة `setTimeout(300)` بعد تحميل نافذة:** تكرار مزعج لكن مخاطرة منخفضة؛ يمكن تأجيله.
- **نماذج المودالات المحلية بـ `useState`:** لا توحيد إلزامي إلا إذا تكرر نفس الحقول والتحقق في عدة أماكن.

---

## مرجع سريع لملفات «نقاط ساخنة»

- تبويبات يدوية: `modules/Settings/SettingsScreen.jsx`, `modules/Orders/OrdersScreen.jsx`, `modules/OcrInvoices/OcrInvoicesScreen.jsx`, `modules/Reports/BankStatementAnalysisScreen.jsx`
- كباب: `components/common/InvoiceActionsCell.jsx`, `SalesActionsCell.jsx`, `modules/HR/components/HRActionsCell.jsx`
- لغة مزدوجة: `App.jsx`, `main.jsx`
- breakpoint: `modules/Settings/SettingsScreen.jsx`, `modules/Reports/ReportsScreen.jsx`, `modules/Owner/OwnerDashboardScreen.jsx`, `modules/Reports/ReportsDetailModal.jsx`, `components/common/SmartTable.jsx`, `modules/Suppliers/components/SupplierTable.jsx`, `components/UserMenu.jsx`

---

*هذا المستند يكمّل ولا يحل محل وثائق أخرى في `docs/` (مثل `MODULE_MAP.md`). عند تعارض، يُفضّل توثيق سياسة الاستيراد بين الموديولات أولاً.*
