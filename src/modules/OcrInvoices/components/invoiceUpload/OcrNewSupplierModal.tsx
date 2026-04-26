import { Button, Input } from '../../../../ui';

export function OcrNewSupplierModal({
  t,
  open,
  dir,
  isSaving,
  nameAr,
  onNameArChange,
  tax,
  onTaxChange,
  error,
  onClose,
  onSubmit,
}: any) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-new-supplier-title"
      onClick={() => !isSaving && onClose()}
    >
      <div
        className="noorix-surface-card max-w-md w-full p-4 shadow-xl border border-noorix-border"
        dir={dir}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div id="ocr-new-supplier-title" className="font-semibold text-[15px] mb-1">
          {t('ocrNewOcrSupplierModalTitle')}
        </div>
        <p className="text-[12px] text-noorix-muted m-0 mb-3">{t('ocrNewOcrSupplierModalHint')}</p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-noorix-muted">{t('ocrSupplierNameAr')}</span>
            <Input value={nameAr} onChange={(e: any) => onNameArChange(e.target.value)} disabled={isSaving} />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-noorix-muted">{t('ocrSupplierTax')}</span>
            <Input value={tax} onChange={(e: any) => onTaxChange(e.target.value)} disabled={isSaving} />
          </label>
          {error && <div className="text-[12px] text-noorix-accent-red">{error}</div>}
          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" variant="secondary" disabled={isSaving} onClick={onClose}>
              {t('ocrCancel')}
            </Button>
            <Button type="button" variant="primary" disabled={isSaving} onClick={onSubmit}>
              {isSaving ? t('ocrSaving') : t('ocrSave')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
