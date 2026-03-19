# توثيق "تعديل فاتورة" في جدول الـ Audit Log

لضمان الشفافية التامة، كل تعديل على فاتورة يُسجَّل في جدول `audit_logs` بالقيمة القديمة والجديدة ومن قام بالعملية.

## شكل السجل عند التعديل (action = `update`)

| العمود      | الوصف |
|------------|--------|
| `company_id` | الشركة |
| `user_id`    | المستخدم الذي عدّل (إن وُجد) |
| `action`     | `update` |
| `entity`     | `invoice` |
| `entity_id`  | معرّف الفاتورة |
| **`old_value`** | لقطة الفاتورة **قبل** التعديل (JSON) |
| **`new_value`** | لقطة الفاتورة **بعد** التعديل (JSON) |
| `created_at` | وقت التسجيل (توقيت السعودية) |

## شكل لقطة الفاتورة (old_value / new_value)

كل من `old_value` و `new_value` كائن JSON يحتوي الحقول التالية (بنفس الشكل في الـ Backend في `AuditLogService.invoiceToSnapshot`):

```json
{
  "id": "clxx...",
  "companyId": "clxx...",
  "supplierId": "clxx...",
  "invoiceNumber": "INV-001",
  "kind": "purchase",
  "totalAmount": "1150.00",
  "netAmount": "1000.00",
  "taxAmount": "150.00",
  "transactionDate": "2025-03-15T00:00:00.000Z",
  "vaultId": "clxx...",
  "paymentMethodId": null,
  "batchId": null,
  "status": "active",
  "entryDate": "2025-03-15T12:30:00.000Z",
  "createdAt": "2025-03-15T12:30:00.000Z",
  "updatedAt": "2025-03-15T14:00:00.000Z"
}
```

المبالغ تُخزَّن كنص (string) للحفاظ على الدقة ولتجنب اختلاف الترميز بين الأنظمة.

## مثال استعلام لمراجعة تعديلات فاتورة

```sql
SELECT id, user_id, action, old_value, new_value, created_at
FROM audit_logs
WHERE entity = 'invoice' AND entity_id = '<invoice_id>'
ORDER BY created_at DESC;
```

بهذا يمكن مراجعة: من غيّر المبلغ، من غيّر المورد، ومتى، مع القيمة القديمة والجديدة بالكامل.
