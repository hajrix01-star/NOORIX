BEGIN;

-- Keep payroll (EXP-004) exclusively for cash/earned salaries. Employee
-- services are operational expenses in their own account tree.
INSERT INTO "accounts" (
  "id", "tenant_id", "company_id", "code", "name_ar", "name_en",
  "type", "icon", "tax_exempt", "is_active", "created_at", "updated_at"
)
SELECT
  'seed_exp_009_' || md5(c."id"),
  c."tenant_id",
  c."id",
  'EXP-009',
  'خدمات ومزايا الموظفين',
  'Employee Services & Benefits',
  'expense',
  '👥',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" c
WHERE upper(regexp_replace(coalesce(c."name_ar", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND upper(regexp_replace(coalesce(c."name_en", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND NOT EXISTS (
    SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = 'EXP-009'
  );

INSERT INTO "categories" (
  "id", "tenant_id", "company_id", "account_id", "reporting_class", "code",
  "name_ar", "name_en", "parent_id", "type", "icon", "is_active", "sort_order", "created_at", "updated_at"
)
SELECT
  'seed_cat_exp_009_' || md5(c."id"),
  c."tenant_id",
  c."id",
  a."id",
  'operating_other_expense',
  'EXP-009',
  'خدمات ومزايا الموظفين',
  'Employee Services & Benefits',
  NULL,
  'expense',
  '👥',
  true,
  5,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" c
JOIN "accounts" a ON a."company_id" = c."id" AND a."code" = 'EXP-009'
WHERE upper(regexp_replace(coalesce(c."name_ar", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND upper(regexp_replace(coalesce(c."name_en", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND NOT EXISTS (
    SELECT 1 FROM "categories" x WHERE x."company_id" = c."id" AND x."code" = 'EXP-009'
  );

-- Move the existing category records rather than replacing them: invoices,
-- suppliers and ledger reporting snapshots retain their IDs and amounts.
UPDATE "categories" child
SET
  "parent_id" = parent."id",
  "account_id" = parent."account_id",
  "code" = CASE child."code" WHEN 'E4-1' THEN 'E9-1' WHEN 'E4-2' THEN 'E9-2' ELSE child."code" END,
  "reporting_class" = CASE child."code"
    WHEN 'E4-2' THEN 'operating_recurring_expense'
    ELSE 'operating_other_expense'
  END,
  "updated_at" = CURRENT_TIMESTAMP
FROM "categories" parent
WHERE parent."company_id" = child."company_id"
  AND parent."code" = 'EXP-009'
  AND child."code" IN ('E4-1', 'E4-2');

-- GOSI is an employer benefit, not a government licensing/iqama expense.
UPDATE "categories" child
SET
  "parent_id" = parent."id",
  "account_id" = parent."account_id",
  "code" = 'E9-3',
  "name_ar" = 'التأمينات الاجتماعية (GOSI)',
  "name_en" = 'GOSI Employer Contributions',
  "reporting_class" = 'operating_recurring_expense',
  "sort_order" = 2,
  "updated_at" = CURRENT_TIMESTAMP
FROM "categories" parent
WHERE parent."company_id" = child."company_id"
  AND parent."code" = 'EXP-009'
  AND child."code" = 'E2-8';

-- Companies created before employee-service categories existed may not have
-- the legacy children above. Add the three current defaults idempotently.
INSERT INTO "categories" (
  "id", "tenant_id", "company_id", "account_id", "reporting_class", "code",
  "name_ar", "name_en", "parent_id", "type", "icon", "is_active", "sort_order", "created_at", "updated_at"
)
SELECT
  'seed_' || lower(s."code") || '_' || md5(c."id"),
  c."tenant_id",
  c."id",
  parent."account_id",
  s."reporting_class",
  s."code",
  s."name_ar",
  s."name_en",
  parent."id",
  'expense',
  NULL,
  true,
  s."sort_order",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" c
JOIN "categories" parent ON parent."company_id" = c."id" AND parent."code" = 'EXP-009'
CROSS JOIN (
  VALUES
    ('E9-1', 'تذاكر سفر الموظفين', 'Employee Travel Tickets', 'operating_other_expense', 0),
    ('E9-2', 'التأمين الطبي للموظفين', 'Employee Medical Insurance', 'operating_recurring_expense', 1),
    ('E9-3', 'التأمينات الاجتماعية (GOSI)', 'GOSI Employer Contributions', 'operating_recurring_expense', 2)
) AS s("code", "name_ar", "name_en", "reporting_class", "sort_order")
WHERE upper(regexp_replace(coalesce(c."name_ar", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND upper(regexp_replace(coalesce(c."name_en", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND NOT EXISTS (
    SELECT 1 FROM "categories" x WHERE x."company_id" = c."id" AND x."code" = s."code"
  );

-- Future default selection for the GOSI directory entry follows the new tree.
UPDATE "supplier_directory_entries"
SET "default_category_code" = 'E9-3'
WHERE "code" = 'GOV-GOSI'
  AND "default_category_code" = 'E2-8';

COMMIT;
