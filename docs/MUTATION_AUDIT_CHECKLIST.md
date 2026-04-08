# قائمة تحقق — عقد الطفرات وـ `{ success }` (API)

استخدمها عند إضافة شاشات أو مسارات كتابة جديدة، وبعد مراجعات دورية.

## مرجع سريع

| الأداة | متى |
|--------|-----|
| `useApiMutation` | طفرة واحدة (أو نتيجة واحدة واضحة) + toast / إبطال كاش |
| `rejectIfApiFailed(res, fallback)` | بعد `await` عندما تريد رمي خطأ فقط |
| `assertApiOk(res, fallback)` | بعد `await` — يرفض `success === false` (الرسالة: `error`/`message` من الـ API أو `fallback`) ثم يعيد `res` |
| `getApiErrorMessage(res, fallback)` | عند بناء نص للعرض يدوياً (toast/نموذج) دون رمي |

الملفات: `src/utils/apiResponse.js`، الاختبارات `src/utils/apiResponse.test.js`، التوثيق `docs/TOAST_AND_API_MUTATIONS.md`.

## تحقق حسب المنطقة (مُحدَّث مع الكود الحالي)

- [x] **استيراد جماعي** — `ImportExportModal`: فواتير متوازية (`Promise.allSettled`) ترفض `success: false`؛ مبيعات يومية تستخدم `rejectIfApiFailed`.
- [x] **الرواتب / HR** — `PayrollRunFormModal`، `PayrollRunDetailModal` (تحميل)، `AdvancesTab` (حذف/تعديل/تسوية)، `SalaryCalcTab` (`useApiMutation` يعيد استجابة API كاملة)، `ResidencyFormModal`، `LeaveFormModal`، رفع/حفظ وثائق (`EmployeeProfileScreen`، `EmployeeDocModal`).
- [x] **المشتريات** — `PurchasesBatchScreen` (`createInvoiceBatch`)، `BatchEditPanel` (حلقة `onSaveInvoice`).
- [x] **الطلبات** — `ItemsManageTab` (preset: دفعات فئات/منتجات + تحديثات متوازية).
- [x] **البنك** — `BankStatementDetailView` (`createCategory`).
- [x] **OCR** — `ItemsCatalogTab` / `SuppliersCatalogTab` (إنشاء/تعديل/دمج أصناف) مع `assertApiOk` وتنبيه عند الفشل.
- [x] **SmartChat** — بدلات مخصصة بعد إنشاء موظف: `rejectIfApiFailed` مع fallback مترجم.

## ما يزال مقبولاً كاستثناءات

- **`queryFn` في `useQuery`** التي ترجع `[]` أو `{}` عند `!res.success` بدون رمي (قراءة فقط) — لا يلزم توحيدها مع الطفرات.
- **`api.js`** والدوال التي تعيد `res` أو شكلاً مبسّطاً للمتصل — العقد عند حدود الخدمة.

## فحص يدوي سريع بعد تغييرات

1. مسار يستخدم `useApiMutation`: أجبر الـ API على `success: false` — يجب أن يظهر خطأ (toast أو نموذج) وليس نجاحاً صامتاً.
2. مسار استيراد/حلقة: صف واحد فاشل — يُحسب في `failed` / رسالة خطأ وليس كـ `succeeded++`.
