# قانون الطباعة الاحترافية — نوركس

كل أمر طباعة في النظام **يجب** أن يتبع هذا القانون. القواعد مُطبَّقة في `src/index.css` عبر `@media print`.

---

## 1. إخفاء العناصر غير الضرورية (Hide Elements)

عند الطباعة، يُخفى تلقائياً:

- **القائمة الجانبية** (`.app-sidebar`, `.app-sidebar-backdrop`)
- **شريط التنقل العلوي** (`.noorix-topbar`)
- **أزرار إضافة وتعديل** (`.noorix-btn-nav`, `button`, `.ndfb-mode-btn`, `.ndfb-reset-btn`)
- **أيقونات داخل الجداول** (`.noorix-actions-cell`, `td button`)
- **أي عنصر مُعلَّم بـ** `.noorix-print-hide`

---

## 2. تحسين المحتوى المطبوع (Print Layout)

- **الحاوية الرئيسية**: `width: 100%`، بدون حدود خارجية
- **إزالة الظلال**: `box-shadow: none` للبطاقات والجداول
- **خلفيات**: بيضاء فقط (`#fff`) لتوفير الحبر
- **خط Cairo**: 12pt للنصوص، 16pt للعناوين
- **صفحة A4**: `@page { size: A4; margin: 15mm }`

---

## 3. ترويسة الطباعة (Print Header)

يجب أن تحتوي الترويسة على:

- **اسم الشركة**
- **نوع التقرير**
- **التاريخ**

**التنفيذ:** أضف عنصراً بالكلاس `noorix-print-header` في أعلى المحتوى القابل للطباعة:

```jsx
<div className="noorix-print-header" style={{ display: 'none' }}>
  {companyName} — {reportTitle} — {date}
</div>
```

هذا العنصر مخفي على الشاشة ويظهر تلقائياً عند الطباعة.

---

## 4. الجداول

- **عدم انقطاع الصفوف**: `page-break-inside: avoid` للجدول والصفوف
- **تكرار الرأس**: `thead { display: table-header-group }` لتكرار رأس الجدول في كل صفحة
- **حجم الخط**: 12pt للخلايا

---

## 5. إضافة زر طباعة

استخدم `window.print()` مع الكلاس `noorix-print-hide` للأزرار التي لا تُطبع:

```jsx
<button type="button" className="noorix-btn-nav noorix-print-hide" onClick={() => window.print()}>
  {t('print')}
</button>
```

---

## 6. إخفاء أعمدة الإجراءات

للجداول التي تحتوي عمود إجراءات (تعديل، حذف، إلخ)، أضف `noorix-print-hide` لـ `th` و `td` عمود الإجراءات:

```jsx
<th className="noorix-print-hide">...</th>
<td className="noorix-print-hide">...</td>
```

---

## ملخص للمطورين

| المطلوب | التنفيذ |
|---------|---------|
| ترويسة | `<div className="noorix-print-header">اسم الشركة — التقرير — التاريخ</div>` |
| إخفاء أزرار | `className="noorix-print-hide"` |
| إخفاء عمود إجراءات | `className="noorix-print-hide"` على th و td |
| صفحة واحدة A4 | مُطبَّق تلقائياً في CSS |
