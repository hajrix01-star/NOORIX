-- تسوية السلف عند اعتماد المسيرة: منع التكرار عند صرف المسيرة لاحقاً
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "advance_settlements_applied_at" TIMESTAMP(3);
