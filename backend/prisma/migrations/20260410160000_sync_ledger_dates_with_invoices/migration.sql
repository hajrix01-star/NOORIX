-- مزامنة تواريخ قيود دفتر الأستاذ مع تواريخ الفواتير
-- تُصحح حالات تم فيها تعديل تاريخ الفاتورة دون تحديث القيود المقابلة

UPDATE ledger_entries le
SET    transaction_date = i.transaction_date
FROM   invoices i
WHERE  le.reference_id   = i.id
  AND  le.reference_type IN ('invoice', 'salary', 'advance')
  AND  le.status         = 'active'
  AND  le.transaction_date::date <> i.transaction_date::date;
