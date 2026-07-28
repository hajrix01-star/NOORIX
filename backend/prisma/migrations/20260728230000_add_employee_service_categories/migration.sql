-- Additive HR service classification migration.
-- Historical invoices, suppliers, balances, and protected SHAMI TAX data are untouched.

INSERT INTO "categories"
    ("id", "tenant_id", "company_id", "account_id", "code", "name_ar", "name_en",
     "parent_id", "type", "icon", "is_active", "sort_order", "created_at", "updated_at")
SELECT
    'seed_e4_1_' || md5(c."id"), c."tenant_id", c."id", p."account_id",
    'E4-1', 'تذاكر سفر الموظفين', 'Employee Travel Tickets',
    p."id", p."type", NULL, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
JOIN "categories" p ON p."company_id" = c."id" AND p."code" = 'EXP-004'
WHERE upper(regexp_replace(coalesce(c."name_ar", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND upper(regexp_replace(coalesce(c."name_en", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND NOT EXISTS (
      SELECT 1 FROM "categories" x WHERE x."company_id" = c."id" AND x."code" = 'E4-1'
  );

INSERT INTO "categories"
    ("id", "tenant_id", "company_id", "account_id", "code", "name_ar", "name_en",
     "parent_id", "type", "icon", "is_active", "sort_order", "created_at", "updated_at")
SELECT
    'seed_e4_2_' || md5(c."id"), c."tenant_id", c."id", p."account_id",
    'E4-2', 'التأمين الطبي للموظفين', 'Employee Medical Insurance',
    p."id", p."type", NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
JOIN "categories" p ON p."company_id" = c."id" AND p."code" = 'EXP-004'
WHERE upper(regexp_replace(coalesce(c."name_ar", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND upper(regexp_replace(coalesce(c."name_en", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND NOT EXISTS (
      SELECT 1 FROM "categories" x WHERE x."company_id" = c."id" AND x."code" = 'E4-2'
  );
