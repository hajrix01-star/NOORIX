-- Split historical read/view permissions from the mutations they formerly allowed.
-- This migration runs once. Existing roles keep their pre-release behavior;
-- roles created afterwards must receive each write permission explicitly.

UPDATE "roles"
SET "permissions" = array_append("permissions", 'BANK_STATEMENTS_WRITE')
WHERE 'VIEW_REPORTS_BANK' = ANY("permissions")
  AND NOT ('BANK_STATEMENTS_WRITE' = ANY("permissions"));

UPDATE "roles"
SET "permissions" = array_append("permissions", 'DASHBOARD_CALENDAR_WRITE')
WHERE 'VIEW_DASHBOARD' = ANY("permissions")
  AND NOT ('DASHBOARD_CALENDAR_WRITE' = ANY("permissions"));

UPDATE "roles"
SET "permissions" = array_append("permissions", 'SUPPLIERS_BOOKMARK_WRITE')
WHERE "permissions" && ARRAY[
  'SUPPLIERS_READ',
  'SUPPLIERS_WRITE',
  'VIEW_INVOICES',
  'INVOICES_READ'
]::TEXT[]
  AND NOT ('SUPPLIERS_BOOKMARK_WRITE' = ANY("permissions"));
