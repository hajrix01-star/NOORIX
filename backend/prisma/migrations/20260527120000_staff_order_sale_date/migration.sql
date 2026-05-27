-- تاريخ المبيعات (يوم العمل) — منفصل عن created_at للتقارير
ALTER TABLE "staff_orders" ADD COLUMN IF NOT EXISTS "sale_date" DATE;
