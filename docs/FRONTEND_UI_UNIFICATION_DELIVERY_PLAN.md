# خطة تسليم توحيد واجهة نوركس

تاريخ الوثيقة: 2026-07-02

## 1. الهدف

توحيد واجهة نوركس تدريجيًا بدون إعادة بناء وبدون تعريض الشاشات المالية أو الطباعة للخطر.

الهدف العملي:

| المجال | الوضع الحالي | الهدف المرحلي |
|---|---:|---:|
| جداول خام خارج `src/ui` | 61 | تقليلها تدريجيًا مع إبقاء جداول الطباعة والتقارير الخاصة |
| أزرار خام خارج `src/ui` | 74 | تحويل الآمن منها إلى `Button` |
| مدخلات خام خارج `src/ui` | 90 | تحويل الآمن منها إلى `Input` أو مكوّن مركزي مناسب |
| استخدام `style={{` | 527 | تقليل الثابت والمتكرر فقط، وإبقاء الديناميكي الضروري |
| `SmartTable` | 36 استخدام | تثبيته كواجهة نوركس الرسمية للجداول القابلة للتوحيد |

## 2. القرار المعماري

| قرار | الحكم |
|---|---|
| إعادة بناء الواجهة من الصفر | مرفوض |
| استبدال `SmartTable` مباشرة | مرفوض |
| اعتماد AG Grid كخيار أول | مرفوض حاليًا |
| اعتماد MUI DataGrid | مرفوض حاليًا |
| تطوير `SmartTable` تدريجيًا | مقبول |
| استخدام TanStack Table كمحرك داخلي لاحقًا | مقبول فقط بعد RFC مستقل |

البنية المستهدفة:

```txt
Noorix SmartTable API
        ↓
TanStack Table engine لاحقًا
        ↓
Noorix UI / CSS / Tokens
```

## 3. أنواع الجداول المعتمدة

| النوع | الاستخدام | القرار |
|---|---|---|
| `SmartTable` | بيانات تفاعلية: فرز، بحث، إجراءات، ترقيم، صفوف عادية | المعيار الرسمي |
| `SimpleTable` | عرض بسيط بدون منطق ثقيل | ينشأ عند الحاجة |
| `PrintTable` | مستندات وطباعة وفواتير وتقارير HTML ثابتة | يبقى مستقلًا |
| `MatrixTable` | تقارير مالية ومصفوفات مثل P&L وتجميعات خاصة | يبقى مستقلًا |
| HTML table خام | مسموح فقط للطباعة أو حالة مبررة | يحتاج سبب واضح |

## 4. نطاق العمل

### داخل النطاق

| بند | مطلوب |
|---|---|
| توحيد الأزرار السهلة | استبدال `<button>` الآمن وغير الحساس بـ `Button` |
| توحيد المدخلات السهلة | استبدال text/number/date/search/select البسيطة فقط |
| تقليل inline styles | نقل القيم الثابتة والمتكررة فقط إلى CSS أو مكونات |
| توحيد الجداول البسيطة | لا يبدأ إلا بعد تصنيف مسبق لكل جدول مرشح |
| حوكمة الجداول | منع إضافة جداول خام جديدة دون مبرر |
| توثيق الاستثناءات | كل table خام متبقٍ يجب أن يكون له سبب |

### خارج النطاق حاليًا

| بند | السبب |
|---|---|
| تقارير P&L وGR2 | عالية الحساسية وفيها grouping/sticky/print |
| الرواتب ونهاية الخدمة | حسابات مالية وحساسة |
| الضرائب وVAT | حساسة إنتاجيًا |
| الإقفال اليومي والطباعة | تحتاج HTML ثابت للطباعة |
| مستندات HR المطبوعة | تحتاج تحكم طباعي دقيق |
| إعادة تصميم الثيم بالكامل | غير مطلوب في هذه المرحلة |
| SmartTable v2 / TanStack | RFC فقط، بدون تنفيذ مباشر ضمن هذه الخطة |

## 5. الملفات الحساسة التي لا تلمس في البداية

