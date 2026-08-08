-- Durable operational vouchers for internal treasury transfers.
-- Ledger entries remain the only accounting source of vault balances.
ALTER TABLE "vaults"
  ADD COLUMN "bank_reconciliation_enabled" BOOLEAN NOT NULL DEFAULT FALSE;

-- Freeze the pre-existing heuristic once. Future edits to a vault's display name,
-- payment method or operational type must not rewrite historical reconciliation.
UPDATE "vaults"
SET "bank_reconciliation_enabled" = TRUE
WHERE LOWER(COALESCE("type", '')) IN ('bank', 'app')
   OR LOWER(COALESCE("name_en", '')) LIKE '%bank%'
   OR LOWER(COALESCE("name_en", '')) LIKE '%mada%'
   OR LOWER(COALESCE("payment_method", '')) LIKE '%bank%'
   OR LOWER(COALESCE("payment_method", '')) LIKE '%mada%'
   OR COALESCE("name_ar", '') LIKE '%بنك%'
   OR COALESCE("name_ar", '') LIKE '%مدى%'
   OR COALESCE("name_ar", '') LIKE '%شبكة%'
   OR COALESCE("payment_method", '') LIKE '%بنك%'
   OR COALESCE("payment_method", '') LIKE '%مدى%';

CREATE TABLE "vault_transfers" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "transfer_number" TEXT NOT NULL,
  "from_vault_id" TEXT NOT NULL,
  "to_vault_id" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "transaction_date" TIMESTAMP(3) NOT NULL,
  "entry_date" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'posted',
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "ledger_entry_id" TEXT,
  "reversal_of_id" TEXT,
  "reversed_at" TIMESTAMP(3),
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vault_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vault_transfers_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "vault_transfers_distinct_vaults" CHECK ("from_vault_id" <> "to_vault_id"),
  CONSTRAINT "vault_transfers_status_valid" CHECK ("status" IN ('posted', 'reversed')),
  CONSTRAINT "vault_transfers_reversal_not_self" CHECK ("reversal_of_id" IS NULL OR "reversal_of_id" <> "id")
);

CREATE UNIQUE INDEX "vault_transfers_ledger_entry_id_key" ON "vault_transfers"("ledger_entry_id");
CREATE UNIQUE INDEX "vault_transfers_reversal_of_id_key" ON "vault_transfers"("reversal_of_id");
CREATE UNIQUE INDEX "vault_transfers_company_id_transfer_number_key"
  ON "vault_transfers"("company_id", "transfer_number");
CREATE UNIQUE INDEX "vault_transfers_company_id_idempotency_key_key"
  ON "vault_transfers"("company_id", "idempotency_key");
CREATE INDEX "vault_transfers_tenant_id_idx" ON "vault_transfers"("tenant_id");
CREATE INDEX "vault_transfers_company_id_transaction_date_idx"
  ON "vault_transfers"("company_id", "transaction_date");
CREATE INDEX "vault_transfers_company_id_status_transaction_date_idx"
  ON "vault_transfers"("company_id", "status", "transaction_date");
CREATE INDEX "vault_transfers_company_id_from_vault_id_idx"
  ON "vault_transfers"("company_id", "from_vault_id");
CREATE INDEX "vault_transfers_company_id_to_vault_id_idx"
  ON "vault_transfers"("company_id", "to_vault_id");

ALTER TABLE "vault_transfers"
  ADD CONSTRAINT "vault_transfers_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vault_transfers"
  ADD CONSTRAINT "vault_transfers_from_vault_id_fkey"
  FOREIGN KEY ("from_vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vault_transfers"
  ADD CONSTRAINT "vault_transfers_to_vault_id_fkey"
  FOREIGN KEY ("to_vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vault_transfers"
  ADD CONSTRAINT "vault_transfers_ledger_entry_id_fkey"
  FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vault_transfers"
  ADD CONSTRAINT "vault_transfers_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vault_transfers"
  ADD CONSTRAINT "vault_transfers_reversal_of_id_fkey"
  FOREIGN KEY ("reversal_of_id") REFERENCES "vault_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve historical transfer entries as vouchers so details and future reversals remain available.
INSERT INTO "vault_transfers" (
  "id", "tenant_id", "company_id", "transfer_number", "from_vault_id", "to_vault_id",
  "amount", "transaction_date", "entry_date", "notes", "status", "idempotency_key",
  "request_hash", "ledger_entry_id", "created_by_id", "created_at", "updated_at"
)
SELECT
  'legacy-' || le."id",
  le."tenant_id",
  le."company_id",
  CASE
    WHEN ROW_NUMBER() OVER (PARTITION BY le."company_id", le."reference_id" ORDER BY le."created_at", le."id") = 1
      THEN le."reference_id"
    ELSE le."reference_id" || '-' || LEFT(le."id", 6)
  END,
  source_vault."id",
  destination_vault."id",
  le."amount",
  le."transaction_date",
  le."entry_date",
  NULLIF(audit."new_value"->>'notes', ''),
  CASE WHEN le."status" = 'active' THEN 'posted' ELSE 'reversed' END,
  'legacy:' || le."id",
  'legacy:' || le."id",
  le."id",
  le."created_by_id",
  le."created_at",
  le."created_at"
FROM "ledger_entries" le
-- LATERAL + LIMIT makes the migration deterministic even if legacy data contains
-- duplicate vault/account links that predate the current validation rules.
JOIN LATERAL (
  SELECT v."id"
  FROM "vaults" v
  WHERE v."company_id" = le."company_id" AND v."account_id" = le."credit_account_id"
  ORDER BY v."created_at", v."id"
  LIMIT 1
) source_vault ON TRUE
JOIN LATERAL (
  SELECT v."id"
  FROM "vaults" v
  WHERE v."company_id" = le."company_id" AND v."account_id" = le."debit_account_id"
  ORDER BY v."created_at", v."id"
  LIMIT 1
) destination_vault ON TRUE
LEFT JOIN LATERAL (
  SELECT al."new_value"
  FROM "audit_logs" al
  WHERE al."company_id" = le."company_id"
    AND al."entity" = 'transfer'
    AND al."entity_id" = le."id"
  ORDER BY al."created_at" DESC
  LIMIT 1
) audit ON TRUE
WHERE le."reference_type" = 'transfer';

-- Fail closed instead of leaving a historical transfer ledger entry without an
-- operational voucher. Such a row would be balanced but no longer reversible or
-- auditable from the treasury workflow.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ledger_entries" le
    LEFT JOIN "vault_transfers" vt ON vt."ledger_entry_id" = le."id"
    WHERE le."reference_type" = 'transfer' AND vt."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'VAULT_TRANSFER_BACKFILL_INCOMPLETE';
  END IF;
END $$;

ALTER TABLE "vault_transfers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vault_transfers_tenant_select" ON "vault_transfers"
  FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "vault_transfers_tenant_insert" ON "vault_transfers"
  FOR INSERT WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "vault_transfers_tenant_update" ON "vault_transfers"
  FOR UPDATE USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "vault_transfers_tenant_delete" ON "vault_transfers"
  FOR DELETE USING ("tenant_id" = current_tenant_id());
