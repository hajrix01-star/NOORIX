import { Button, Input } from '../../../../ui';

export function OcrLinkedPurchaseForm({
  t,
  finalizeOcrId,
  canCreatePurchase,
  accSuggestions,
  accSuggestionsFetching,
  accountingSupplierId,
  onAccountingSupplierIdChange,
  onOpenNewOcrSupplier,
  prefillOcrSupplierId,
  prefillLoading,
  supplierNameForSuggest,
  invoiceVatDigits,
  createLinkedPurchase,
  onCreateLinkedPurchaseChange,
  transactionDate,
  onTransactionDateChange,
  vaultId,
  onVaultIdChange,
  vaultRows,
  purchaseSupplierInvoiceNumber,
  onPurchaseSupplierInvoiceNumberChange,
  extracted,
  isPurchaseTaxable,
  onIsPurchaseTaxableChange,
}: any) {
  if (!finalizeOcrId) return null;

  return (
    <div className="noorix-surface-card p-4 border border-noorix-blue/20">
      <div className="font-semibold text-[14px] mb-1">{t('ocrLinkedPurchaseTitle')}</div>
      <p className="text-[12px] text-noorix-muted m-0 mb-3">{t('ocrLinkedPurchaseHint')}</p>
      {!canCreatePurchase ? (
        <div className="text-[12px] text-noorix-muted">{t('ocrPurchaseNoPermission')}</div>
      ) : (
        <>
          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-3 mb-3 flex flex-col gap-2">
            <div className="text-[12px] font-semibold text-noorix-text">{t('ocrAccountingSupplierSmartTitle')}</div>
            <p className="text-[11px] text-noorix-muted m-0">{t('ocrAccountingSupplierSmartHint')}</p>
            {accSuggestionsFetching && (
              <span className="text-[11px] text-noorix-muted">{t('ocrAccountingSupplierSuggestLoading')}</span>
            )}
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="text-noorix-muted">{t('ocrSelectAccountingSupplier')}</span>
              <select
                className="rounded-md border border-noorix-border bg-noorix-bg-surface px-2 py-2 text-[13px] text-noorix-text"
                value={accountingSupplierId}
                onChange={(e: any) => onAccountingSupplierIdChange(e.target.value)}
              >
                <option value="">{t('ocrSelectAccountingSupplier')}</option>
                {accSuggestions.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {(s.nameAr || s.nameEn || '') + (s.taxNumber ? ` — ${s.taxNumber}` : '')}
                  </option>
                ))}
              </select>
              {accSuggestions[0] && (
                <span className="text-[11px] text-noorix-muted">
                  {accSuggestions[0].linkedFromOcr
                    ? t('ocrAccountingSupplierLinkedCatalog')
                    : t('ocrAccountingSupplierTopScore', {
                        0: String(accSuggestions[0].matchScore ?? '—'),
                      })}
                </span>
              )}
              {prefillOcrSupplierId && accSuggestions.length === 0 && !prefillLoading && !accSuggestionsFetching && (
                <span className="text-[11px] text-noorix-muted">{t('ocrPurchaseSuggestEmpty')}</span>
              )}
              {!prefillOcrSupplierId && supplierNameForSuggest.length < 1 && invoiceVatDigits.length < 9 && !accSuggestionsFetching && (
                <span className="text-[11px] text-noorix-muted">{t('ocrAccountingSupplierNeedNameOrVat')}</span>
              )}
            </label>
            <Button type="button" variant="secondary" className="self-start text-[12px]" onClick={onOpenNewOcrSupplier}>
              {t('ocrAccountingSupplierAddOcrCatalog')}
            </Button>
          </div>
          <label className="flex items-center gap-2 text-[13px] mb-3 cursor-pointer">
            <input type="checkbox" checked={createLinkedPurchase} onChange={(e: any) => onCreateLinkedPurchaseChange(e.target.checked)} />
            <span>{t('ocrCreateLinkedPurchase')}</span>
          </label>
          {createLinkedPurchase && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="text-noorix-muted">{t('ocrTransactionDate')}</span>
                <Input
                  type="date"
                  value={transactionDate?.slice(0, 10) || ''}
                  onChange={(e: any) => onTransactionDateChange(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="text-noorix-muted">{t('ocrVaultSelect')}</span>
                <select
                  className="rounded-md border border-noorix-border bg-noorix-bg-surface px-2 py-2 text-[13px] text-noorix-text"
                  value={vaultId}
                  onChange={(e: any) => onVaultIdChange(e.target.value)}
                >
                  <option value="">{t('ocrSelectVault')}</option>
                  {vaultRows.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.nameAr || v.nameEn || v.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="text-noorix-muted">{t('ocrSupplierInvoiceNo')}</span>
                <Input
                  value={purchaseSupplierInvoiceNumber}
                  onChange={(e: any) => onPurchaseSupplierInvoiceNumberChange(e.target.value)}
                  placeholder={String(extracted.invoiceNumber?.value || '')}
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input type="checkbox" checked={isPurchaseTaxable} onChange={(e: any) => onIsPurchaseTaxableChange(e.target.checked)} />
                <span>{t('ocrPurchaseTaxable')}</span>
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}