| ملف / نطاق | سبب الحماية |
|---|---|
| `src/modules/Reports/GeneralReportV2Screen.tsx` | تقرير مالي وتجميعات قابلة للطي وطباعة |
| `src/modules/Reports/GeneralPlTable.tsx` | P&L وجدول مالي خاص |
| `src/modules/Reports/TaxReportTab.tsx` | ضريبة وقيم مالية |
| `src/modules/Invoices/components/DayCloseReportBody.tsx` | إقفال يومي وطباعة |
| `src/modules/Reports/CostAccountingAppsScreen.tsx` | حسابات تكلفة وسيناريوهات |
| `src/modules/Reports/bank/**` | تحليل وتسوية بنكية |
| `src/modules/Reports/**` | تقارير مالية وتحليلية وقد تحتوي طباعة أو أرقام رسمية |
| `src/modules/HR/tabs/PayrollTab.tsx` | رواتب |
| `src/modules/HR/tabs/EOSCalcTab.tsx` | نهاية خدمة |
| `src/modules/HR/components/TerminationSettlementModal.tsx` | تسوية مالية |
| `src/modules/Purchases/**` | مشتريات وفواتير وإجماليات |
| `src/modules/Purchases/batch/**` | مشتريات وإجماليات |

## 6. مراحل التنفيذ

### المرحلة الأولى: UI Controls فقط

| المطلوب | معيار التنفيذ |
|---|---|
| تحويل الأزرار غير الحساسة إلى `Button` | لا يتغير النص أو السلوك أو الصلاحيات أو التخطيط تقريبًا |
| تحويل المدخلات البسيطة غير الحساسة | text/number/date/search/select فقط، مع حفظ `value`, `onChange`, `disabled`, `required` |
| عدم تحويل المدخلات الخاصة | يترك file/checkbox/radio/hidden/custom controlled inputs إلا بتبرير منفصل |
| تقليل `style={{` الثابتة | نقل الثابت فقط، وعدم لمس الديناميكي المالي أو الطباعي |
| عدم تحويل الجداول | ممنوع تحويل أي `<table>` في المرحلة الأولى |
| عدم لمس الملفات الحساسة | ممنوع لمس Reports, Reports/bank, Purchases, HR payroll/EOS/settlement, Tax/VAT, Invoices day close/print |

ملفات مرشحة:

| ملف | سبب البداية |
|---|---|
| `src/modules/Orders/components/StaffDigestTab.tsx` | أزرار خام قليلة |
| `src/modules/Orders/components/StaffDigestHistoryTab.tsx` | أزرار خام قليلة |
| `src/modules/Orders/components/OrdersImportModalParts.tsx` | عناصر UI غير مالية مباشرة نسبيًا |
| `src/modules/Orders/components/catalog/CatalogProductFormSheet.tsx` | مدخلات بسيطة محتملة بعد مراجعة |
| `src/modules/Settings/components/backup/BackupSystemSection.tsx` | مدخلات بسيطة غير مالية، مع ترك file/checkbox إن وجدت |

شروط استلام المرحلة الأولى:

| شرط | طريقة التحقق |
|---|---|
| لا تعديل في الملفات الحساسة المحمية | `git diff --name-only` |
| انخفاض عدد `<button` خارج `src/ui` | `rg --count-matches "<button\\b" src -g "*.tsx" -g "!src/ui/**"` |
| انخفاض عدد raw inputs خارج `src/ui` | `rg --count-matches "<input\\b|<select\\b|<textarea\\b" src -g "*.tsx" -g "!src/ui/**"` |
| لا تعديل على أي جدول | `git diff` لا يحتوي تحويلات `<table>` |
| لا جداول خام جديدة | `npm.cmd run check:table-governance` |
| لا أخطاء TypeScript | `npm.cmd run typecheck` |

### المرحلة 1.5: `DateFilterBar` كتذكرة مستقلة

