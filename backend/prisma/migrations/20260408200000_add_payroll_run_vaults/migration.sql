-- CreateTable
CREATE TABLE "payroll_run_vaults" (
    "id" TEXT NOT NULL,
    "payroll_run_id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "payroll_run_vaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_run_vaults_payroll_run_id_idx" ON "payroll_run_vaults"("payroll_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_vaults_payroll_run_id_vault_id_key" ON "payroll_run_vaults"("payroll_run_id", "vault_id");

-- AddForeignKey
ALTER TABLE "payroll_run_vaults" ADD CONSTRAINT "payroll_run_vaults_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_vaults" ADD CONSTRAINT "payroll_run_vaults_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
