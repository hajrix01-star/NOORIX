-- A legacy cutover opening is an explicit inventory event. Keep it distinct from
-- receipts and stocktakes so audit reports never misclassify the opening balance.
ALTER TABLE "orders_v4_inventory_ledger"
  DROP CONSTRAINT "orders_v4_inventory_entry_type_check";

ALTER TABLE "orders_v4_inventory_ledger"
  ADD CONSTRAINT "orders_v4_inventory_entry_type_check"
  CHECK ("entry_type" IN (
    'receipt', 'issue', 'transfer_in', 'transfer_out',
    'stocktake_adjustment', 'negative_stock_revaluation', 'reversal', 'unit_rebase',
    'cutover_opening'
  ));