| المطلوب | معيار التنفيذ |
|---|---|
| تحويل apply/reset إلى `Button` أو نمط مركزي | لا يتغير السلوك أو النص أو حالة disabled |
| تحويل selects فقط إذا كان آمنًا | لا يتغير اختيار السنة/الشهر أو اتجاه RTL/LTR |
| عدم لمس خلايا التقويم | ممنوع تعديل month/day/year cells في هذه المرحلة |
| اختبارات مستهدفة | تشغيل اختبارات `DateFilterBar` و`datePeriod` إن وجدت |
| فحص يدوي للفلاتر | التحقق من تطبيق/إعادة ضبط الفلاتر على شاشة واحدة على الأقل |

شروط استلام المرحلة 1.5:

| شرط | طريقة التحقق |
|---|---|
| نطاق التعديل محصور في `DateFilterBar` وما يلزمه | `git diff --name-only` |
| لا تغيير لخلايا التقويم | مراجعة diff |
| لا كسر في حساب الفترة | اختبارات `datePeriod` أو فحص يدوي موثق |
| لا full build إلا عند الحاجة | الالتزام مطلوب |

### المرحلة الثانية: توحيد الجداول البسيطة

| المطلوب | معيار التنفيذ |
|---|---|
| تصنيف كل جدول مرشح قبل تحويله | لا تحويل دون جدول قرار |
| تحويل جداول العرض البسيطة فقط | استخدام `SmartTable` أو `SimpleTable` |
| إنشاء `SimpleTable` عند الحاجة | بدون sorting أو state ثقيل |
| توثيق الجداول الخام المتبقية | كل استثناء له سبب: print، matrix، financial، editable |
| عدم لمس التقارير المالية الكبيرة | لا تحويل لـ P&L أو GR2 في هذه المرحلة |
| عدم تحويل الجداول الخاصة | يمنع تحويل أي جدول فيه inputs أو rowspan/colspan أو sticky/tree/grouped أو طباعة |

جدول القرار الإلزامي قبل تحويل أي جدول:

| الملف | نوع الجدول | هل مالي؟ | هل يطبع؟ | فيه inputs؟ | فيه rowspan/colspan؟ | فيه sticky/grouped/tree؟ | القرار |
|---|---|---|---|---|---|---|---|
| مثال | عرض بسيط | لا | لا | لا | لا | لا | `SmartTable` أو `SimpleTable` |

ملفات مرشحة:

| ملف | سبب الترشيح |
|---|---|
| `src/components/ImportExportModal/components/EmployeeImportPreviewTable.tsx` | جدول معاينة بسيط |
| `src/modules/Dashboard/components/CalendarDayDetailPanel.tsx` | جدول عرض صغير |
| `src/modules/Orders/components/OrdersImportModalParts.tsx` | جدول معاينة/استيراد |
| `src/modules/Orders/components/ItemsManageTabSectionsSection.tsx` | جدول إدارة بسيط |

حالة التنفيذ الحالية:

| ملف | القرار المنفذ | تحقق |
|---|---|---|
| `src/ui/SimpleTable.tsx` | إنشاء مكون مركزي لجداول العرض البسيطة | `src/ui/SimpleTable.test.tsx` |
| `src/components/ImportExportModal/components/EmployeeImportPreviewTable.tsx` | تحويل إلى `SimpleTable` | حوكمة الجداول + typecheck |
| `src/modules/Dashboard/components/CalendarDayDetailPanel.tsx` | تحويل إلى `SimpleTable` | حوكمة الجداول + typecheck |
| `src/modules/Orders/components/ItemsManageTabSectionsSection.tsx` | تحويل إلى `SimpleTable` | حوكمة الجداول + typecheck |
| `src/modules/Orders/components/OrdersImportModalParts.tsx` | تحويل إلى `SimpleTable` | حوكمة الجداول + typecheck |
| `src/modules/Orders/components/SalesReportTab.tsx` | تحويل إلى `SimpleTable` | حوكمة الجداول + typecheck |
| `src/modules/Orders/components/ItemsReportTab.tsx` | تحويل جدول تاريخ الشراء إلى `SimpleTable` | حوكمة الجداول + typecheck |
| `src/modules/Orders/StaffOrdersSentPanels.tsx` | تحويل جدول أصناف السجل إلى `SimpleTable` | حوكمة الجداول + typecheck |
| `src/modules/Orders/components/OrdersSummaryCard.tsx` | تحويل جدول الملخص إلى `SimpleTable` بعد دعم `footer` | حوكمة الجداول + اختبار `SimpleTable` |

