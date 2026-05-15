-- staff_orders: طلبات الموظفين (مطبخ، بار، ...) — idempotent (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_orders') THEN
    CREATE TABLE staff_orders (
      id           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
      tenant_id    TEXT        NOT NULL,
      company_id   TEXT        NOT NULL,
      user_id      TEXT        NOT NULL,
      section_name TEXT        NOT NULL,
      status       TEXT        NOT NULL DEFAULT 'pending',
      notes        TEXT,
      sent_at      TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT staff_orders_pkey PRIMARY KEY (id),
      CONSTRAINT staff_orders_company_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      CONSTRAINT staff_orders_user_fk    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE
    );
    CREATE INDEX staff_orders_tenant_idx         ON staff_orders(tenant_id);
    CREATE INDEX staff_orders_company_idx        ON staff_orders(company_id);
    CREATE INDEX staff_orders_company_status_idx ON staff_orders(company_id, status);
    CREATE INDEX staff_orders_user_idx           ON staff_orders(user_id);
  END IF;
END $$;

-- staff_order_items: بنود طلبات الموظفين
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_order_items') THEN
    CREATE TABLE staff_order_items (
      id             TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
      staff_order_id TEXT         NOT NULL,
      product_id     TEXT         NOT NULL,
      quantity       DECIMAL(18,4) NOT NULL,
      unit           TEXT,
      notes          TEXT,
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT staff_order_items_pkey       PRIMARY KEY (id),
      CONSTRAINT staff_order_items_order_fk   FOREIGN KEY (staff_order_id) REFERENCES staff_orders(id)   ON DELETE CASCADE,
      CONSTRAINT staff_order_items_product_fk FOREIGN KEY (product_id)     REFERENCES order_products(id) ON DELETE RESTRICT
    );
    CREATE INDEX staff_order_items_order_idx   ON staff_order_items(staff_order_id);
    CREATE INDEX staff_order_items_product_idx ON staff_order_items(product_id);
  END IF;
END $$;
