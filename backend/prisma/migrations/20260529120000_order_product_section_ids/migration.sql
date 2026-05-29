-- ربط الأصناف بالأقسام عبر معرّفات ثابتة (مع الإبقاء على أسماء sections للتوافق)
ALTER TABLE "order_products" ADD COLUMN IF NOT EXISTS "section_ids" JSONB;