شروط استلام المرحلة الثانية:

| شرط | طريقة التحقق |
|---|---|
| انخفاض عدد `<table` خارج `src/ui` | `rg --count-matches "<table\\b" src -g "*.tsx" -g "!src/ui/**"` |
| بقاء الجداول الطباعية كما هي أو نقلها إلى `PrintTable` | مراجعة الملفات المحمية |
| نجاح حوكمة الجداول | `npm.cmd run check:table-governance` |
| نجاح اختبارات SmartTable وSimpleTable | `npm.cmd test -- src/ui/SmartTable/SmartTable.test.tsx src/ui/SimpleTable.test.tsx` |
| لا كسر في الشاشات المحولة | فحص يدوي للشاشات المحددة |

### المرحلة الثالثة: RFC فقط لـ SmartTable v2

| المطلوب | معيار التنفيذ |
|---|---|
| تقييم إدخال TanStack Table | RFC مستقل بدون تنفيذ |
| حصر نواقص `SmartTable` | editable cells, grouped rows, summary rows, sticky first column, print-safe mode |
| تقدير المخاطر والكلفة | يشمل التأثير على الأداء، RTL، الطباعة، والاختبارات |
| خطة compatibility | الحفاظ على API `SmartTable` الحالي أو توثيق أي كسر مقترح |
| قرار Go/No-Go | لا يبدأ التنفيذ إلا بعد قبول RFC |

شروط استلام المرحلة الثالثة:

| شرط | طريقة التحقق |
|---|---|
| وثيقة RFC مكتملة | ملف RFC في `docs/` |
| لا تنفيذ كود مباشر | `git diff --name-only` لا يحتوي ملفات `src/` إلا إذا كان طلب منفصل |
| قرار واضح | Go / No-Go / Later |
| قائمة اختبارات مستقبلية | موثقة داخل RFC |

## 7. تعريف الانتهاء العام

لا يعتبر التطوير منتهيًا إلا عند تحقق كل التالي:

| شرط | مطلوب |
|---|---|
| الأرقام قبل/بعد موثقة | raw buttons, raw inputs, raw tables, inline styles |
| كل تعديل له نطاق واضح | لا refactor عشوائي |
| السلوك محفوظ | نفس السلوك، النصوص، الصلاحيات، والتخطيط تقريبًا |
| الملفات الحساسة لم تمس دون موافقة | نعم |
| حوكمة الجداول ناجحة | `Table governance check passed.` |
| TypeScript ناجح | `npm.cmd run typecheck` |
| لا build كامل إلا عند الحاجة | الالتزام مطلوب |
| توثيق الاستثناءات | أي table خام متبقٍ له سبب |
| فحص بصري للشاشات المعدلة | مطلوب قبل التسليم |

## 8. أوامر القياس الرسمية

تستخدم هذه الأوامر قبل وبعد كل مرحلة:

```powershell
rg --count-matches "<button\b" src -g "*.tsx" -g "!src/ui/**"
rg --count-matches "<input\b|<select\b|<textarea\b" src -g "*.tsx" -g "!src/ui/**"
rg --count-matches "<table\b" src -g "*.tsx" -g "!src/ui/**"
rg --count-matches "style=\{\{" src -g "*.tsx" -g "*.ts"
npm.cmd run check:table-governance
npm.cmd run typecheck
```

## 9. قواعد منع التدهور

