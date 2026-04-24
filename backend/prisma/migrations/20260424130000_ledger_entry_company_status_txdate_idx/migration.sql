-- فهرس للتقارير والاستعلامات الشائعة: شركة + حالة القيد + تاريخ الحركة
CREATE INDEX IF NOT EXISTS "ledger_entries_company_id_status_transaction_date_idx"
  ON "ledger_entries" ("company_id", "status", "transaction_date");
