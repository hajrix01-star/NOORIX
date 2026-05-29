import { Link } from 'react-router-dom';
import { invoicesHrefForLinkedPurchase } from '../../utils/ledgerInvoiceLink';

export function OcrUploadPrefillBanner({ t, prefillLoading }: any) {
  if (!prefillLoading) return null;
  return (
    <div className="text-[13px] text-noorix-muted rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2">
      {t('ocrPrefillLoading')}
    </div>
  );
}

export function OcrPrefillLinkedPurchaseBanner({ t, prefillLinkedPurchase }: any) {
  if (!prefillLinkedPurchase?.id) return null;
  return (
    <div className="text-[13px] rounded-lg border border-noorix-blue/30 bg-noorix-blue/5 px-3 py-2 flex flex-wrap items-center gap-2">
      <span className="text-noorix-text">{t('ocrLinkedPurchaseAlready')}</span>
      <Link
        to={invoicesHrefForLinkedPurchase(prefillLinkedPurchase)}
        className="font-semibold text-noorix-blue underline"
      >
        {t('ocrLinkedPurchaseOpenList')}
      </Link>
    </div>
  );
}

export function OcrPostSaveLinkedBanner({ t, success, postSaveLinkedPurchase }: any) {
  if (!success || !postSaveLinkedPurchase?.id) return null;
  return (
    <div className="text-[13px] rounded-lg border border-noorix-accent-green/40 bg-green-50 dark:bg-green-950/25 px-3 py-2 flex flex-wrap items-center gap-2">
      <span className="text-noorix-text">{t('ocrPurchaseRecordedLinked')}</span>
      <Link
        to={invoicesHrefForLinkedPurchase(postSaveLinkedPurchase)}
        className="font-semibold text-noorix-blue underline"
      >
        {t('ocrLinkedPurchaseOpenList')}
      </Link>
    </div>
  );
}

export function OcrEmptyImageDropzone({ t, dragging, onDragOver, onDragLeave, onDrop, onClickPick, fileRef, onFileInputChange }: any) {
  return (
    <div
      className={`ocr-upload-zone${dragging ? ' ocr-upload-zone--active' : ''}`}
      onDragOver={(e: any) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClickPick}
    >
      <div className="ocr-upload-icon">↑</div>
      <div className="ocr-upload-text">{t('ocrDragDrop')}</div>
      <div className="ocr-upload-hint">{t('ocrSupportedFormats')}</div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e: any) => onFileInputChange(e.target.files[0])}
      />
    </div>
  );
}

export function OcrErrorBanner({ error }: any) {
  if (!error) return null;
  return (
    <div
      className="text-[13px] rounded-lg py-3 px-4"
      style={{
        background: 'var(--noorix-red-6)',
        border: '1px solid var(--noorix-red-15)',
        color: 'var(--noorix-accent-red)',
      }}
    >
      {error}
    </div>
  );
}

export function OcrWarningBanner({ warning }: any) {
  if (!warning) return null;
  return (
    <div className="text-[13px] rounded-lg border border-noorix-amber/35 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-noorix-amber">
      {warning}
    </div>
  );
}