| قاعدة | الاستثناء |
|---|---|
| ممنوع إضافة `<button>` جديد خارج `src/ui` | إذا كان داخل مكوّن UI مركزي جديد |
| ممنوع إضافة `<input>/<select>/<textarea>` خام | إذا كان type خاص مثل file/radio/checkbox مع سبب واضح |
| ممنوع إضافة `<table>` خام | طباعة، مستندات، matrix مالية، أو جدول editable خاص |
| ممنوع إضافة `style={{` ثابت | يسمح فقط للديناميكي أو الطباعة أو CSS variables المحسوبة |
| ممنوع تعديل ملفات مالية حساسة ضمن تنظيف UI | إلا بتذكرة منفصلة واختبارات واضحة |
| ممنوع قياس النجاح بالأرقام فقط | يجب إثبات حفظ السلوك والتخطيط والصلاحيات |

## 10. نموذج تقرير التسليم

يجب أن ينتهي كل تنفيذ بتقرير قصير بهذا الشكل:

```md
## ملخص التنفيذ
- الملفات المعدلة:
- الملفات الحساسة التي لم تلمس:
- سبب أي استثناء:

## الأرقام
| المؤشر | قبل | بعد |
|---|---:|---:|
| raw buttons خارج src/ui | | |
| raw inputs خارج src/ui | | |
| raw tables خارج src/ui | | |
| style={{ | | |

## التحقق
- check:table-governance:
- typecheck:
- اختبارات مستهدفة:
- فحص يدوي:

## قرار الاستلام
- مستلم / غير مستلم:
- ملاحظات:
```

## 11. نتيجة الاستلام النهائية المتوقعة

| المحور | قبل | بعد المرحلة 1 | بعد المرحلة 1.5 | بعد المرحلة 2 | بعد RFC المرحلة 3 |
|---|---:|---:|---:|---:|---:|
| توحيد الجداول | 55/100 | 55/100 | 55/100 | 70-75/100 | قرار معماري فقط |
| توحيد الثيم | 62/100 | 66-68/100 | 68/100 | 72/100 | قرار معماري فقط |
| توحيد الأزرار | 89/100 | 92-94/100 | 94/100 | 95/100 | قرار معماري فقط |
| توحيد النماذج | 84/100 | 88-90/100 | 90/100 | 92/100 | قرار معماري فقط |
| المركزية الهيكلية | 80/100 | 82/100 | 83/100 | 88/100 | قرار معماري فقط |

## 12. الخلاصة التنفيذية

الخطة المعتمدة هي refactor تدريجي، وليس إعادة بناء.

نبدأ بـ UI Controls الآمنة فقط، ثم نعالج `DateFilterBar` كتذكرة مستقلة، ثم نصنف الجداول قبل تحويل أي جدول بسيط. `SmartTable v2` وTanStack يبقيان RFC فقط حتى توجد موافقة صريحة وخطة اختبارات واضحة.

## 12. إغلاق المرحلة الأولى: UI Controls

تاريخ الإغلاق: 2026-07-02

حالة المرحلة: مغلقة مهنيًا كمرحلة آمنة، وليست صفر raw controls.

| المؤشر | قبل | بعد الإغلاق | القرار |
|---|---:|---:|---|
| raw `<button>` خارج `src/ui` | 74 | 47 | المتبقي استثناءات محكومة |
| raw input/select/textarea خارج `src/ui` | 90 | 85 | المتبقي file/checkbox/radio/editable/protected |
| `style={{` خارج `src/ui` | 527 | 495 | المتبقي يحتاج مرحلة CSS منفصلة |

تحويلات الإغلاق:

| ملف | تحويل |
|---|---|
| `src/modules/HR/tabs/ResidencyTab.tsx` | link-buttons إلى `Button variant="raw"` |
| `src/modules/Owner/components/OwnerPerformanceChart.tsx` | metric chips إلى `Button variant="raw"` |
| `src/modules/Owner/components/OwnerMonthlyComparisonTable.tsx` | metric chips إلى `Button variant="raw"` |
| `src/modules/Orders/StaffOrderPanel.tsx` | section chips إلى `Button`، search إلى `Input` |
| `src/modules/Orders/StaffOrderPanelModals.tsx` | quantity buttons/input إلى `Button` و`Input` |

حوكمة الإغلاق:

