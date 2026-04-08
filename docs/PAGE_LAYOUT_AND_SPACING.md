# تخطيط جذر الشاشة والمسافات (Noorix)

## القانون

| العنصر | التطبيق |
|--------|---------|
| شاشة قسم كاملة داخل `app-main` | `<ScreenShell>` من `src/ui/ScreenShell.jsx` |
| Classes الفعلية | `flex flex-col gap-4 py-4 px-0 md:px-3 lg:px-6` |
| جوال | `px-0` — الهامش الأفقي من `.app-main` و`.app-main__content` فقط (تجنب الهامش المزدوج) |
| محتوى داخل تبويب/كرت أب له `ScreenShell` خارجي | `<ScreenShell embedded>` — `flex flex-col gap-4` فقط |
| ثوابت للاستخدام النادر | `SCREEN_SHELL_PAGE_CLASS`, `SCREEN_SHELL_EMBEDDED_CLASS` (تُصدَّر من `src/ui/index.js`) |

## طبقة التنفيذ

- **الملف:** `src/ui/ScreenShell.jsx`
- **التصدير:** `src/ui/index.js`
- **القواعد للـ AI:** `.cursor/rules/ui-responsive-standards.mdc`, `.cursor/rules/ui-components.mdc`

## إرشادات إضافية

- **شريط أدوات / فلاتر:** `gap-2` بين الأزرار والعناصر حيث ينطبق.
- **كروت `noorix-surface-card`:** غالباً `p-4` على المحتوى أو `p-0` للتبويبات الملتصقة — لا تكرّر حشوة غير ضرورية على غلاف داخل الكرت.
- **مودالات، طباعة، شاشات خارج `app-main`:** لا تُفرض عليها `ScreenShell` كصفحة كاملة.

## تحديث 2026-04-08 — الملفات المعدَّلة

تم استبدال جذر `<div className="flex flex-col gap-4 py-4 px-0 md:px-3 lg:px-6">` (أو ما يعادله) بـ `<ScreenShell>` حيث ينطبق، مع توحيد دفعة المشتريات على `gap-4` وإزالة `p-6` من جذر ملف الموظف لصالح القانون الموحّد.

1. `src/ui/ScreenShell.jsx` — ثوابت + `embedded` / `variant="embedded"`
2. `src/ui/index.js` — تصدير الثوابت
3. `src/modules/Dashboard/DashboardScreen.jsx`
4. `src/modules/Expenses/ExpensesScreen.jsx`
5. `src/modules/HR/EmployeeProfileScreen.jsx`
6. `src/modules/HR/HRMainScreen.jsx`
7. `src/modules/HR/StaffListScreen.jsx` — `embedded={!!embedded}`
8. `src/modules/Invoices/InvoicesListScreen.jsx`
9. `src/modules/Purchases/PurchasesBatchScreen.jsx` — `ScreenShell className="w-full"`، `gap-5` → `gap-4` في تبويب السجل
10. `src/modules/Reports/ReportsScreen.jsx`
11. `src/modules/Sales/DailySalesScreen.jsx`
12. `src/modules/Suppliers/SuppliersScreen.jsx`
13. `src/modules/Treasury/TreasuryScreen.jsx`
14. `.cursor/rules/ui-responsive-standards.mdc`
15. `.cursor/rules/ui-components.mdc`
16. `docs/PAGE_LAYOUT_AND_SPACING.md` (هذا الملف)

شاشات كانت تستخدم `ScreenShell` مسبقاً (إعدادات، تقارير فرعية، إلخ) لم تُغيَّر في هذه الدفعة.

## معرض المكوّنات المرقّم (`/theme-preview` → تبويب «معرض المكوّنات»)

للطلبات مثل: «طبّق مثل **رقم 7** في شاشة X». المراجع ثابتة في الكود (`ThemeUILabTab.jsx` + `id="ui-lab-N"`):

| الرقم | ماذا يمثل |
|------|-----------|
| 1 | عنوان صفحة + وصف (نمط `ScreenTitle` + نص ثانوي) |
| 2 | `nx-page-header` + أزرار `sm` و`gap-2` |
| 3 | `noorix-surface-card` + `p-0` + `ScreenTabs` underline + `nx-tab-content` |
| 4 | أزرار `Button` بأحجام وألوان شائعة |
| 5 | حقول `Input` في شبكة |
| 6 | `Badge` |
| 7 | `Divider` |
| 8 | `Modal` + `KebabMenu` |
| 9 | `SmartTable` ببيانات وهمية |
| 10 | `DateFilterBar` |
| 11 | `noorix-stat-card` |
| 12 | `noorix-surface-card` + `nx-empty-state` |

## التحقق

```bash
npm run build
```
