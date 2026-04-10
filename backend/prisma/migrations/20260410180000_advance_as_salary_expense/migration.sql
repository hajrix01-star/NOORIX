-- معالجة محاسبية: السلفيات = جزء من الراتب (أساس نقدي)
-- تُحوَّل قيود السلفيات التاريخية من حساب أصول → حساب رواتب وأجور (EXP-004)
-- بعد هذا التحديث ستظهر السلفيات في تقرير الأرباح والخسائر وفي الرسوم البيانية

UPDATE ledger_entries le
SET    debit_account_id = (
         SELECT a.id
         FROM   accounts a
         WHERE  a.company_id = le.company_id
           AND  a.code       = 'EXP-004'   -- رواتب وأجور
           AND  a.is_active  = true
         LIMIT  1
       )
WHERE  le.reference_type = 'advance'
  AND  le.status         = 'active'
  AND  EXISTS (
         SELECT 1 FROM accounts a
         WHERE  a.company_id = le.company_id
           AND  a.code       = 'EXP-004'
       );