| ملف | دور |
|---|---|
| `scripts/control-manual-exceptions.json` | baseline رسمي لاستثناءات الأزرار والمدخلات الخام |
| `scripts/check-control-governance.mjs` | منع زيادة raw controls دون توثيق |
| `package.json` | إضافة `npm.cmd run check:control-governance` |

شروط قبول المرحلة الأولى بعد الإغلاق:

| شرط | أمر تحقق |
|---|---|
| لا زيادة في raw controls | `npm.cmd run check:control-governance` |
| لا زيادة في raw tables | `npm.cmd run check:table-governance` |
| لا أخطاء TypeScript | `npm.cmd run typecheck` |
| لا whitespace errors | `git diff --check` |

سبب عدم الوصول إلى صفر:

| نوع المتبقي | القرار |
|---|---|
| `file` inputs | تترك خامًا مؤقتًا |
| `checkbox/radio` | تترك حتى وجود Checkbox/Radio مركزي |
| calendar cell buttons | تترك داخل `DateFilterBar` حتى RFC مصغر للتقويم |
| editable-grid controls | تؤجل إلى مرحلة editable controls |
| Reports/Tax/HR/Purchases/Bank | محمية من تنظيف المرحلة الآمنة |

## 13. إغلاق المرحلة الثانية: الجداول البسيطة

تاريخ الإغلاق: 2026-07-02

حالة المرحلة: مغلقة مهنيًا كتصنيف وحوكمة. لم يتم تحويل جداول جديدة في هذه الدفعة لأن الفحص لم يجد جدول عرض بسيطًا آمنًا خارج ما تم تحويله سابقًا.

| المؤشر | القيمة |
|---|---:|
| raw `<table>` خارج `src/ui` في ملفات `tsx` | 53 |
| raw `<table>` خارج `src/ui` في ملفات `tsx/ts` حسب الحوكمة | 76 |
| جداول خام بلا سبب موثق | 0 |
| حوكمة الجداول | passed |

قرار المرحلة:

| نوع الجدول المتبقي | القرار |
|---|---|
| print/export HTML | يترك حتى مرحلة `PrintTable` |
| تقارير مالية/P&L/Cost/Tax/Bank | محمي ولا يلمس في تنظيف واجهة آمن |
| editable grids | يترك حتى مرحلة مكونات editable controls |
| dashboard/owner matrix tables | يترك حتى `MatrixTable` أو RFC مخصص |
| dynamic generated tables | يترك لأن مصدر الأعمدة ديناميكي |

ملفات الحوكمة:

| ملف | دور |
|---|---|
| `scripts/table-manual-exceptions.json` | عدد الجداول الخام المسموح بها لكل ملف |
| `scripts/table-manual-reasons.json` | سبب وقرار كل استثناء |
| `scripts/check-table-governance.mjs` | يمنع الجداول الخام الجديدة ويمنع أي استثناء بلا سبب |

تعريف قبول المرحلة الثانية:

| شرط | تحقق |
|---|---|
| لا جدول خام جديد | `npm.cmd run check:table-governance` |
| كل استثناء له سبب | `scripts/table-manual-reasons.json` مطلوب من الحوكمة |
| لا تحويل لملف محمي | لا تغييرات في الجداول المالية/الطباعية المحمية ضمن هذه الدفعة |
| لا تضخيم لـ `SimpleTable` | لم تتم إضافة editable/grouped/matrix behavior |

## 14. Phase 1.1 Closure: Raw Control Exception Reasons

Closure date: 2026-07-02

Phase status: governance hardening only. No UI behavior changes and no visual refactor.

| Metric | Value |
|---|---:|
| remaining raw `<button>` exception files | 10 |
| remaining raw form-control exception files | 49 |
| raw control exceptions without a documented reason | 0 |
| control governance | passed |

Governance files:

| File | Role |
|---|---|
| `scripts/control-manual-exceptions.json` | allowed raw control count per file |
| `scripts/control-manual-reasons.json` | category, decision, and reason for every allowed raw control exception |
| `scripts/check-control-governance.mjs` | blocks new raw controls, stale counts, and undocumented exceptions |

