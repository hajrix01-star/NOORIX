-- CreateTable
CREATE TABLE "leave_salary_settlements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "leave_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "payroll_month" TIMESTAMP(3) NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "gross_amount" DECIMAL(18,4) NOT NULL,
    "net_amount" DECIMAL(18,4) NOT NULL,
    "calendar_days_paid" INTEGER NOT NULL,
    "days_in_month" INTEGER NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_salary_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_salary_settlements_leave_id_key" ON "leave_salary_settlements"("leave_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_salary_settlements_invoice_id_key" ON "leave_salary_settlements"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_salary_settlements_employee_id_payroll_month_key" ON "leave_salary_settlements"("employee_id", "payroll_month");

-- CreateIndex
CREATE INDEX "leave_salary_settlements_tenant_id_idx" ON "leave_salary_settlements"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_salary_settlements_company_id_idx" ON "leave_salary_settlements"("company_id");

-- CreateIndex
CREATE INDEX "leave_salary_settlements_company_id_payroll_month_idx" ON "leave_salary_settlements"("company_id", "payroll_month");

-- AddForeignKey
ALTER TABLE "leave_salary_settlements" ADD CONSTRAINT "leave_salary_settlements_leave_id_fkey" FOREIGN KEY ("leave_id") REFERENCES "leaves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_salary_settlements" ADD CONSTRAINT "leave_salary_settlements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_salary_settlements" ADD CONSTRAINT "leave_salary_settlements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
