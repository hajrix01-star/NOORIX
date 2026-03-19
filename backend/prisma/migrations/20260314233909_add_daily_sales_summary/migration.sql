-- CreateTable
CREATE TABLE "daily_sales_summaries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "summary_number" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "customer_count" INTEGER NOT NULL DEFAULT 0,
    "cash_on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by_id" TEXT,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_sales_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_sales_channels" (
    "id" TEXT NOT NULL,
    "summary_id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "daily_sales_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_sales_summaries_company_id_transaction_date_idx" ON "daily_sales_summaries"("company_id", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_summaries_company_id_summary_number_key" ON "daily_sales_summaries"("company_id", "summary_number");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_channels_summary_id_vault_id_key" ON "daily_sales_channels"("summary_id", "vault_id");

-- AddForeignKey
ALTER TABLE "daily_sales_summaries" ADD CONSTRAINT "daily_sales_summaries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_sales_summaries" ADD CONSTRAINT "daily_sales_summaries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_sales_channels" ADD CONSTRAINT "daily_sales_channels_summary_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "daily_sales_summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_sales_channels" ADD CONSTRAINT "daily_sales_channels_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
