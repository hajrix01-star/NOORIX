-- Add employee_serial and other_allowance to employees
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "employee_serial" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "other_allowance" DECIMAL(18, 4) NOT NULL DEFAULT 0;

-- Backfill employee_serial for existing rows (unique per company, format EMP-ST-001)
UPDATE "employees" e
SET "employee_serial" = sub.new_serial
FROM (
  SELECT id, 'EMP-ST-' || LPAD((ROW_NUMBER() OVER (PARTITION BY "company_id" ORDER BY "created_at", "id"))::text, 3, '0') AS new_serial
  FROM "employees"
  WHERE "employee_serial" IS NULL
) sub
WHERE e.id = sub.id AND e."employee_serial" IS NULL;

-- Make employee_serial NOT NULL
ALTER TABLE "employees" ALTER COLUMN "employee_serial" SET NOT NULL;

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "employees_company_id_employee_serial_key"
ON "employees"("company_id", "employee_serial");
