-- Non-destructive rollback for the HR service categories.
-- A category is removed only while it has no supplier, expense-line, invoice, or child references.

DELETE FROM "categories" c
WHERE c."code" IN ('E4-1', 'E4-2')
  AND c."id" LIKE 'seed_e4_%'
  AND NOT EXISTS (SELECT 1 FROM "suppliers" s WHERE s."supplier_category_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "expense_lines" e WHERE e."category_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "invoices" i WHERE i."category_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "categories" child WHERE child."parent_id" = c."id");
