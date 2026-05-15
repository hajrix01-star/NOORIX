-- Staff order drafts + optional product on line items
-- Idempotent: safe to re-run.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_staff_request" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "staff_digest_sent_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "orders_company_id_is_staff_request_staff_digest_sent_at_idx"
  ON "orders" ("company_id", "is_staff_request", "staff_digest_sent_at");

-- ADD FK only if not already present (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_created_by_user_id_fkey') THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_created_by_user_id_fkey"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "custom_label_ar" TEXT;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "custom_label_en" TEXT;

ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;

ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_fkey";
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "order_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
