-- فواتير المبيعات كانت تُخزَّن بـ vault_id للقناة الأولى فقط دون invoice_vault_allocations
-- → شاشة الفواتير تعرض خزينة واحدة بينما الملخص والخزائن صحيحة. تعبئة من daily_sales_channels.

INSERT INTO invoice_vault_allocations (id, tenant_id, invoice_id, vault_id, amount, created_at)
SELECT
  md5(random()::text || i.id::text || dsc.vault_id::text || clock_timestamp()::text),
  i.tenant_id,
  i.id,
  dsc.vault_id,
  dsc.amount,
  NOW()
FROM invoices i
INNER JOIN daily_sales_channels dsc ON dsc.summary_id = i.daily_sales_summary_id
WHERE i.kind = 'sale'
  AND i.daily_sales_summary_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM invoice_vault_allocations a WHERE a.invoice_id = i.id);

-- أكثر من خزينة: إفراغ vault_id على الفاتورة (مثل فواتير الصرف متعددة الخزائن)
UPDATE invoices i
SET vault_id = NULL
WHERE i.kind = 'sale'
  AND i.daily_sales_summary_id IS NOT NULL
  AND (
    SELECT COUNT(*)::int FROM invoice_vault_allocations a WHERE a.invoice_id = i.id
  ) > 1;

-- خزينة واحدة فقط: مواءمة vault_id مع التوزيع
UPDATE invoices i
SET vault_id = (
  SELECT a.vault_id FROM invoice_vault_allocations a WHERE a.invoice_id = i.id LIMIT 1
)
WHERE i.kind = 'sale'
  AND i.daily_sales_summary_id IS NOT NULL
  AND (
    SELECT COUNT(*)::int FROM invoice_vault_allocations a WHERE a.invoice_id = i.id
  ) = 1;
