-- Roll back only the supplier link introduced for employee-service records.
-- Suppliers, invoices, and employee-service records remain untouched.

ALTER TABLE "employee_residencies"
    DROP CONSTRAINT IF EXISTS "employee_residencies_supplier_id_fkey";

DROP INDEX IF EXISTS "employee_residencies_company_id_supplier_id_idx";

ALTER TABLE "employee_residencies"
    DROP COLUMN IF EXISTS "supplier_id";
