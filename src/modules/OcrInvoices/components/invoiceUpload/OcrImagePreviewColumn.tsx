import { Button } from '../../../../ui';
import { OcrExtractionPipelineStatus } from './OcrExtractionPipelineStatus';

export function OcrImagePreviewColumn({
  t,
  isAr,
  preview,
  imageBase64,
  extracted,
  loading,
  saving,
  success,
  extractWarning,
  extractError,
  extractFailureStage,
  extractStartedAt,
  onResetAll,
  onExtract,
  onSave,
}: any) {
  return (
    <div className="noorix-surface-card flex-[1_1_280px] min-w-0 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-[14px]">{isAr ? 'صورة الفاتورة' : 'Invoice Image'}</span>
        <Button className="modal-close-btn w-7 h-7" onClick={onResetAll}>
          ✕
        </Button>
      </div>
      <img src={preview} alt="invoice" className="w-full rounded-lg max-h-[500px] object-contain" />
      <div className="mt-3 flex gap-2 flex flex-wrap">
        {!extracted && (
          <Button onClick={onExtract} disabled={loading} variant="primary" className="flex-1 min-w-0">
            {loading ? t('ocrExtracting') : t('ocrExtract')}
          </Button>
        )}
        {extracted && (
          <>
            <Button onClick={onSave} disabled={saving || success} variant="primary" className="flex-1 min-w-0">
              {saving ? t('ocrSaving') : success ? t('ocrSaved') : t('ocrSaveInvoice')}
            </Button>
            {!!imageBase64 && (
              <Button onClick={onExtract} disabled={loading} className="flex-1 min-w-0">
                {loading ? t('ocrExtracting') : isAr ? 'إعادة استخراج' : 'Re-extract'}
              </Button>
            )}
          </>
        )}
      </div>
      <OcrExtractionPipelineStatus
        t={t}
        isAr={isAr}
        loading={loading}
        extracted={extracted}
        extractWarning={extractWarning}
        extractError={extractError}
        extractFailureStage={extractFailureStage}
        extractStartedAt={extractStartedAt}
        onRetry={onExtract}
      />
    </div>
  );
}
