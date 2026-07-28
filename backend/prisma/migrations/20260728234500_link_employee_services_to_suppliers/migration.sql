-- Store the visible, editable service entity directly on the employee-service record.
-- Existing invoices and supplier identities are not changed.

ALTER TABLE "employee_residencies"
    ADD COLUMN "supplier_id" TEXT;

CREATE INDEX "employee_residencies_company_id_supplier_id_idx"
    ON "employee_residencies"("company_id", "supplier_id");

ALTER TABLE "employee_residencies"
    ADD CONSTRAINT "employee_residencies_supplier_id_fkey"
    FOREIGN KEY ("supplier_id")
    REFERENCES "suppliers"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Backfill only canonical links already present in the same company.
-- Variable entities (flight tickets and medical insurance) remain empty.
UPDATE "employee_residencies" er
SET "supplier_id" = s."id",
    "updated_at" = CURRENT_TIMESTAMP
FROM "suppliers" s
WHERE s."company_id" = er."company_id"
  AND s."is_deleted" = false
  AND s."directory_entry_id" = CASE er."service_category"
      WHEN 'iqama_new' THEN 'GOV-PASSPORTS'
      WHEN 'iqama_renewal' THEN 'GOV-HRSD'
      WHEN 'sponsorship_transfer' THEN 'GOV-HRSD'
      WHEN 'exit_reentry_visa' THEN 'GOV-PASSPORTS'
      WHEN 'health_certificate' THEN 'GOV-MOMAH'
      ELSE NULL
  END
  AND er."supplier_id" IS NULL;
