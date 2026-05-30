-- بنود طلبات الموظفين: حجم/تعبئة/سعر + ربط بطلب المشتريات المجمّع
ALTER TABLE "staff_order_items" ADD COLUMN IF NOT EXISTS "size" TEXT;
ALTER TABLE "staff_order_items" ADD COLUMN IF NOT EXISTS "packaging" TEXT;
ALTER TABLE "staff_order_items" ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(18,4);

ALTER TABLE "staff_orders" ADD COLUMN IF NOT EXISTS "purchase_order_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_orders_purchase_order_fk'
  ) THEN
    ALTER TABLE "staff_orders"
      ADD CONSTRAINT "staff_orders_purchase_order_fk"
      FOREIGN KEY ("purchase_order_id") REFERENCES "orders"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "staff_orders_purchase_order_idx" ON "staff_orders"("purchase_order_id");

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source_staff_order_ids" JSONB;
