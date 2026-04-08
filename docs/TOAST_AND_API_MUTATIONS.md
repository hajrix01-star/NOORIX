# Toast المركزي وعقد الطفرات (API mutations)

## الهدف

- **إشعار واحد** عبر `ToastProvider` + `useToast().showToast(message, type)` بدلاً من `useState` محلي لكل شاشة.
- **سلوك موحّد لـ React Query**: أي استجابة API بالشكل `{ success: false }` تُعامل كفشل (تنتقل لـ `onError`) وليس نجاحاً صامتاً.
- **إبطال كاش متسق** عبر `invalidateQueries` في `useApiMutation` حيث يناسب.

## المكوّنات

| جزء | المسار | الدور |
|-----|--------|--------|
| السياق | `src/context/ToastContext.jsx` | `showToast`, `dismiss`؛ منع تكرار نفس الرسالة/النوع خلال ~2.2 ثانية. |
| الطبقة | `src/hooks/useApiMutation.js` | يلف `useMutation` + `rejectIfApiFailed` + toast اختياري + إبطال مفاتيح. |
| عقد الاستجابة | `src/utils/apiResponse.js` | `rejectIfApiFailed`, `getApiErrorMessage` — للاستخدام في طفرات أو اختبارات. |
| الاختبارات | `src/utils/apiResponse.test.js` | `vitest` على منطق `success === false`. |

## قواعد الاستخدام

1. **شاشات ونماذج**: عند استخدام TanStack Query للطفرات، فضّل `useApiMutation` مع `successToast` / `errorToast` (أو `showErrorToast: false` إذا كان العرض داخل النموذج فقط).
2. **خطافات بيانات مشتركة** (`useEmployees`, `useOrders`, …): غالباً `showErrorToast: false` و`successToast` غير مُعرّف — الشاشة تتولى الرسائل؛ المهم هو **رفض** `success: false` تلقائياً.
3. **استجابات بلا حقل `success`**: `rejectIfApiFailed` لا يفعل شيئاً؛ يمكن إرجاع `data` فقط من `mutationFn` كما في دفعات المشتريات بعد التحقق اليدوي.
4. **i18n**: مفاتيح عامة في `src/i18n/translations/common.js` مثل `apiRequestFailed`, `saveFailedGeneric`, `expenseBatchSelectVault`.

## قائمة تحقق (مكتملة في الكود الحالي)

- [x] استبدال `useMutation` المباشر في الخطافات والشاشات المذكورة في سجل Git لهذا التغيير بـ `useApiMutation` حيث ينطبق.
- [x] `ToastContext` مع منطق تقليل التكرار.
- [x] `apiResponse.js` + اختبارات Vitest.
- [x] مفاتيح ترجمة مساعدة للرسائل المشتركة.
- [x] قاعدة Cursor: `.cursor/rules/api-mutations-toast.mdc`.

## مراجع

- إبطال البيانات المالية: `src/utils/queryInvalidation.js` و`docs/PERFORMANCE_AND_DATA.md` إن وُجد.
- مكوّنات الواجهة والنوافذ: `.cursor/rules/ui-components.mdc`.
