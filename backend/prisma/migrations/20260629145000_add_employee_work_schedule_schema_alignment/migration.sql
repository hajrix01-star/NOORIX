ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "work_hours" TEXT;

ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "work_schedule" TEXT;
