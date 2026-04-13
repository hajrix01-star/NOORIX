-- AlterTable
ALTER TABLE "vaults" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "vaults_company_id_sort_order_idx" ON "vaults"("company_id", "sort_order");
