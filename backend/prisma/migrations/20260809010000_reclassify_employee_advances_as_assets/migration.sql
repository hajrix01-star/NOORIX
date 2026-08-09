-- السلف ليست مصروفاً عند صرفها: هي أصل على الموظف حتى تسويتها في مسير راتبه.
-- هذا الترحيل يعيد تصنيف السلف النشطة، ويضيف قيود تسوية تاريخية مرتبطة بالخصومات
-- المسجلة سابقاً كي يبقى إجمالي تكلفة الرواتب صحيحاً في شهر المسير.

INSERT INTO "accounts" (
  "id", "tenant_id", "company_id", "code", "name_ar", "name_en", "type", "icon", "tax_exempt", "is_active", "created_at", "updated_at"
)
SELECT
  'adv-001-' || c."id",
  c."tenant_id",
  c."id",
  'ADV-001',
  'سلف الموظفين',
  'Employee Advances',
  'asset',
  '👥',
  true,
  true,
  NOW(),
  NOW()
FROM "companies" c
ON CONFLICT ("company_id", "code") DO NOTHING;

-- إعادة تصنيف أصل السلفة فقط. الفواتير والرصيد النقدي لا يتغيران.
UPDATE "ledger_entries" le
SET "debit_account_id" = advance_account."id"
FROM "accounts" advance_account,
     "invoices" inv
WHERE le."reference_type" = 'advance'
  AND le."status" = 'active'
  AND inv."id" = le."reference_id"
  AND inv."company_id" = le."company_id"
  AND inv."kind" = 'advance'
  AND inv."status" = 'active'
  AND advance_account."company_id" = le."company_id"
  AND advance_account."code" = 'ADV-001'
  AND advance_account."type" = 'asset';

-- كل خصم سلفة مسجل سابقاً يقفل جزءاً من الأصل ويرحله إلى رواتب وأجور، بلا نقد جديد.
INSERT INTO "ledger_entries" (
  "id", "tenant_id", "company_id", "debit_account_id", "credit_account_id", "amount",
  "transaction_date", "entry_date", "reference_type", "reference_id", "vault_id", "employee_id", "created_by_id", "status", "created_at"
)
SELECT
  md5('advance-settlement:' || d."id"),
  d."tenant_id",
  d."company_id",
  salary_account."id",
  advance_account."id",
  d."amount",
  d."transaction_date",
  d."transaction_date",
  'advance_settlement',
  d."id",
  NULL,
  d."employee_id",
  NULL,
  'active',
  NOW()
FROM "employee_deductions" d
JOIN "invoices" inv
  ON inv."id" = d."reference_id"
 AND inv."company_id" = d."company_id"
 AND inv."kind" = 'advance'
 AND inv."status" = 'active'
JOIN "accounts" salary_account
  ON salary_account."company_id" = d."company_id"
 AND salary_account."code" = 'EXP-004'
 AND salary_account."type" = 'expense'
 AND salary_account."is_active" = true
JOIN "accounts" advance_account
  ON advance_account."company_id" = d."company_id"
 AND advance_account."code" = 'ADV-001'
 AND advance_account."type" = 'asset'
 AND advance_account."is_active" = true
WHERE d."deduction_type" = 'advance'
  AND d."amount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "ledger_entries" existing
    WHERE existing."reference_type" = 'advance_settlement'
      AND existing."reference_id" = d."id"
  );