Accepted remaining categories:

| Category | Decision |
|---|---|
| `file` inputs | leave until central FileInput exists |
| `checkbox/radio` controls | leave until central Checkbox/Radio exists |
| calendar popover buttons | leave until a dedicated DateFilterBar pass |
| editable-grid controls | leave until editable-control components exist |
| financial/tax/payroll/purchases/bank controls | protected from UI-only cleanup |

Acceptance criteria:

| Condition | Verification |
|---|---|
| no new raw controls | `npm.cmd run check:control-governance` |
| every raw control exception has a reason | `scripts/control-manual-reasons.json` is required by governance |
| no table regression | `npm.cmd run check:table-governance` |
| no UI behavior change | documentation and governance script changes only |

## 15. Phase 1.2 Closure: Control Primitives

Closure date: 2026-07-02

Phase status: central primitives added with limited low-risk adoption.

| Metric | Before | After |
|---|---:|---:|
| raw `<button>` outside `src/ui` | 47 | 47 |
| raw form controls outside `src/ui` | 85 | 81 |
| new central primitives | 0 | 3 |
| new primitive tests | 0 | 3 |

Added UI primitives:

| Component | File |
|---|---|
| `Checkbox` | `src/ui/Checkbox.tsx` |
| `Radio` | `src/ui/Radio.tsx` |
| `FileInput` | `src/ui/FileInput.tsx` |

Adopted safely:

| File | Change |
|---|---|
| `src/components/common/SearchableOptionsPicker.tsx` | raw checkbox to `Checkbox` |
| `src/components/ImportExportModal/components/ImportUploadSection.tsx` | raw file input to `FileInput` |
| `src/modules/Settings/components/AppBrandingTab.tsx` | raw file input to `FileInput` |
| `src/modules/Suppliers/components/SupplierImportExport.tsx` | raw file input to `FileInput` |

Acceptance criteria:

| Condition | Verification |
|---|---|
| no new raw controls | `npm.cmd run check:control-governance` |
| no table regression | `npm.cmd run check:table-governance` |
| primitives typecheck | `npm.cmd run typecheck` |
| primitives tests | `npx.cmd vitest run src/ui/ControlPrimitives.test.tsx` |

## 16. Phase 1.3 Closure: Safe Primitive Adoption

Closure date: 2026-07-02

Phase status: low-risk adoption of `Checkbox`, `Radio`, and `FileInput` in non-report UI.

| Metric | Before | After |
|---|---:|---:|
| raw `<button>` outside `src/ui` | 47 | 47 |
| raw form controls outside `src/ui` | 81 | 71 |
| additional raw form controls removed | 0 | 10 |

Adopted safely:

| File | Change |
|---|---|
| `src/modules/Treasury/TreasuryScreen.tsx` | include-archived checkbox to `Checkbox` |
| `src/modules/Settings/components/ModulePermissionPanel.tsx` | permission checkbox to `Checkbox` |
| `src/modules/Settings/components/UsersTab.tsx` | company assignment checkboxes to `Checkbox` |
| `src/modules/Settings/components/CompaniesTab.tsx` | archived checkbox and logo file inputs to `Checkbox`/`FileInput` |
| `src/modules/Orders/components/catalog/CatalogProductsPanel.tsx` | bulk section checkbox/radio controls to `Checkbox`/`Radio` |

Protected scope still not touched:

| Scope | Reason |
|---|---|
| financial reports / P&L / cost accounting | protected financial behavior |
| tax / VAT | protected tax behavior |
| payroll / settlement | protected HR financial behavior |
| bank reconciliation | protected bank workflow |
| editable grids | requires editable-control phase |

Acceptance criteria:

| Condition | Verification |
|---|---|
| no new raw controls | `npm.cmd run check:control-governance` |
| no table regression | `npm.cmd run check:table-governance` |
| primitive adoption typecheck | `npm.cmd run typecheck` |
| primitive tests still pass | `npx.cmd vitest run src/ui/ControlPrimitives.test.tsx` |
| whitespace-safe diff | `git diff --check` |
