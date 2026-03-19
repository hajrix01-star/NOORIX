# تقرير: الفواتير لا تظهر مباشرة بعد الإدخال داخل نطاق الفلتر

**التاريخ:** 2025-03-16  
**الحالة:** تم تحديد السبب وإصلاحه

---

## 1. وصف المشكلة

بعض الفواتير داخل نطاق فلتر التاريخ لا تظهر مباشرة بعد الإدخال، بل تتأخر في الظهور. المشكلة لوحظت في جميع الأقسام (المصاريف، المشتريات، الفواتير، الموارد البشرية، إلخ).

---

## 2. السبب الأكيد

### 2.1 مفاتيح إبطال الاستعلام (Query Keys) الخاطئة

**الموقع:** `src/modules/Expenses/ExpensesScreen.jsx`

في React Query، عند استدعاء `invalidateQueries({ queryKey: ['a', 'b'] })` يتم إبطال **فقط** الاستعلامات التي يبدأ مفتاحها بـ `['a', 'b']`.

**الكود الخاطئ:**

```javascript
// تبويب تسجيل مصروف — خاطئ
queryClient.invalidateQueries({ queryKey: ['expense-lines', 'invoices'] });

// تبويب الإدخال الجماعي — خاطئ
queryClient.invalidateQueries({ queryKey: ['invoices', 'expense-lines'] });
```

**لماذا لا يعمل:**

- استعلامات الفواتير تستخدم مفاتيح مثل: `['invoices', companyId, startDate, endDate, kindParam]` أو `['invoices', companyId, startDate, endDate, page, pageSize]`
- `['expense-lines', 'invoices']` لا يطابق أي استعلام فواتير لأن المفتاح الأول مختلف
- `['invoices', 'expense-lines']` لا يطابق لأن العنصر الثاني في استعلامات الفواتير هو `companyId` وليس `'expense-lines'`

**النتيجة:** بعد حفظ فاتورة من تبويب "تسجيل مصروف" أو "الإدخال الجماعي" في المصاريف، لم يكن يتم إبطال cache الفواتير، فتبقى القائمة تعرض البيانات القديمة حتى:
- ينتقل المستخدم لصفحة أخرى ويعود
- أو تنتهي صلاحية الـ cache (staleTime: 60 ثانية)
- أو يحدث refetch لأي سبب آخر

---

## 3. الإصلاح المطبق

تم استبدال المفاتيح الخاطئة بإبطال صحيح منفصل:

```javascript
// تبويب تسجيل مصروف
queryClient.invalidateQueries({ queryKey: ['invoices'] });
queryClient.invalidateQueries({ queryKey: ['expense-lines'] });

// تبويب الإدخال الجماعي
queryClient.invalidateQueries({ queryKey: ['invoices'] });
queryClient.invalidateQueries({ queryKey: ['expense-lines'] });
```

`queryKey: ['invoices']` يطابق **جميع** استعلامات الفواتير لأنها تبدأ بـ `['invoices', ...]`.

---

## 4. ما تم التحقق منه (بدون مشاكل)

| العنصر | الحالة |
|--------|--------|
| **فلتر التاريخ (useDateFilter)** | يعمل بشكل صحيح — يرسل `startDate`/`endDate` بصيغة ISO مع توقيت السعودية |
| **API getInvoices** | يقطع التاريخ إلى `YYYY-MM-DD` قبل الإرسال — صحيح |
| **Backend invoice.service** | يفلتر بـ `gte`/`lte` على UTC — متوافق مع تخزين `transactionDate` كـ `YYYY-MM-DD` |
| **تخزين transactionDate** | يُخزَّن كـ `new Date("YYYY-MM-DD")` = منتصف الليل UTC — متوافق مع الفلتر |
| **إبطال في الأقسام الأخرى** | المشتريات، الموارد البشرية، الفواتير، إلخ — تستخدم `['invoices']` بشكل صحيح |

---

## 5. التوصيات

1. **توحيد إبطال الاستعلامات:** عند إضافة/تعديل فاتورة، استخدم دائماً:
   ```javascript
   queryClient.invalidateQueries({ queryKey: ['invoices'] });
   ```

2. **مراجعة أي `invalidateQueries` جديد:** التأكد من أن المفتاح يطابق فعلياً مفتاح الاستعلام المستهدف (أو يطابق البادئة الصحيحة).

3. **اختبار سريع:** بعد الإصلاح، إدخال فاتورة من تبويب "تسجيل مصروف" أو "الإدخال الجماعي" مع فلتر تاريخ اليوم — يجب أن تظهر الفاتورة فوراً في "سجل المدفوعات" دون الحاجة لتحديث الصفحة أو تغيير التبويب.
