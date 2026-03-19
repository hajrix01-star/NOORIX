-- AlterTable
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "supplier_invoice_number" TEXT;
