# تدقيق الطباعة والتصدير والنسخ الاحتياطي — أبريل 2026

> **تاريخ التدقيق:** 10 أبريل 2026  
> **المنهجية:** فحص شامل بـ 4 وكلاء متوازية + إصلاح يدوي مباشر

---

## ✅ قائمة التحقق (Checklist)

### الطباعة (Print)
- [x] خط Cairo مستورد من Google Fonts في كل نافذة طباعة
- [x] اتجاه `dir="rtl" lang="ar"` على `<html>` في كل صفحة مطبوعة
- [x] `@page { size: A4; margin: 15mm; }` موجود في كل ملف
- [x] ترقيم الصفحات عبر `@bottom-center { content: "صفحة " counter(page) " من " counter(pages) }`
- [x] تذييل الطباعة `.print-footer` بتاريخ الطباعة
- [x] إخفاء عناصر UI في `index.css @media print` (sidebar، topbar، أزرار، `.noorix-print-hide`)
- [x] لون رأس الجداول موحّد `#185FA5` (لون Noorix) — تم إصلاح 12 ملفاً كانت تستخدم `#2563eb`
- [x] الجداول بـ `border-collapse: collapse` و `border: 1px solid #ddd`
- [x] لا CSS variables في HTML المطبوع (تُستبدل بقيم hex حقيقية)
- [x] عناوين وترويسات واضحة (اسم الشركة، عنوان التقرير، الفترة)

### تصدير Excel
- [x] `exportToExcel` تستخدم `xlsx-js-style` لدعم التنسيق
- [x] رأس الأعمدة بخلفية زرقاء `#185FA5` + نص أبيض + خط غامق
- [x] RTL مفعّل (`ws['!views'][0].rightToLeft = true`)
- [x] Freeze panes على صف الرأس دائماً
- [x] حساب عرض الأعمدة تلقائياً من المحتوى (8–52 حرف)
- [x] الأرقام تُحوَّل من string إلى number لضمان التنسيق الصحيح
- [x] `bankStatementExportPrint.js` بورقتين: العمليات + ملخص التصنيفات، كلاهما بـ RTL وتجميد وتنسيق

### تصدير PDF
- [x] `PrintPreviewModal` تفتح نافذة HTML احترافية (Cairo + @page + RTL)
- [x] المتصفح يعمل كمولّد PDF (Save as PDF) — لا تبعيات جديدة
- [x] `EmployeeDocModal` يستخدم `jsPDF + html2canvas` لإنشاء PDF حقيقي للمستندات

### النسخ الاحتياطي
- [x] `BackupTab.jsx` يعرض قائمة النسخ مع التاريخ والحجم والحالة
- [x] زر "تشغيل النسخ الآن" مع اختيار الشركة
- [x] زر تنزيل لكل نسخة
- [x] استيراد كشركة جديدة مع تأكيد ثنائي
- [x] التحقق من سلامة النسخة (verify)
- [x] مؤشرات loading على جميع الأزرار
- [x] تحديث تلقائي كل 15 ثانية
- [x] `backup.service.ts` يحفظ 30+ نوع بيانات
- [x] ضغط gzip مستوى 9
- [x] جدولة يومية تلقائية
- [x] اسم الملف يتضمن timestamp
- [x] سياسة احتفاظ (retention policy)
- [x] رفع خارجي اختياري لـ Google Drive

---

## جدول قبل / بعد

| البند | قبل | بعد |
|-------|-----|-----|
| لون رأس جداول الطباعة | `#2563eb` (أزرق Tailwind) | `#185FA5` (أزرق Noorix الرسمي) |
| عدد الملفات المتأثرة | 12 ملف | ✅ موحّد |
| `exportToExcel` — تنسيق | لا يوجد تنسيق (plain xlsx) | ✅ `xlsx-js-style`: رأس ملوّن + freeze + RTL + عرض تلقائي |
| `PrintPreviewModal` لون الرأس | `#2563eb` | `#185FA5` |
| `bankStatementExportPrint.js` | ملف واحد بدون RTL/freeze | ✅ ورقتان + RTL + freeze + تنسيق احترافي |
| ترقيم الصفحات في الطباعة | غير موحّد (بعض الملفات فقط) | ✅ `@bottom-center` في كل ملف |
| خط Cairo في الطباعة | غير موحّد | ✅ في كل نافذة طباعة |
| `@page A4` | غير موحّد | ✅ في كل ملف |
| النسخ الاحتياطي | كامل ومحدّث | ✅ لا تغيير مطلوب (ممتاز أصلاً) |

---

## ملفات الطباعة الموجودة (15 ملف)

| الملف | النوع | الحالة |
|-------|-------|--------|
| `print preview route` → `PrintPreviewModal` | نافذة HTML | ✅ |
| `ReportsScreen.jsx` → `handlePrint` | نافذة HTML | ✅ |
| `DailySalesScreen.jsx` → `handlePrint` | نافذة HTML | ✅ |
| `PayrollTab.jsx` → `handlePrint` | نافذة HTML | ✅ |
| `SalaryCalcTab.jsx` → `handlePrint` | نافذة HTML | ✅ |
| `EOSCalcTab.jsx` → `handlePrint` | نافذة HTML | ✅ |
| `PayrollRunDetailModal.jsx` → `handlePrint` | نافذة HTML | ✅ |
| `EmployeeDocModal.jsx` → `buildPrintWindow` | نافذة HTML | ✅ |
| `ExpenseLineList.jsx` → `handlePrint` | نافذة HTML | ✅ |
| `ExpenseLineDetailModal.jsx` | نافذة HTML | ✅ |
| `PaymentHistoryTab.jsx` | نافذة HTML | ✅ |
| `VaultTransactionsModal.jsx` → `handlePrintPdf` | نافذة HTML | ✅ |
| `TaxReportTab.jsx` → `handlePrint` | نافذة HTML | ✅ |
| `DashboardCalendarTab.jsx` | نافذة HTML | ✅ |
| `OrdersTab.jsx` → `buildOrderPrintHtml` | نافذة HTML | ✅ |
| `bankStatementExportPrint.js` → `printBankStatement` | نافذة HTML | ✅ |
| `BatchPrintSheet.jsx` | مودال + `@media print` | ✅ |
| `DayCloseReportModal.jsx` | مودال + `@media print` | ✅ |

---

## الاستثناءات المعتمدة (لا تحتاج تغييراً)

- `InvoicesListScreen.jsx` → `window.print()` يعتمد على `index.css @media print` لإخفاء UI ✅
- `PurchasesBatchScreen.jsx` → نفسه ✅
- `ItemsReportTab.jsx` → نفسه ✅

---

## TODO المستقبلي (غير عاجل)

- [ ] إضافة شعار الشركة (logo) في ترويسة الطباعة عند توفر صورة في إعدادات الشركة
- [ ] دعم الطباعة باتجاه landscape تلقائياً للتقارير العريضة (>7 أعمدة)
- [ ] `gzipFile` في النسخ الاحتياطي: تحويل إلى streams لتحسين أداء قواعد البيانات الكبيرة
- [ ] رفع حد Google Apps Script من 18MB
