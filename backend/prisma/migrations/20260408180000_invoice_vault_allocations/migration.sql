-- CreateTable
CREATE TABLE "invoice_vault_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_vault_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_vault_allocations_tenant_id_idx" ON "invoice_vault_allocations"("tenant_id");

-- CreateIndex
CREATE INDEX "invoice_vault_allocations_invoice_id_idx" ON "invoice_vault_allocations"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_vault_allocations_vault_id_idx" ON "invoice_vault_allocations"("vault_id");

-- AddForeignKey
ALTER TABLE "invoice_vault_allocations" ADD CONSTRAINT "invoice_vault_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_vault_allocations" ADD CONSTRAINT "invoice_vault_allocations_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
