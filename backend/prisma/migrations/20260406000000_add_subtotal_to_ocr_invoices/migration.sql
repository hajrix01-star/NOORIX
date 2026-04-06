-- إضافة عمود subtotal_amount لفواتير OCR (المجموع قبل الضريبة)
ALTER TABLE "public"."ocr_invoices"
  ADD COLUMN IF NOT EXISTS "subtotal_amount" DECIMAL(14,2);
