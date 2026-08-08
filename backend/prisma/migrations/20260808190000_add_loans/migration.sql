CREATE TABLE "loans" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "creditor_name" TEXT,
  "opening_amount" DECIMAL(18,4) NOT NULL,
  "outstanding_amount" DECIMAL(18,4) NOT NULL,
  "historical_payments_count" INTEGER NOT NULL DEFAULT 0,
  "historical_paid_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "historical_paid_through_date" TIMESTAMP(3),
  "opening_date" TIMESTAMP(3) NOT NULL,
  "due_date" TIMESTAMP(3),
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" TEXT,
  "opening_ledger_entry_id" TEXT UNIQUE,
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loans_amounts_valid" CHECK ("opening_amount" > 0 AND "outstanding_amount" >= 0 AND "outstanding_amount" <= "opening_amount" AND "historical_payments_count" >= 0 AND "historical_paid_amount" >= 0),
  CONSTRAINT "loans_dates_valid" CHECK ("due_date" IS NULL OR "due_date" >= "opening_date"),
  CONSTRAINT "loans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "loans_opening_ledger_entry_id_fkey" FOREIGN KEY ("opening_ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "loans_tenant_id_idx" ON "loans"("tenant_id");
CREATE INDEX "loans_company_id_is_active_idx" ON "loans"("company_id", "is_active");
CREATE UNIQUE INDEX "loans_company_id_idempotency_key_key" ON "loans"("company_id", "idempotency_key");

CREATE TABLE "loan_payments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "vault_id" TEXT NOT NULL,
  "ledger_entry_id" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "transaction_date" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "created_by_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'posted',
  "reversal_of_id" TEXT UNIQUE,
  "reversed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loan_payments_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "loan_payments_status_valid" CHECK ("status" IN ('posted', 'reversed')),
  CONSTRAINT "loan_payments_no_self_reversal" CHECK ("reversal_of_id" IS NULL OR "reversal_of_id" <> "id"),
  CONSTRAINT "loan_payments_ledger_entry_id_key" UNIQUE ("ledger_entry_id"),
  CONSTRAINT "loan_payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "loan_payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "loan_payments_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "loan_payments_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "loan_payments_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "loan_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "loan_payments_tenant_id_idx" ON "loan_payments"("tenant_id");
CREATE INDEX "loan_payments_company_id_loan_id_transaction_date_idx" ON "loan_payments"("company_id", "loan_id", "transaction_date");
CREATE UNIQUE INDEX "loan_payments_company_id_idempotency_key_key" ON "loan_payments"("company_id", "idempotency_key");

INSERT INTO "accounts" ("id", "tenant_id", "company_id", "code", "name_ar", "name_en", "type", "icon", "tax_exempt", "is_active", "created_at", "updated_at")
SELECT concat('loan-', c."id"), c."tenant_id", c."id", 'LOAN-001', 'قروض والتزامات مالية', 'Loans & Financial Obligations', 'liability', '📄', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = 'LOAN-001');

INSERT INTO "accounts" ("id", "tenant_id", "company_id", "code", "name_ar", "name_en", "type", "icon", "tax_exempt", "is_active", "created_at", "updated_at")
SELECT concat('opening-balance-', c."id"), c."tenant_id", c."id", 'EQU-002', 'تسوية أرصدة افتتاحية', 'Opening balance clearing', 'equity', '⚖️', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = 'EQU-002');

ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loans" FORCE ROW LEVEL SECURITY;
ALTER TABLE "loan_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loan_payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "loans_tenant_select" ON "loans" FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "loans_tenant_insert" ON "loans" FOR INSERT WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "loans_tenant_update" ON "loans" FOR UPDATE USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "loans_tenant_delete" ON "loans" FOR DELETE USING ("tenant_id" = current_tenant_id());
CREATE POLICY "loan_payments_tenant_select" ON "loan_payments" FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "loan_payments_tenant_insert" ON "loan_payments" FOR INSERT WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "loan_payments_tenant_update" ON "loan_payments" FOR UPDATE USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "loan_payments_tenant_delete" ON "loan_payments" FOR DELETE USING ("tenant_id" = current_tenant_id());
