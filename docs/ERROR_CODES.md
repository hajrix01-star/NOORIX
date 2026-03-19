# أكواد الأخطاء — Noorix

مرجع موحد لأكواد الأخطاء المستخدمة في المحرك المالي والـ API. الواجهة والـ Backend يعرضان رسالة من هذا المرجع عند الحاجة.

| الكود | EN | AR |
|--------|-----|-----|
| `TRANSACTION_PAYLOAD_REQUIRED` | Transaction payload is required. | مطلوب بيانات المعاملة. |
| `TRANSACTION_KIND_REQUIRED` | Transaction kind is required. | مطلوب نوع المعاملة. |
| `RUN_IN_TRANSACTION_REQUIRED` | DB transaction runner is required. | مطلوب تنفيذ المعاملة داخل جلسة قاعدة البيانات. |
| `TRANSACTION_AMOUNT_MUST_BE_POSITIVE` | Amount must be greater than zero. | المبلغ يجب أن يكون أكبر من صفر. |
| `SUPPLIER_REQUIRED` | Supplier is required for this operation. | المورد مطلوب لهذه العملية. |
| `PAYMENT_METHOD_REQUIRED` | Payment method is required. | طريقة الدفع مطلوبة. |
| `TRANSACTION_DATE_REQUIRED` | Transaction date is required. | تاريخ العملية مطلوب. |
| `INVALID_TRANSACTION_DATE` | Invalid transaction date. | تاريخ العملية غير صالح. |
| `VAULT_REQUIRED` | Vault (treasury) is required. | الخزينة مطلوبة. |
| `FETCH_FAILED` | Failed to load data. | فشل تحميل البيانات. |
| `UNAUTHORIZED` | Unauthorized. | غير مصرح. |
| `FORBIDDEN` | Access denied. | ممنوع الوصول. |
| `COMPANY_REQUIRED` | Company context is required. | سياق الشركة مطلوب. |

استجابة الـ API الموحدة عند خطأ: `{ success: false, error: "<رسالة>", code: "<الكود>" }`.
