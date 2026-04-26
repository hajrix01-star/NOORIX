import { FieldRow } from './OcrFieldRowItemParts';

export function OcrExtractedInfoAndTotalsCard({ t, extracted, isAr }) {
  return (
    <div className="noorix-surface-card p-4">
      <div className="font-semibold text-[14px] mb-3">{isAr ? 'معلومات الفاتورة' : 'Invoice Info'}</div>
      <div className="grid gap-2">
        <FieldRow label={t('ocrSupplierField')} value={extracted.supplier?.name} confidence={extracted.supplier?.confidence} match={extracted.supplierMatch} />
        <FieldRow label={t('ocrVatNumber')} value={extracted.vatNumber?.value} confidence={extracted.vatNumber?.confidence} />
        <FieldRow
          label={t('ocrInvoiceNumber')}
          value={extracted.invoiceNumber?.value}
          confidence={extracted.invoiceNumber?.confidence}
        />
        <FieldRow
          label={t('ocrInvoiceDate')}
          value={extracted.invoiceDate?.value}
          confidence={extracted.invoiceDate?.confidence}
        />
      </div>

      {(extracted.subtotalAmount?.value || extracted.vatAmount?.value || extracted.totalAmount?.value) && (
        <div className="mt-3 rounded-lg overflow-hidden border border-noorix-border">
          {extracted.subtotalAmount?.value && (
            <div className="flex items-center justify-between bg-noorix-bg-muted border-b border-noorix-border py-2 px-3">
              <span className="text-[13px] text-noorix-muted">{isAr ? 'المجموع قبل الضريبة' : 'Subtotal'}</span>
              <span className="text-[13px] font-semibold">
                {extracted.subtotalAmount.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}{' '}
                <span className="nx-sar">SR</span>
              </span>
            </div>
          )}
          {extracted.vatAmount?.value && (
            <div className="flex items-center justify-between border-b border-noorix-border py-2 px-3">
              <span className="text-[13px] text-noorix-muted">{isAr ? 'ضريبة القيمة المضافة' : 'VAT (15%)'}</span>
              <span className="text-[13px] font-semibold" style={{ color: 'var(--noorix-accent-amber)' }}>
                {extracted.vatAmount.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}{' '}
                <span className="nx-sar">SR</span>
              </span>
            </div>
          )}
          {extracted.totalAmount?.value && (
            <div className="flex items-center justify-between bg-noorix-bg-muted py-[10px] px-3">
              <span className="text-[13px] font-bold">{isAr ? 'الإجمالي شامل الضريبة' : 'Total (inc. VAT)'}</span>
              <span className="text-[13px] font-bold">
                {extracted.totalAmount.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}{' '}
                <span className="nx-sar">SR</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
