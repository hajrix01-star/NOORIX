CREATE INDEX IF NOT EXISTS "orders_v4_documents_company_status_document_date_idx"
  ON "orders_v4_documents" ("company_id", "status", "document_date");

CREATE INDEX IF NOT EXISTS "orders_v4_documents_creator_type_document_date_idx"
  ON "orders_v4_documents" ("company_id", "created_by_user_id", "document_type", "document_date");

CREATE INDEX IF NOT EXISTS "orders_v4_documents_registration_status_date_idx"
  ON "orders_v4_documents" ("company_id", "document_type", "registration_entry_type", "status", "document_date");

CREATE INDEX IF NOT EXISTS "orders_v4_custody_company_effective_at_idx"
  ON "orders_v4_custody_ledger" ("company_id", "effective_at");
