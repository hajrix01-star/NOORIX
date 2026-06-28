-- Prevent duplicate active salary invoices for the same payroll run.
-- Purchase/expense batches intentionally allow many invoices per batch, so this is a partial index.
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_unique_active_salary_batch"
  ON "invoices" ("company_id", "batch_id", "kind")
  WHERE "batch_id" IS NOT NULL
    AND "kind" = 'salary'
    AND "status" = 'active';
