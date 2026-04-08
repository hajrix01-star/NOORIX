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
| عقد الاستجابة | `src/utils/apiResponse.js` | `rejectIfApiFailed`, `getApiErrorMessage`, `assertApiOk` — للطفرات اليدوية، الحلقات، و`Promise.allSettled`. |
| الاختبارات | `src/utils/apiResponse.test.js` | `vitest` على منطق `success === false`. |
| قائمة تحقق | `docs/MUTATION_AUDIT_CHECKLIST.md` | مراجعة مناطق الكتابة وما يُستثنى. |

## قواعد الاستخدام

1. **شاشات ونماذج**: عند استخدام TanStack Query للطفرات، فضّل `useApiMutation` مع `successToast` / `errorToast` (أو `showErrorToast: false` إذا كان العرض داخل النموذج فقط).
2. **خطافات بيانات مشتركة** (`useEmployees`, `useOrders`, …): غالباً `showErrorToast: false` و`successToast` غير مُعرّف — الشاشة تتولى الرسائل؛ المهم هو **رفض** `success: false` تلقائياً.
3. **استجابات بلا حقل `success`**: `rejectIfApiFailed` / `assertApiOk` لا يفعلان شيئاً؛ يمكن إرجاع `data` فقط من `mutationFn` كما في دفعات المشتريات بعد التحقق اليدوي على الاستجابة الكاملة.
4. **`assertApiOk(result, fallback)`**: بعد `await` — يستدعي `rejectIfApiFailed(result, fallback)` (نفس استخراج الرسالة من الـ API) ثم يعيد `result`. لا تلف `fallback` بـ `getApiErrorMessage` مسبقاً.
5. **i18n**: مفاتيح عامة في `src/i18n/translations/common.js` مثل `apiRequestFailed`, `saveFailedGeneric`, `expenseBatchSelectVault`.

## قائمة تحقق (مكتملة في الكود الحالي)

- [x] استبدال `useMutation` المباشر في الخطافات والشاشات المذكورة في سجل Git لهذا التغيير بـ `useApiMutation` حيث ينطبق.
- [x] مسارات إضافية: حذف فاتورة من `InvoicesListScreen`، حفظ `InvoiceEditModal`، الحذف النهائي للموظف من `StaffListScreen` و`EmployeeProfileScreen`.
- [x] مسارات متعددة الخطوات (مزامنة بدلات، إلغاء دفعة مشتريات، استيراد فواتير/مبيعات، نماذج HR، preset الطلبات، OCR، بدلات من المحادثة): `rejectIfApiFailed` / `getApiErrorMessage` / `assertApiOk` من `apiResponse.js` بدل `if (!res.success) throw` المتكرر.
- [x] `ToastContext` مع منطق تقليل التكرار.
- [x] `apiResponse.js` + اختبارات Vitest.
- [x] مفاتيح ترجمة مساعدة للرسائل المشتركة.
- [x] قاعدة Cursor: `.cursor/rules/api-mutations-toast.mdc`.

## مراجع

- إبطال البيانات المالية: `src/utils/queryInvalidation.js` و`docs/PERFORMANCE_AND_DATA.md` إن وُجد.
- مكوّنات الواجهة والنوافذ: `.cursor/rules/ui-components.mdc`.
