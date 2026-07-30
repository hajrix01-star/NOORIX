ALTER TABLE "staff_orders"
  ADD COLUMN "entry_type" TEXT NOT NULL DEFAULT 'issue';

ALTER TABLE "staff_order_items"
  ADD COLUMN "cancellation_reasons" JSONB;

ALTER TABLE "staff_orders"
  ADD CONSTRAINT "staff_orders_entry_type_check"
  CHECK ("entry_type" IN ('issue', 'cancellation'));

CREATE INDEX "staff_orders_company_id_order_type_entry_type_sale_date_idx"
  ON "staff_orders"("company_id", "order_type", "entry_type", "sale_date");
