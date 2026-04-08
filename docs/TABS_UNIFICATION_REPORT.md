# تقرير توحيد التبويبات — قبل وبعد

**التاريخ:** 2026-04-08  
**النطاق:** تنفيذ المراحل 1–3 من خطة توحيد أشرطة التبويبات (مشتريات دفعة، تفاصيل كشف بنك، إطار التقارير).

---

## ملخص تنفيذي

- تم إزالة **أنماط التبويبات المضمّنة (inline styles)** من المواضع الحرجة واستبدالها بـ **`ScreenTabs`** أو **Tailwind + متغيرات CSS** بحيث يبقى مصدر الحقيقة للسلوك (tablist / tab / aria-selected) عبر `ScreenTabs` حيث ينطبق.
- تمت إضافة طبقة أنماط **`noorix-bank-detail-tab-*`** في `src/index.css` لحفظ مظهر شريط تفاصيل الكشف (حد سفلي 3px، خلفية نشطة، شارة العدد) دون كسر قواعد الألوان في JSX.
- **`npm run build`** ناجح بعد التغييرات.

---

## جدول قبل → بعد

| الملف | قبل | بعد |
|--------|-----|-----|
| `PurchasesBatchScreen.jsx` | حلقة `Button` + `style={{…}}` للحد والألوان داخل `noorix-tab-bar` | `<ScreenTabs variant="underline" />` + `useMemo` لـ `items` (نفس المفتاحان `entry` / `history`) |
| `BankStatementDetailView.jsx` | دالة `tabBtn` مع `style` على الزر وعلى شارة العدد | `<ScreenTabs omitDefaultBarClasses … barClassName="noorix-bank-detail-tab-row" getTabClassName="noorix-bank-detail-tab" />` + تسميات `label` مع شارة بعدد المعاملات |
| `ReportsLayout.jsx` | `NavLink` مع `style={({ isActive }) => ({…})}` لألوان وحدود ثابتة | `NavLink` مع `className={({ isActive }) => cn(…)}` باستخدام Tailwind و`bg-[var(--noorix-blue-7)]` (تنقل مسارات — يبقى خارج `ScreenTabs` عن قصد) |
| `src/index.css` | — | بلوك `.noorix-bank-detail-tab-row` و`.noorix-bank-detail-tab__count` (+ `--active`) |

---

## قائمة تحقق (منجزة)

- [x] **مشتريات الدفعة:** إزالة inline من شريط التبويب؛ الحفاظ على `activeTab` و`enabled` لطلب الدفعات السابقة.
- [x] **تفاصيل كشف البنك:** تبويبات تحليل / معاملات / تسوية / مبيعات مع عداد المعاملات؛ `role="tablist"` عبر `ScreenTabs`.
- [x] **تقارير (فرعية):** إزالة inline من روابط التنقل الفرعية؛ الحفاظ على `NavLink` ومسارات `/reports/*`.
- [x] **بناء الإنتاج:** `npm run build` بدون أخطاء.

---

## تحقق يدوي موصى به (لم يُشغَّل آلياً)

1. **مشتريات — دفعة:** تبديل «دفعة جديدة» ↔ «الدفعات المحفوظة»؛ التأكد من تحميل الجدول في تبويب السجل فقط.
2. **بنك — تفاصيل كشف:** التبويبات الأربعة + شارة عدد المعاملات تتباين عند التفعيل/عدمه.
3. **تقارير:** الروابط الثلاثة (عام / ضريبي / كشف حساب) والتمييز البصري للمسار النشط.

---

## ملاحظات مقصودة (لم تُغيَّر في هذا الطلب)

- رأس `BankStatementDetailView` ما زال يستخدم `style` لظل البطاقة — خارج نطاق توحيد شريط التبويب.
- بطاقات إحصاء OCR التي تقفز بين الأقسام تبقى **اختصار تنقل** وليست `ScreenTabs` (كما في الخطة المرحلة 5).

---

## الملفات المعدَّلة

1. `src/modules/Purchases/PurchasesBatchScreen.jsx`  
2. `src/modules/Reports/bank/BankStatementDetailView.jsx`  
3. `src/modules/Reports/ReportsLayout.jsx`  
4. `src/index.css`  
5. `docs/TABS_UNIFICATION_REPORT.md` (هذا الملف)
